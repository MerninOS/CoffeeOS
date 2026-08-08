/**
 * Payment-processing fee for a Shopify order: the actual figure when Shopify
 * reports one, a plan-rate estimate when it doesn't, and null when the fee is
 * genuinely not knowable yet.
 *
 * A pure module for the same reason cogs.ts is one: both sync entry points
 * (dashboard bulk sync and the packing block's sync-on-demand) share
 * upsertShopifyOrder, and the fee rule must live in exactly one place,
 * testable without a Supabase mock. See CoffeeOS#133.
 */

import { SHOPIFY_FEE_RATE, SHOPIFY_FEE_FLAT } from "./constants";

/**
 * The structural subset of a Shopify order this module reads. lib/shopify.ts's
 * ShopifyOrder is assignable to it; tests construct it directly. Kept local so
 * the fee rule does not import the whole Admin-API surface.
 */
export interface FeeOrder {
  displayFinancialStatus: string;
  totalPriceSet: {
    shopMoney: {
      amount: string;
      currencyCode: string;
    };
  };
  transactions?: Array<{
    fees?: Array<{
      amount: {
        amount: string;
        currencyCode: string;
      };
    }> | null;
  }> | null;
}

export interface ProcessingFee {
  fee: number;
  source: "actual" | "estimated";
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Resolve the order's processing fee.
 *
 *   any fee rows on any transaction  -> their sum, 'actual'
 *   no fee rows, total is 0          -> 0, 'actual' (no money moved, no fee —
 *                                       the 30¢ flat estimate on a $0 giveaway
 *                                       would invent a cost; production has
 *                                       such orders today)
 *   no fee rows, PAID, total > 0     -> rate × total + flat, 'estimated'
 *                                       (manual/draft orders never get fee
 *                                       rows from Shopify)
 *   otherwise                        -> null: not knowable YET. An unpaid
 *                                       order has no fee until capture; null
 *                                       lets the next re-sync fill it in,
 *                                       where a stored 0 would read as "known
 *                                       to be free" forever.
 *
 * Fees are summed across ALL transactions, never read off the first one: a
 * card order arrives as AUTHORIZATION (fees: []) followed by CAPTURE (the
 * real fee), so "first transaction" is exactly the empty one. Verified
 * against live orders #1312–#1314.
 *
 * Malformed data (unparseable amount, fee currency disagreeing with the
 * order's) also returns null — an unknown fee, never a guess and never a
 * throw. A sync must not fail an order because its fee payload was odd.
 */
/** An order row as the DISPLAY side sees it — after storage, not before. */
export interface StoredFee {
  total_processing_fee?: number | null;
  processing_fee_source?: string | null;
}

export type FeeDisplayState = "actual" | "estimated" | "unknown";

/**
 * Why the figure reads the way it does, keyed by state.
 *
 * Lives here rather than in either component for the same reason the
 * formatter does: two surfaces render this fee, and an explanation that
 * disagrees between them is worse than none. `actual` has no tooltip — a
 * reported figure needs no excuse.
 */
export const FEE_TITLE: Record<FeeDisplayState, string | undefined> = {
  unknown: "Fee unknown — the next sync of this order fetches it from Shopify.",
  estimated:
    "Estimated at the plan rate (2.9% + 30¢) — Shopify reported no fee data for this order.",
  actual: undefined,
};

/**
 * How a stored fee reads on screen: one state, one string, one place.
 *
 * Extracted because /orders and /orders/[id] each rendered these three cases
 * independently — the list via two JSX branches, the detail via a prefix
 * ternary — and neither was reachable from the unit suite. A mutation test
 * proved it: deleting the `~` from the detail page left all 236 unit tests
 * green, because the only thing watching that marker was the credentialed
 * e2e suite. Two hand-written copies of a rule, with the fast tests blind to
 * both, is precisely the drift lib/orders/cogs.ts exists to prevent.
 *
 * The `~` is not decoration. It is the only thing on screen separating a
 * figure Shopify reported from one this code inferred, which AC 7 requires.
 */
export function formatProcessingFee(order: StoredFee): {
  state: FeeDisplayState;
  text: string;
} {
  const fee = order.total_processing_fee;

  // Null is "not yet known", NOT zero — rendering $0.00 here would claim a
  // knowledge we lack. A re-sync fills it in.
  if (fee == null) return { state: "unknown", text: "not synced" };

  const amount = `$${fee.toFixed(2)}`;
  return order.processing_fee_source === "estimated"
    ? { state: "estimated", text: `~${amount}` }
    : { state: "actual", text: amount };
}

export function computeProcessingFee(order: FeeOrder): ProcessingFee | null {
  const currency = order.totalPriceSet?.shopMoney?.currencyCode;
  const total = parseFloat(order.totalPriceSet?.shopMoney?.amount ?? "");
  if (!Number.isFinite(total)) return null;

  const feeRows = (order.transactions || []).flatMap((t) => t.fees || []);

  if (feeRows.length > 0) {
    let sum = 0;
    for (const row of feeRows) {
      const amount = parseFloat(row.amount?.amount ?? "");
      if (!Number.isFinite(amount)) return null;
      if (row.amount?.currencyCode !== currency) return null;
      sum += amount;
    }
    return { fee: round2(sum), source: "actual" };
  }

  if (total === 0) return { fee: 0, source: "actual" };

  if (order.displayFinancialStatus === "PAID") {
    return {
      fee: round2(total * SHOPIFY_FEE_RATE + SHOPIFY_FEE_FLAT),
      source: "estimated",
    };
  }

  return null;
}

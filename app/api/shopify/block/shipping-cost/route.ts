import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { blockContextFromRequest } from "@/lib/shopify-block/auth";
import { blockJson, blockOptions } from "@/lib/shopify-block/http";
import { getPackingState } from "@/lib/orders/packing-state";

// Kept in sync with packing/route.ts and packing-state/route.ts.
const SHOPIFY_ORDER_ID_PATTERN = /^\d{1,32}$/;

// order_custom_costs.amount is DECIMAL(10,2) — 10 total digits, 2 after the
// point, so the integer part tops out at 8 digits. Bound it here rather than
// letting an oversized value either get rejected by Postgres as a confusing
// 500, or overflow toward Infinity downstream in getPackingState's COGS
// math (JSON.stringify(Infinity) silently serializes to null).
const MAX_AMOUNT = 1e8;

interface ShippingCostBody {
  shopifyOrderId: string;
  amount: number;
}

function parseBody(raw: unknown): ShippingCostBody | null {
  if (!raw || typeof raw !== "object") return null;
  const b = raw as Record<string, unknown>;
  if (typeof b.shopifyOrderId !== "string" || !SHOPIFY_ORDER_ID_PATTERN.test(b.shopifyOrderId))
    return null;
  if (
    typeof b.amount !== "number" ||
    !Number.isFinite(b.amount) ||
    b.amount < 0 ||
    b.amount >= MAX_AMOUNT
  )
    return null;
  return { shopifyOrderId: b.shopifyOrderId, amount: b.amount };
}

export async function POST(request: NextRequest) {
  const ctx = await blockContextFromRequest(request);
  if (!ctx.ok) return blockJson({ error: ctx.error }, ctx.status);

  const body = parseBody(await request.json().catch(() => null));
  if (!body) return blockJson({ error: "Invalid request body" }, 400);

  const supabase = createAdminClient();

  // Scoped by user_id — the tenant boundary. order.id is the only thing the
  // upsert RPC below is given, so everything hinges on this lookup only
  // ever resolving to a row this tenant owns.
  const { data: order, error: orderLookupError } = await supabase
    .from("orders")
    .select("id")
    .eq("shopify_order_id", body.shopifyOrderId)
    .eq("user_id", ctx.userId)
    .maybeSingle();
  if (orderLookupError) {
    console.error("[block/shipping-cost] order lookup failed", orderLookupError);
    return blockJson({ error: "Could not load this order" }, 500);
  }
  if (!order) return blockJson({ error: "Order not found" }, 404);

  // upsert_order_shipping_cost (scripts/026_packing_uniqueness.sql) does the
  // find-or-update atomically in one statement via ON CONFLICT against a
  // partial unique index on order_custom_costs (order_id) WHERE
  // lower(description) = 'shipping'. This replaces a prior SELECT-then-
  // INSERT/UPDATE here that raced: two near-simultaneous saves (double-
  // click, two devices, a retried request) could both see no existing row
  // and both insert — order_custom_costs had no uniqueness at all, and
  // getOrderCogs sums custom costs additively, so two "Shipping" rows would
  // silently inflate COGS and deflate margin. Now Postgres itself
  // serializes the write.
  const { data, error: rpcError } = await supabase
    .rpc("upsert_order_shipping_cost", {
      p_order_id: order.id,
      p_amount: body.amount,
    })
    .single();
  if (rpcError || !data) {
    console.error("[block/shipping-cost] upsert_order_shipping_cost failed", rpcError);
    return blockJson({ error: "Could not save shipping cost" }, 500);
  }
  // The row itself isn't consumed further — the RPC's write is the point;
  // the response below returns the freshly reloaded packing state, not this
  // row directly.

  let state;
  try {
    state = await getPackingState(supabase, ctx.userId, body.shopifyOrderId);
  } catch (e) {
    console.error("[block/shipping-cost] getPackingState failed", e);
    return blockJson({ error: "Shipping cost saved, but could not reload order state" }, 500);
  }
  if (!state) return blockJson({ error: "Order could not be loaded" }, 500);

  return blockJson({ state });
}

export const OPTIONS = blockOptions;

import type { ShopifySettings } from "@/app/(dashboard)/settings/components/types";

/**
 * The connection and billing rules for /settings, in ONE place.
 *
 * THIS MODULE IS THE ONLY PLACE ALLOWED TO READ `connected_via_oauth`,
 * `has_admin_credentials` or `billing_status`. tests/unit/settings-tokens.spec.ts
 * enforces that by banning those three field names everywhere under
 * app/(dashboard)/settings/ — the FIELDS, not the comparisons.
 *
 * Banning the fields rather than the expressions is deliberate. A guard that
 * only knows the spelling of a rule cannot protect the rule: the equivalent
 * guard on /orders/[id] shipped with two checks, and a re-derivation spelled
 * `costKnown || cogs !== 0` walked straight through both, so a third had to be
 * added after the fact (tests/unit/orders-detail-tokens.spec.ts:92). A component
 * that cannot read `connected_via_oauth` cannot re-derive connectedness in any
 * spelling at all.
 *
 * Both definitions are preserved verbatim from the pre-conversion page so the
 * restyle cannot silently widen who counts as connected or billed:
 *   settings-client.tsx:45  isShopifyConnected
 *   settings-client.tsx:46  isBillingActive
 */

export type WorkspaceTone = "live" | "blocked" | "idle";

export interface WorkspaceStatus {
  tone: WorkspaceTone;
  /** The hero word. */
  label: string;
}

/**
 * BOTH fields, not just the OAuth flag. A store can complete OAuth and still
 * carry no admin token, and then every action on the page fails — so treating
 * `connected_via_oauth` alone as connected would render a live-looking workspace
 * that cannot do anything.
 */
export function isConnected(s: ShopifySettings | null): boolean {
  return !!(s && s.connected_via_oauth && s.has_admin_credentials);
}

/** Exactly `"ACTIVE"`. Case-sensitive, as the pre-conversion page was. */
export function isBillingActive(s: ShopifySettings | null): boolean {
  return !!s && s.billing_status === "ACTIVE";
}

/**
 * The page's hero. Order matters: an unconnected store is reported as
 * unconnected rather than as blocked, because "approve billing" is not the
 * action that fixes it.
 */
export function workspaceStatus(s: ShopifySettings | null): WorkspaceStatus {
  if (!isConnected(s)) return { tone: "idle", label: "Not connected" };
  if (!isBillingActive(s)) return { tone: "blocked", label: "Blocked" };
  return { tone: "live", label: "Live" };
}

/**
 * Project a `shopify_settings` row into the shape the page consumes.
 *
 * Lives here, beside the rules, because this is the only other place the raw
 * column names legitimately appear — and keeping it here is what lets
 * tests/unit/settings-tokens.spec.ts ban those names from the route outright,
 * with no exemption for "the file that happens to do the mapping". A guard with
 * an exemption is a guard someone will widen.
 *
 * `has_admin_credentials` is deliberately a BOOLEAN derived from the token, not
 * the token: the page needs to know whether admin access exists, and shipping
 * the credential itself to the client to answer that would be a leak.
 */
export function toShopifySettings(
  row: Record<string, unknown> | null | undefined,
): ShopifySettings | null {
  if (!row) return null;
  return {
    store_domain: row.store_domain as string,
    shop_name: row.shop_name as string | undefined,
    connected_via_oauth: row.connected_via_oauth as boolean | undefined,
    oauth_scope: row.oauth_scope as string | undefined,
    has_admin_credentials: !!row.admin_access_token,
    billing_status: row.billing_status as string | null | undefined,
    billing_plan_name: row.billing_plan_name as string | null | undefined,
    billing_current_period_end: row.billing_current_period_end as string | null | undefined,
    billing_test: row.billing_test as boolean | null | undefined,
  };
}

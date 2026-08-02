/**
 * The `?error=` codes /settings can be redirected back with, and the copy each
 * one shows.
 *
 * Data, not control flow, and lifted verbatim from settings-client.tsx so the
 * conversion cannot reword a message without someone noticing:
 * tests/e2e/settings-capabilities.spec.ts asserts twelve of these against the
 * rendered page, and asserts that each is NOT the fallback — so a key that
 * quietly falls through fails rather than degrading into generic copy.
 *
 * The producers are `app/api/shopify/callback/route.ts`,
 * `app/api/shopify/billing/{ensure,return}/route.ts` and the gate in
 * `lib/supabase/proxy.ts`. Adding a code there without adding it here is not an
 * error — it renders the fallback — which is precisely why the fallback has its
 * own test.
 *
 * `billing_not_active` is the odd one: it is mapped, but on a connected store
 * with inactive billing (the only state that produces it) the auto-check effect
 * in settings-client.tsx navigates away before this copy is ever painted.
 * Measured, not assumed. It stays mapped because that effect is conditional and
 * a store without a `store_domain` would fall through to rendering it.
 */
export const SHOPIFY_ERROR_MESSAGES: Record<string, string> = {
  missing_params: "Missing required parameters from Shopify",
  config_error: "Shopify app not configured correctly",
  invalid_signature: "Invalid signature from Shopify",
  invalid_state: "Invalid state — please try connecting again",
  state_expired: "Connection timed out — please try again",
  shop_mismatch: "Shop mismatch — please try connecting again",
  token_exchange_failed: "Failed to exchange token with Shopify",
  save_failed: "Failed to save connection",
  callback_error: "An error occurred during connection",
  billing_not_active:
    "Billing is required to use the app. Manage your app plan in Shopify Admin, then refresh status here.",
  billing_create_failed: "Billing API charge creation is disabled for managed pricing apps.",
  billing_check_failed: "Could not verify Shopify billing status. Please try again.",
  shopify_not_connected: "Connect your Shopify store before activating billing.",
};

export const SHOPIFY_ERROR_FALLBACK = "An error occurred connecting to Shopify";

export function shopifyErrorMessage(code: string | null | undefined): string {
  return (code && SHOPIFY_ERROR_MESSAGES[code]) || SHOPIFY_ERROR_FALLBACK;
}

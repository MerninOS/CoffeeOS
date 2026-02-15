import type { ShopifyAppSubscription } from "@/lib/shopify";

export function isBillingActive(status: string | null | undefined): boolean {
  return status === "ACTIVE";
}

export function isBillingBypassEnabled(): boolean {
  const raw = process.env.SHOPIFY_BILLING_TEST;
  if (!raw) return false;
  return ["1", "true", "yes", "on"].includes(raw.toLowerCase());
}

export function isDemoUserEmail(email: string | null | undefined): boolean {
  return (email || "").toLowerCase() === "demo@coffeeos.io";
}

export function hasBillingAccess(
  status: string | null | undefined,
  userEmail?: string | null
): boolean {
  return isBillingActive(status) || isBillingBypassEnabled() || isDemoUserEmail(userEmail);
}

export function hasShopifyConnectionAccess(
  isConnected: boolean,
  userEmail?: string | null
): boolean {
  return isConnected || isBillingBypassEnabled() || isDemoUserEmail(userEmail);
}

export function subscriptionToBillingFields(subscription: ShopifyAppSubscription | null) {
  return {
    billing_subscription_id: subscription?.id || null,
    billing_plan_name: subscription?.name || null,
    billing_status: subscription?.status || null,
    billing_test: subscription?.test || false,
    billing_current_period_end: subscription?.currentPeriodEnd || null,
    billing_checked_at: new Date().toISOString(),
  };
}

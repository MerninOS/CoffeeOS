import type { BillingPlanConfig, ShopifyAppSubscription } from "@/lib/shopify";

function env(name: string, fallback?: string): string {
  const value = process.env[name] || fallback;
  if (!value) {
    throw new Error(`Missing ${name} environment variable`);
  }
  return value;
}

function envNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid ${name} value: ${raw}`);
  }
  return parsed;
}

function envBoolean(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw == null) return fallback;
  return ["1", "true", "yes", "on"].includes(raw.toLowerCase());
}

export function getBillingPlanConfig(): BillingPlanConfig {
  const intervalRaw = env("SHOPIFY_BILLING_INTERVAL", "EVERY_30_DAYS");
  const interval = intervalRaw === "ANNUAL" ? "ANNUAL" : "EVERY_30_DAYS";

  const trialDaysRaw = process.env.SHOPIFY_BILLING_TRIAL_DAYS;
  const trialDays = trialDaysRaw ? Number(trialDaysRaw) : undefined;
  if (trialDaysRaw && (!Number.isInteger(trialDays) || trialDays < 0)) {
    throw new Error(`Invalid SHOPIFY_BILLING_TRIAL_DAYS value: ${trialDaysRaw}`);
  }

  return {
    name: env("SHOPIFY_BILLING_PLAN_NAME", "CoffeeOS"),
    amount: envNumber("SHOPIFY_BILLING_AMOUNT", 49),
    currencyCode: env("SHOPIFY_BILLING_CURRENCY", "USD"),
    interval,
    test: envBoolean("SHOPIFY_BILLING_TEST", process.env.NODE_ENV !== "production"),
    trialDays,
  };
}

export function isBillingActive(status: string | null | undefined): boolean {
  return status === "ACTIVE";
}

export function isBillingBypassEnabled(): boolean {
  const raw = process.env.SHOPIFY_BILLING_TEST;
  if (!raw) return false;
  return ["1", "true", "yes", "on"].includes(raw.toLowerCase());
}

export function hasBillingAccess(status: string | null | undefined): boolean {
  return isBillingActive(status) || isBillingBypassEnabled();
}

export function hasShopifyConnectionAccess(isConnected: boolean): boolean {
  return isConnected || isBillingBypassEnabled();
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

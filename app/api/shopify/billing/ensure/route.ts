import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureShopifyBilling } from "@/lib/shopify";
import { getBillingPlanConfig, isBillingBypassEnabled, subscriptionToBillingFields } from "@/lib/shopify-billing";

export async function GET(request: NextRequest) {
  if (isBillingBypassEnabled()) {
    return NextResponse.redirect(new URL("/dashboard?billing=active", request.url));
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const loginUrl = new URL("/auth/login", request.url);
    loginUrl.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, owner_id")
    .eq("id", user.id)
    .single();

  const ownerId = profile?.role === "owner" ? user.id : profile?.owner_id;
  if (!ownerId) {
    return NextResponse.redirect(new URL("/settings?error=unauthorized", request.url));
  }

  const shop = request.nextUrl.searchParams.get("shop");
  const host = request.nextUrl.searchParams.get("host");

  const { data: settings } = await supabase
    .from("shopify_settings")
    .select("store_domain, admin_access_token, connected_via_oauth")
    .eq("user_id", ownerId)
    .single();

  const storeDomain = shop || settings?.store_domain;
  if (!storeDomain || !settings?.connected_via_oauth || !settings?.admin_access_token) {
    return NextResponse.redirect(new URL("/settings?error=shopify_not_connected", request.url));
  }

  try {
    const returnUrl = new URL("/api/shopify/billing/return", request.url);
    returnUrl.searchParams.set("shop", storeDomain);
    if (host) {
      returnUrl.searchParams.set("host", host);
    }

    const billing = await ensureShopifyBilling(
      storeDomain,
      settings.admin_access_token,
      returnUrl.toString(),
      getBillingPlanConfig()
    );

    await supabase
      .from("shopify_settings")
      .update(subscriptionToBillingFields(billing.subscription || null))
      .eq("user_id", ownerId);

    if (billing.active) {
      return NextResponse.redirect(new URL("/dashboard?billing=active", request.url));
    }

    if (billing.confirmationUrl) {
      return NextResponse.redirect(billing.confirmationUrl);
    }

    return NextResponse.redirect(new URL("/settings?error=billing_not_active", request.url));
  } catch (error) {
    console.error("Failed to ensure Shopify billing:", error);
    return NextResponse.redirect(new URL("/settings?error=billing_create_failed", request.url));
  }
}

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getShopifyActiveSubscription } from "@/lib/shopify";
import { getManagedPricingPlansUrl, isBillingActive, isBillingBypassEnabled, subscriptionToBillingFields } from "@/lib/shopify-billing";

export async function GET(request: NextRequest) {
  const shop = request.nextUrl.searchParams.get("shop");
  const host = request.nextUrl.searchParams.get("host");

  if (isBillingBypassEnabled()) {
    const installUrl = new URL("/api/shopify/install", request.url);
    if (shop) {
      installUrl.searchParams.set("shop", shop);
    }
    installUrl.searchParams.set("shopify", "connected");
    installUrl.searchParams.set("billing", "active");
    if (host) {
      installUrl.searchParams.set("host", host);
    }
    return NextResponse.redirect(installUrl);
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

  const { data: settings } = await supabase
    .from("shopify_settings")
    .select("store_domain, admin_access_token")
    .eq("user_id", ownerId)
    .single();

  const storeDomain = shop || settings?.store_domain;
  if (!storeDomain || !settings?.admin_access_token) {
    return NextResponse.redirect(new URL("/settings?error=shopify_not_connected", request.url));
  }

  try {
    const subscription = await getShopifyActiveSubscription(
      storeDomain,
      settings.admin_access_token
    );

    await supabase
      .from("shopify_settings")
      .update(subscriptionToBillingFields(subscription))
      .eq("user_id", ownerId);

    if (!subscription || !isBillingActive(subscription.status)) {
      const pricingPlansUrl = getManagedPricingPlansUrl(storeDomain);
      if (pricingPlansUrl) {
        return NextResponse.redirect(pricingPlansUrl);
      }
      return NextResponse.redirect(new URL("/settings?error=billing_not_active", request.url));
    }

    const installUrl = new URL("/api/shopify/install", request.url);
    installUrl.searchParams.set("shop", storeDomain);
    installUrl.searchParams.set("shopify", "connected");
    installUrl.searchParams.set("billing", "active");
    if (host) {
      installUrl.searchParams.set("host", host);
    }
    return NextResponse.redirect(installUrl);
  } catch (error) {
    console.error("Failed to confirm Shopify billing:", error);
    return NextResponse.redirect(new URL("/settings?error=billing_check_failed", request.url));
  }
}

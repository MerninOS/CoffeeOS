import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getShopifyActiveSubscription } from "@/lib/shopify";
import { getManagedPricingPlansUrl, isBillingBypassEnabled, isBillingActive, subscriptionToBillingFields } from "@/lib/shopify-billing";

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
    const subscription = await getShopifyActiveSubscription(
      storeDomain,
      settings.admin_access_token
    );

    await supabase
      .from("shopify_settings")
      .update(subscriptionToBillingFields(subscription))
      .eq("user_id", ownerId);

    if (subscription && isBillingActive(subscription.status)) {
      return NextResponse.redirect(new URL("/dashboard?billing=active", request.url));
    }

    const pricingPlansUrl = getManagedPricingPlansUrl(storeDomain);
    if (pricingPlansUrl) {
      const response = NextResponse.redirect(pricingPlansUrl);
      response.cookies.set("shopify_pending_shop", storeDomain, {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 30,
      });
      return response;
    }

    const settingsUrl = new URL("/settings", request.url);
    settingsUrl.searchParams.set("error", "billing_not_active");
    settingsUrl.searchParams.set("action", "manage_billing");
    settingsUrl.searchParams.set("shop", storeDomain);
    if (host) {
      settingsUrl.searchParams.set("host", host);
    }
    return NextResponse.redirect(settingsUrl);
  } catch (error) {
    console.error("Failed to check Shopify billing:", error);
    return NextResponse.redirect(new URL("/settings?error=billing_check_failed", request.url));
  }
}

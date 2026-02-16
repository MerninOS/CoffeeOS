import { NextRequest, NextResponse } from "next/server";
import { getShopifyActiveSubscription } from "@/lib/shopify";
import { getManagedPricingPlansUrl, isBillingActive, isBillingBypassEnabled, subscriptionToBillingFields } from "@/lib/shopify-billing";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

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
  const normalizedShop = (shop || "").trim().toLowerCase();
  if (!normalizedShop) {
    return NextResponse.redirect(new URL("/settings?error=missing_shop", request.url));
  }

  const supabaseAdmin = createAdminClient();
  const { data: settings } = await supabaseAdmin
    .from("shopify_settings")
    .select("user_id, store_domain, admin_access_token")
    .eq("store_domain", normalizedShop)
    .single();

  if (!settings?.admin_access_token) {
    const loginUrl = new URL("/auth/login", request.url);
    const nextInstallUrl = new URL("/api/shopify/install", request.url);
    nextInstallUrl.searchParams.set("shop", normalizedShop);
    nextInstallUrl.searchParams.set("shopify", "connected");
    loginUrl.searchParams.set("next", `${nextInstallUrl.pathname}${nextInstallUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }

  try {
    const subscription = await getShopifyActiveSubscription(
      normalizedShop,
      settings.admin_access_token
    );

    await supabaseAdmin
      .from("shopify_settings")
      .update(subscriptionToBillingFields(subscription))
      .eq("user_id", settings.user_id);

    revalidatePath("/settings", "layout");
    revalidatePath("/dashboard", "layout");

    if (!subscription || !isBillingActive(subscription.status)) {
      const pricingPlansUrl = getManagedPricingPlansUrl(normalizedShop);
      if (pricingPlansUrl) {
        return NextResponse.redirect(pricingPlansUrl);
      }
      return NextResponse.redirect(new URL("/settings?error=billing_not_active", request.url));
    }

    const installUrl = new URL("/api/shopify/install", request.url);
    installUrl.searchParams.set("shop", normalizedShop);
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

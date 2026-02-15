import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hasBillingAccess, hasShopifyConnectionAccess } from "@/lib/shopify-billing";

const SHOP_DOMAIN_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/;

function normalizeShop(rawShop: string | null): string | null {
  if (!rawShop) return null;

  let shop = rawShop.trim().toLowerCase();
  shop = shop.replace(/^https?:\/\//, "").replace(/\/$/, "");

  if (!shop.includes(".myshopify.com")) {
    shop = `${shop}.myshopify.com`;
  }

  if (!SHOP_DOMAIN_REGEX.test(shop)) {
    return null;
  }

  return shop;
}

export async function GET(request: NextRequest) {
  const shop = normalizeShop(request.nextUrl.searchParams.get("shop"));
  const host = request.nextUrl.searchParams.get("host");
  const shopifyStatus = request.nextUrl.searchParams.get("shopify");

  if (!shop) {
    return NextResponse.json(
      { error: "Missing or invalid shop parameter" },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const authPath = `/api/shopify/auth?shop=${encodeURIComponent(shop)}${host ? `&host=${encodeURIComponent(host)}` : ""}`;

  if (!user) {
    const loginUrl = new URL("/auth/login", request.url);
    loginUrl.searchParams.set("next", authPath);
    loginUrl.searchParams.set("shop", shop);
    if (host) {
      loginUrl.searchParams.set("host", host);
    }
    return NextResponse.redirect(loginUrl);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, owner_id")
    .eq("id", user.id)
    .single();

  const ownerId = profile?.role === "owner" ? user.id : profile?.owner_id;

  if (ownerId) {
    const { data: settings } = await supabase
      .from("shopify_settings")
      .select("store_domain, connected_via_oauth, admin_access_token, billing_status")
      .eq("user_id", ownerId)
      .single();

    const hasExistingConnection =
      settings?.store_domain === shop &&
      settings?.connected_via_oauth &&
      !!settings?.admin_access_token;
    const hasActiveBilling = hasBillingAccess(settings?.billing_status, user.email);
    const hasConnectionAccess = hasShopifyConnectionAccess(hasExistingConnection, user.email);

    if (hasConnectionAccess && hasActiveBilling) {
      const destination = shopifyStatus === "connected" ? "/settings" : "/dashboard";
      const dashboardUrl = new URL(destination, request.url);
      if (shopifyStatus) {
        dashboardUrl.searchParams.set("shopify", shopifyStatus);
      }
      if (request.nextUrl.searchParams.get("billing") === "active") {
        dashboardUrl.searchParams.set("billing", "active");
      }
      dashboardUrl.searchParams.set("shop", shop);
      if (host) {
        dashboardUrl.searchParams.set("host", host);
      }
      return NextResponse.redirect(dashboardUrl);
    }

    if (hasConnectionAccess && !hasActiveBilling) {
      const billingUrl = new URL("/api/shopify/billing/ensure", request.url);
      billingUrl.searchParams.set("shop", shop);
      if (host) {
        billingUrl.searchParams.set("host", host);
      }
      return NextResponse.redirect(billingUrl);
    }
  }

  return NextResponse.redirect(new URL(authPath, request.url));
}

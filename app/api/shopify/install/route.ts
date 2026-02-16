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
  const requestedShop = normalizeShop(request.nextUrl.searchParams.get("shop"));
  const host = request.nextUrl.searchParams.get("host");
  const shopifyStatus = request.nextUrl.searchParams.get("shopify");
  const billingStatus = request.nextUrl.searchParams.get("billing");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    if (!requestedShop) {
      return NextResponse.redirect(new URL("/auth/login", request.url));
    }

    const returnToInstallPath =
      shopifyStatus === "connected" || billingStatus === "active";
    const authPath = `/api/shopify/auth?shop=${encodeURIComponent(requestedShop)}${host ? `&host=${encodeURIComponent(host)}` : ""}`;
    const nextPath = returnToInstallPath
      ? `${request.nextUrl.pathname}${request.nextUrl.search}`
      : authPath;

    const loginUrl = new URL("/auth/login", request.url);
    loginUrl.searchParams.set("next", nextPath);
    loginUrl.searchParams.set("shop", requestedShop);
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
  let effectiveShop = requestedShop;

  if (ownerId) {
    const { data: settings } = await supabase
      .from("shopify_settings")
      .select("store_domain, connected_via_oauth, admin_access_token, billing_status")
      .eq("user_id", ownerId)
      .single();

    const connectedStore = normalizeShop(settings?.store_domain || null);
    if (!effectiveShop && connectedStore) {
      effectiveShop = connectedStore;
    }

    const hasExistingConnection =
      !!connectedStore &&
      (!requestedShop || connectedStore === requestedShop) &&
      settings?.connected_via_oauth &&
      !!settings?.admin_access_token;
    const hasActiveBilling = hasBillingAccess(settings?.billing_status, user.email);
    const hasConnectionAccess = hasShopifyConnectionAccess(hasExistingConnection, user.email);

    if (!effectiveShop && hasConnectionAccess) {
      const dashboardUrl = new URL("/dashboard", request.url);
      if (shopifyStatus) {
        dashboardUrl.searchParams.set("shopify", shopifyStatus);
      }
      if (request.nextUrl.searchParams.get("billing") === "active") {
        dashboardUrl.searchParams.set("billing", "active");
      }
      return NextResponse.redirect(dashboardUrl);
    }

    if (hasConnectionAccess && hasActiveBilling) {
      const destination = shopifyStatus === "connected" ? "/settings" : "/dashboard";
      const dashboardUrl = new URL(destination, request.url);
      if (shopifyStatus) {
        dashboardUrl.searchParams.set("shopify", shopifyStatus);
      }
      if (request.nextUrl.searchParams.get("billing") === "active") {
        dashboardUrl.searchParams.set("billing", "active");
      }
      if (effectiveShop) {
        dashboardUrl.searchParams.set("shop", effectiveShop);
      }
      if (host) {
        dashboardUrl.searchParams.set("host", host);
      }
      return NextResponse.redirect(dashboardUrl);
    }

    if (hasConnectionAccess && !hasActiveBilling) {
      const billingUrl = new URL("/api/shopify/billing/ensure", request.url);
      if (effectiveShop) {
        billingUrl.searchParams.set("shop", effectiveShop);
      }
      if (host) {
        billingUrl.searchParams.set("host", host);
      }
      return NextResponse.redirect(billingUrl);
    }
  }

  if (!effectiveShop) {
    return NextResponse.json(
      { error: "Missing or invalid shop parameter" },
      { status: 400 },
    );
  }

  const authPath = `/api/shopify/auth?shop=${encodeURIComponent(effectiveShop)}${host ? `&host=${encodeURIComponent(host)}` : ""}`;
  return NextResponse.redirect(new URL(authPath, request.url));
}

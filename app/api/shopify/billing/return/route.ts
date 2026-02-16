import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getShopifyActiveSubscription } from "@/lib/shopify";
import { getManagedPricingPlansUrl, isBillingActive, isBillingBypassEnabled, subscriptionToBillingFields } from "@/lib/shopify-billing";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

function decodeHostParam(host: string | null): string | null {
  if (!host) return null;
  try {
    const base64 = host.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    return Buffer.from(padded, "base64").toString("utf8");
  } catch {
    return null;
  }
}

function normalizeShopDomain(value: string | null | undefined): string | null {
  if (!value) return null;
  const shop = value.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
  if (!shop.endsWith(".myshopify.com")) return null;
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(shop)) return null;
  return shop;
}

function inferShopFromDecodedHost(decodedHost: string | null): string | null {
  if (!decodedHost) return null;

  const myShopifyMatch = decodedHost.match(/([a-z0-9][a-z0-9-]*\.myshopify\.com)/i);
  if (myShopifyMatch?.[1]) {
    return normalizeShopDomain(myShopifyMatch[1]);
  }

  // New Shopify Admin URLs look like: admin.shopify.com/store/{store_handle}
  const storeHandleMatch = decodedHost.match(/\/store\/([a-z0-9-]+)/i);
  if (storeHandleMatch?.[1]) {
    return normalizeShopDomain(`${storeHandleMatch[1]}.myshopify.com`);
  }

  return null;
}

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

  const decodedHost = decodeHostParam(host);
  let normalizedShop = normalizeShopDomain(shop) || inferShopFromDecodedHost(decodedHost);
  const supabaseAdmin = createAdminClient();
  let settings:
    | {
        user_id: string;
        store_domain: string;
        admin_access_token: string | null;
      }
    | null = null;

  if (normalizedShop) {
    const { data } = await supabaseAdmin
      .from("shopify_settings")
      .select("user_id, store_domain, admin_access_token")
      .eq("store_domain", normalizedShop)
      .single();
    settings = data;
  }

  // Fallback: if we still don't have a shop, try current logged-in owner settings.
  if (!settings) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, owner_id")
        .eq("id", user.id)
        .single();

      const ownerId = profile?.role === "owner" ? user.id : profile?.owner_id;
      if (ownerId) {
        const { data } = await supabaseAdmin
          .from("shopify_settings")
          .select("user_id, store_domain, admin_access_token")
          .eq("user_id", ownerId)
          .single();
        settings = data;
        normalizedShop = normalizeShopDomain(data?.store_domain);
      }
    }
  }

  if (!normalizedShop || !settings?.admin_access_token) {
    const loginUrl = new URL("/auth/login", request.url);
    const nextInstallUrl = new URL("/api/shopify/install", request.url);
    if (normalizedShop) {
      nextInstallUrl.searchParams.set("shop", normalizedShop);
    }
    nextInstallUrl.searchParams.set("shopify", "connected");
    if (host) {
      nextInstallUrl.searchParams.set("host", host);
    }
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

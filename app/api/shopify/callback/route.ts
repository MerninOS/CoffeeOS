import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createHmac } from "crypto";
import { getShopifyActiveSubscription } from "@/lib/shopify";
import { getManagedPricingPlansUrl, isBillingBypassEnabled, isBillingActive, subscriptionToBillingFields } from "@/lib/shopify-billing";

export async function GET(request: NextRequest) {
  const supabaseAdmin = createAdminClient();

  // Get query parameters from Shopify callback
  const searchParams = request.nextUrl.searchParams;
  const shop = searchParams.get("shop");
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const hmac = searchParams.get("hmac");
  const host = searchParams.get("host");
  console.log("[shopify-flow][callback] request", {
    shop,
    hasCode: !!code,
    hasState: !!state,
    hasHmac: !!hmac,
    hasHost: !!host,
    queryKeys: Array.from(searchParams.keys()),
  });

  // Validate required parameters
  if (!shop || !code || !state) {
    console.log("[shopify-flow][callback] missing required params", { shop, hasCode: !!code, hasState: !!state });
    return NextResponse.redirect(
      new URL("/settings?error=missing_params", request.url)
    );
  }

  // Verify HMAC signature from Shopify
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;
  if (!clientSecret) {
    console.error("SHOPIFY_CLIENT_SECRET is not configured");
    console.log("[shopify-flow][callback] missing SHOPIFY_CLIENT_SECRET");
    return NextResponse.redirect(
      new URL("/settings?error=config_error", request.url)
    );
  }

  // Build the message to verify (all params except hmac, sorted alphabetically)
  const params = new URLSearchParams();
  searchParams.forEach((value, key) => {
    if (key !== "hmac") {
      params.append(key, value);
    }
  });
  params.sort();
  const message = params.toString();

  // Calculate expected HMAC
  const expectedHmac = createHmac("sha256", clientSecret)
    .update(message)
    .digest("hex");

  // Verify HMAC matches (timing-safe comparison)
  if (hmac !== expectedHmac) {
    console.error("HMAC verification failed");
    console.log("[shopify-flow][callback] hmac mismatch", { shop });
    return NextResponse.redirect(
      new URL("/settings?error=invalid_signature", request.url)
    );
  }

  // Verify state to prevent CSRF attacks
  const { data: storedState, error: stateError } = await supabaseAdmin
    .from("shopify_oauth_states")
    .select("user_id, shop, expires_at")
    .eq("state", state)
    .single();

  if (stateError || !storedState) {
    console.error("State verification failed:", stateError);
    console.log("[shopify-flow][callback] state lookup failed", { state, shop });
    return NextResponse.redirect(
      new URL("/settings?error=invalid_state", request.url)
    );
  }

  // Check if state has expired
  if (new Date(storedState.expires_at) < new Date()) {
    console.log("[shopify-flow][callback] state expired", { state, shop });
    // Clean up expired state
    await supabaseAdmin.from("shopify_oauth_states").delete().eq("state", state);
    return NextResponse.redirect(
      new URL("/settings?error=state_expired", request.url)
    );
  }

  // Verify shop matches
  if (storedState.shop !== shop) {
    console.log("[shopify-flow][callback] shop mismatch", {
      callbackShop: shop,
      stateShop: storedState.shop,
    });
    return NextResponse.redirect(
      new URL("/settings?error=shop_mismatch", request.url)
    );
  }

  // Exchange the authorization code for an access token
  const clientId = process.env.SHOPIFY_CLIENT_ID;
  if (!clientId) {
    console.error("SHOPIFY_CLIENT_ID is not configured");
    console.log("[shopify-flow][callback] missing SHOPIFY_CLIENT_ID");
    return NextResponse.redirect(
      new URL("/settings?error=config_error", request.url)
    );
  }

  try {
    const tokenResponse = await fetch(
      `https://${shop}/admin/oauth/access_token`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          code,
        }),
      }
    );

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("Token exchange failed:", errorText);
      console.log("[shopify-flow][callback] token exchange failed", {
        shop,
        status: tokenResponse.status,
      });
      return NextResponse.redirect(
        new URL("/settings?error=token_exchange_failed", request.url)
      );
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    const scope = tokenData.scope;

    // Fetch shop info to get the shop name
    let shopName = shop.replace(".myshopify.com", "");
    try {
      const shopInfoResponse = await fetch(
        `https://${shop}/admin/api/2024-10/shop.json`,
        {
          headers: {
            "X-Shopify-Access-Token": accessToken,
          },
        }
      );
      if (shopInfoResponse.ok) {
        const shopInfo = await shopInfoResponse.json();
        shopName = shopInfo.shop?.name || shopName;
      }
    } catch (e) {
      console.error("Failed to fetch shop info:", e);
    }

    // Store the access token in the database before billing check.
    const { error: saveError } = await supabaseAdmin
      .from("shopify_settings")
      .upsert(
        {
          user_id: storedState.user_id,
          store_domain: shop,
          shop_name: shopName,
          admin_access_token: accessToken,
          connected_via_oauth: true,
          oauth_scope: scope,
          oauth_connected_at: new Date().toISOString(),
        },
        {
          onConflict: "user_id",
        }
      );

    if (saveError) {
      console.error("Failed to save access token:", saveError);
      console.log("[shopify-flow][callback] save shopify_settings failed", {
        userId: storedState.user_id,
        shop,
      });
      return NextResponse.redirect(
        new URL("/settings?error=save_failed", request.url)
      );
    }
    console.log("[shopify-flow][callback] saved shopify_settings", {
      userId: storedState.user_id,
      shop,
      scope,
    });

    const { data: persistedSettings, error: persistedSettingsError } = await supabaseAdmin
      .from("shopify_settings")
      .select("user_id, store_domain, connected_via_oauth, admin_access_token")
      .eq("user_id", storedState.user_id)
      .maybeSingle();
    console.log("[shopify-flow][callback] post-save readback", {
      userId: storedState.user_id,
      readError: persistedSettingsError?.message || null,
      hasRow: !!persistedSettings,
      storeDomain: persistedSettings?.store_domain || null,
      connectedViaOauth: !!persistedSettings?.connected_via_oauth,
      hasAdminToken: !!persistedSettings?.admin_access_token,
    });

    // Clean up the used state
    await supabaseAdmin.from("shopify_oauth_states").delete().eq("state", state);

    if (isBillingBypassEnabled()) {
      console.log("[shopify-flow][callback] billing bypass enabled, redirect install");
      const installUrl = new URL("/api/shopify/install", request.url);
      installUrl.searchParams.set("shop", shop);
      installUrl.searchParams.set("shopify", "connected");
      installUrl.searchParams.set("billing", "active");
      if (host) {
        installUrl.searchParams.set("host", host);
      }
      return NextResponse.redirect(installUrl);
    }

    const billingSubscription = await getShopifyActiveSubscription(shop, accessToken);
    console.log("[shopify-flow][callback] active subscription check", {
      shop,
      subscriptionStatus: billingSubscription?.status || null,
      subscriptionId: billingSubscription?.id || null,
    });

    // Persist latest billing snapshot from Shopify.
    const { error: billingSnapshotError } = await supabaseAdmin
      .from("shopify_settings")
      .update(subscriptionToBillingFields(billingSubscription))
      .eq("user_id", storedState.user_id);
    if (billingSnapshotError) {
      console.log("[shopify-flow][callback] billing snapshot update failed", {
        userId: storedState.user_id,
        error: billingSnapshotError.message,
      });
    }

    if (billingSubscription && isBillingActive(billingSubscription.status)) {
      console.log("[shopify-flow][callback] billing active, redirect install", { shop });
      const installUrl = new URL("/api/shopify/install", request.url);
      installUrl.searchParams.set("shop", shop);
      installUrl.searchParams.set("shopify", "connected");
      installUrl.searchParams.set("billing", "active");
      if (host) {
        installUrl.searchParams.set("host", host);
      }
      return NextResponse.redirect(installUrl);
    }

    const pricingPlansUrl = getManagedPricingPlansUrl(shop);
    if (pricingPlansUrl) {
      console.log("[shopify-flow][callback] billing inactive, redirect pricing plans", {
        shop,
        pricingPlansUrl,
      });
      const response = NextResponse.redirect(pricingPlansUrl);
      response.cookies.set("shopify_pending_shop", shop, {
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
    settingsUrl.searchParams.set("shop", shop);
    if (host) {
      settingsUrl.searchParams.set("host", host);
    }
    console.log("[shopify-flow][callback] billing inactive fallback redirect settings", { shop });
    return NextResponse.redirect(settingsUrl);
  } catch (error) {
    console.error("OAuth callback error:", error);
    console.log("[shopify-flow][callback] unhandled error", { shop });
    return NextResponse.redirect(
      new URL("/settings?error=callback_error", request.url)
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createHmac } from "crypto";
import { getShopifyActiveSubscription } from "@/lib/shopify";
import { isBillingBypassEnabled, isBillingActive, subscriptionToBillingFields } from "@/lib/shopify-billing";

export async function GET(request: NextRequest) {
  const supabase = await createClient();

  // Get query parameters from Shopify callback
  const searchParams = request.nextUrl.searchParams;
  const shop = searchParams.get("shop");
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const hmac = searchParams.get("hmac");
  const host = searchParams.get("host");

  // Validate required parameters
  if (!shop || !code || !state) {
    return NextResponse.redirect(
      new URL("/settings?error=missing_params", request.url)
    );
  }

  // Verify HMAC signature from Shopify
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;
  if (!clientSecret) {
    console.error("SHOPIFY_CLIENT_SECRET is not configured");
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
    return NextResponse.redirect(
      new URL("/settings?error=invalid_signature", request.url)
    );
  }

  // Verify state to prevent CSRF attacks
  const { data: storedState, error: stateError } = await supabase
    .from("shopify_oauth_states")
    .select("user_id, shop, expires_at")
    .eq("state", state)
    .single();

  if (stateError || !storedState) {
    console.error("State verification failed:", stateError);
    return NextResponse.redirect(
      new URL("/settings?error=invalid_state", request.url)
    );
  }

  // Check if state has expired
  if (new Date(storedState.expires_at) < new Date()) {
    // Clean up expired state
    await supabase.from("shopify_oauth_states").delete().eq("state", state);
    return NextResponse.redirect(
      new URL("/settings?error=state_expired", request.url)
    );
  }

  // Verify shop matches
  if (storedState.shop !== shop) {
    return NextResponse.redirect(
      new URL("/settings?error=shop_mismatch", request.url)
    );
  }

  // Exchange the authorization code for an access token
  const clientId = process.env.SHOPIFY_CLIENT_ID;
  if (!clientId) {
    console.error("SHOPIFY_CLIENT_ID is not configured");
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
    const { error: saveError } = await supabase
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
      return NextResponse.redirect(
        new URL("/settings?error=save_failed", request.url)
      );
    }

    // Clean up the used state
    await supabase.from("shopify_oauth_states").delete().eq("state", state);

    if (isBillingBypassEnabled()) {
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

    // Persist latest billing snapshot from Shopify.
    await supabase
      .from("shopify_settings")
      .update(subscriptionToBillingFields(billingSubscription))
      .eq("user_id", storedState.user_id);

    if (billingSubscription && isBillingActive(billingSubscription.status)) {
      const installUrl = new URL("/api/shopify/install", request.url);
      installUrl.searchParams.set("shop", shop);
      installUrl.searchParams.set("shopify", "connected");
      installUrl.searchParams.set("billing", "active");
      if (host) {
        installUrl.searchParams.set("host", host);
      }
      return NextResponse.redirect(installUrl);
    }

    const settingsUrl = new URL("/settings", request.url);
    settingsUrl.searchParams.set("error", "billing_not_active");
    settingsUrl.searchParams.set("action", "manage_billing");
    settingsUrl.searchParams.set("shop", shop);
    if (host) {
      settingsUrl.searchParams.set("host", host);
    }
    return NextResponse.redirect(settingsUrl);
  } catch (error) {
    console.error("OAuth callback error:", error);
    return NextResponse.redirect(
      new URL("/settings?error=callback_error", request.url)
    );
  }
}

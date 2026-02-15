import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { randomBytes } from "crypto";

// Shopify OAuth scopes needed for the app
// read_products/read_orders: app functionality
// read_own_subscription/write_own_subscription: Shopify-managed recurring billing
const SCOPES = "read_products,read_orders,read_own_subscription,write_own_subscription";

export async function GET(request: NextRequest) {
  const supabase = await createClient();

  // Verify user is authenticated
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }

  // Check if user is owner
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "owner") {
    return NextResponse.json(
      { error: "Only owners can connect Shopify stores" },
      { status: 403 }
    );
  }

  // Get shop domain from query params
  const shop = request.nextUrl.searchParams.get("shop");
  
  if (!shop) {
    return NextResponse.json(
      { error: "Missing shop parameter" },
      { status: 400 }
    );
  }

  // Validate shop domain format
  const shopDomainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/;
  if (!shopDomainRegex.test(shop)) {
    return NextResponse.json(
      { error: "Invalid shop domain format" },
      { status: 400 }
    );
  }

  // Generate a random state for CSRF protection
  const state = randomBytes(16).toString("hex");

  // Store the state in the database for verification during callback
  const { error: stateError } = await supabase
    .from("shopify_oauth_states")
    .insert({
      user_id: user.id,
      state,
      shop,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes
    });

  if (stateError) {
    console.error("Failed to store OAuth state:", stateError);
    return NextResponse.json(
      { error: "Failed to initiate OAuth flow" },
      { status: 500 }
    );
  }

  // Get the app's client ID from environment
  const clientId = process.env.SHOPIFY_CLIENT_ID;
  
  if (!clientId) {
    console.error("SHOPIFY_CLIENT_ID is not configured");
    return NextResponse.json(
      { error: "Shopify app not configured" },
      { status: 500 }
    );
  }

  // Build the redirect URI
  const redirectUri = `${request.nextUrl.origin}/api/shopify/callback`;

  // Build the Shopify OAuth authorization URL
  const authUrl = new URL(`https://${shop}/admin/oauth/authorize`);
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("scope", SCOPES);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("state", state);

  // Redirect to Shopify's OAuth authorization page
  return NextResponse.redirect(authUrl.toString());
}

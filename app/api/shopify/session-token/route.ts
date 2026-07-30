import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyShopifySessionToken } from "@/lib/shopify-block/session";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const token = body?.token;

  if (!token || typeof token !== "string") {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  const secret = process.env.SHOPIFY_CLIENT_SECRET;
  const clientId = process.env.SHOPIFY_CLIENT_ID;
  if (!secret || !clientId) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const session = verifyShopifySessionToken(token, secret, clientId);
  if (!session) {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
  }
  const shop = session.shop;

  const supabaseAdmin = createAdminClient();

  // Find the owner user_id for this shop domain
  const { data: settings } = await supabaseAdmin
    .from("shopify_settings")
    .select("user_id")
    .eq("store_domain", shop)
    .maybeSingle();

  if (!settings?.user_id) {
    console.log("[shopify-session-token] shop not found", { shop });
    return NextResponse.json(
      { error: "Shop not connected to a CoffeeOS account" },
      { status: 404 }
    );
  }

  // Look up the user's email to generate a magic link token
  const { data: userData } = await supabaseAdmin.auth.admin.getUserById(settings.user_id);
  if (!userData?.user?.email) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Generate a one-time sign-in token (does not send an email)
  const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
    type: "magiclink",
    email: userData.user.email,
  });

  if (linkError || !linkData?.properties?.hashed_token) {
    console.error("[shopify-session-token] generateLink failed", linkError);
    return NextResponse.json({ error: "Token generation failed" }, { status: 500 });
  }

  return NextResponse.json({ token_hash: linkData.properties.hashed_token });
}

import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";

function verifyShopifySessionToken(token: string, secret: string) {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [header, payload, signature] = parts;

  const expectedSig = createHmac("sha256", secret)
    .update(`${header}.${payload}`)
    .digest("base64url");

  if (expectedSig !== signature) return null;

  let payloadData: Record<string, unknown>;
  try {
    payloadData = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  if (typeof payloadData.exp === "number" && payloadData.exp < Math.floor(Date.now() / 1000)) {
    return null;
  }

  return payloadData;
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const token = body?.token;

  if (!token || typeof token !== "string") {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  const secret = process.env.SHOPIFY_CLIENT_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const payload = verifyShopifySessionToken(token, secret);
  if (!payload) {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
  }

  // Extract shop hostname from dest (e.g. "https://my-store.myshopify.com")
  let shop: string;
  try {
    shop = new URL(payload.dest as string).hostname.toLowerCase();
  } catch {
    return NextResponse.json({ error: "Invalid token payload" }, { status: 401 });
  }

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

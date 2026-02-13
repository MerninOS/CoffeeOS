import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";

function validShop(shop: string): boolean {
  return /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/.test(shop);
}

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.SHOPIFY_CLIENT_SECRET;
  const hmacHeader = request.headers.get("x-shopify-hmac-sha256");
  const shopDomain = request.headers.get("x-shopify-shop-domain");

  if (!webhookSecret || !hmacHeader || !shopDomain || !validShop(shopDomain)) {
    return NextResponse.json({ error: "Invalid webhook request" }, { status: 401 });
  }

  const rawBody = await request.text();
  const digest = createHmac("sha256", webhookSecret)
    .update(rawBody, "utf8")
    .digest("base64");

  const hmacBuffer = Buffer.from(hmacHeader, "utf8");
  const digestBuffer = Buffer.from(digest, "utf8");
  const validSignature =
    hmacBuffer.length === digestBuffer.length &&
    timingSafeEqual(hmacBuffer, digestBuffer);

  if (!validSignature) {
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
  }

  const supabaseAdmin = createAdminClient();
  const { error } = await supabaseAdmin
    .from("shopify_settings")
    .delete()
    .eq("store_domain", shopDomain);

  if (error) {
    console.error("Failed to clean up uninstalled shop:", error);
    return NextResponse.json({ error: "Failed to process webhook" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}


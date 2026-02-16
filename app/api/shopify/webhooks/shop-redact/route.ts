import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyShopifyWebhook } from "@/lib/shopify-webhooks";

export async function POST(request: NextRequest) {
  const verification = await verifyShopifyWebhook(request);
  if (!verification.ok) {
    return verification.response;
  }

  const { topic, shopDomain, webhookId } = verification.webhook;
  if (topic !== "shop/redact") {
    return NextResponse.json({ error: "Unexpected webhook topic" }, { status: 400 });
  }

  console.log("[shopify-webhook][shop-redact] received", { shopDomain, webhookId });

  const supabaseAdmin = createAdminClient();
  const { error } = await supabaseAdmin
    .from("shopify_settings")
    .delete()
    .eq("store_domain", shopDomain);

  if (error) {
    console.error("Failed to process shop redact webhook:", error);
    return NextResponse.json({ error: "Failed to process webhook" }, { status: 500 });
  }

  console.log("[shopify-webhook][shop-redact] cleaned up", { shopDomain, webhookId });
  return NextResponse.json({ ok: true });
}

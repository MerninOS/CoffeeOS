import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyShopifyWebhook } from "@/lib/shopify-webhooks";

export async function POST(request: NextRequest) {
  const verification = await verifyShopifyWebhook(request);
  if (!verification.ok) {
    return verification.response;
  }
  const { shopDomain, topic, webhookId } = verification.webhook;

  if (topic !== "app/uninstalled") {
    console.log("[shopify-webhook][app-uninstalled] rejected unexpected topic", {
      topic,
      shopDomain,
      webhookId,
    });
    return NextResponse.json({ error: "Unexpected webhook topic" }, { status: 400 });
  }
  console.log("[shopify-webhook][app-uninstalled] received", { shopDomain, webhookId });

  const supabaseAdmin = createAdminClient();
  const { error } = await supabaseAdmin
    .from("shopify_settings")
    .delete()
    .eq("store_domain", shopDomain);

  if (error) {
    console.error("Failed to clean up uninstalled shop:", error);
    return NextResponse.json({ error: "Failed to process webhook" }, { status: 500 });
  }

  console.log("[shopify-webhook][app-uninstalled] cleaned up", { shopDomain, webhookId });
  return NextResponse.json({ ok: true });
}

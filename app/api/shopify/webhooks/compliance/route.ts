import { NextRequest, NextResponse } from "next/server";
import { verifyShopifyWebhook } from "@/lib/shopify-webhooks";

const COMPLIANCE_TOPICS = new Set([
  "customers/data_request",
  "customers/redact",
  "shop/redact",
]);

export async function POST(request: NextRequest) {
  const verification = await verifyShopifyWebhook(request);
  if (!verification.ok) {
    return verification.response;
  }

  const { topic, shopDomain, webhookId, body } = verification.webhook;
  if (!topic || !COMPLIANCE_TOPICS.has(topic)) {
    return NextResponse.json({ error: "Unexpected webhook topic" }, { status: 400 });
  }

  console.log("[shopify-webhook][compliance] received", {
    topic,
    shopDomain,
    webhookId,
    shopId: body.shop_id || null,
    customerId:
      body.customer && typeof body.customer === "object"
        ? (body.customer as Record<string, unknown>).id || null
        : null,
  });

  // Compliance webhooks are acknowledged immediately. Data export/redaction workflows
  // can be handled asynchronously.
  return NextResponse.json({ ok: true });
}

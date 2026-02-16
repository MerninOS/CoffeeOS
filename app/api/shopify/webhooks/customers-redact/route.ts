import { NextRequest, NextResponse } from "next/server";
import { verifyShopifyWebhook } from "@/lib/shopify-webhooks";

export async function POST(request: NextRequest) {
  const verification = await verifyShopifyWebhook(request);
  if (!verification.ok) {
    return verification.response;
  }

  const { topic, shopDomain, webhookId, body } = verification.webhook;
  if (topic !== "customers/redact") {
    return NextResponse.json({ error: "Unexpected webhook topic" }, { status: 400 });
  }

  console.log("[shopify-webhook][customers-redact] received", {
    shopDomain,
    webhookId,
    customerId: body.customer && typeof body.customer === "object"
      ? (body.customer as Record<string, unknown>).id || null
      : body.customer_id || null,
  });

  return NextResponse.json({ ok: true });
}

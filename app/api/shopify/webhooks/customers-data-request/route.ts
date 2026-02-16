import { NextRequest, NextResponse } from "next/server";
import { verifyShopifyWebhook } from "@/lib/shopify-webhooks";

export async function POST(request: NextRequest) {
  const verification = await verifyShopifyWebhook(request);
  if (!verification.ok) {
    return verification.response;
  }

  const { topic, shopDomain, webhookId, body } = verification.webhook;
  if (topic !== "customers/data_request") {
    return NextResponse.json({ error: "Unexpected webhook topic" }, { status: 400 });
  }

  console.log("[shopify-webhook][customers-data-request] received", {
    shopDomain,
    webhookId,
    customerId: body.customer && typeof body.customer === "object"
      ? (body.customer as Record<string, unknown>).id || null
      : null,
    ordersRequested: body.orders_requested || null,
  });

  return NextResponse.json({ ok: true });
}

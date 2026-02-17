import { NextRequest, NextResponse } from "next/server";
import { verifyShopifyWebhook } from "@/lib/shopify-webhooks";

const COMPLIANCE_TOPICS = new Set([
  "customers/data_request",
  "customers/redact",
  "shop/redact",
]);

export async function GET(request: NextRequest) {
  console.log("[shopify-webhook][compliance] GET probe", {
    path: request.nextUrl.pathname,
    userAgent: request.headers.get("user-agent"),
  });
  return NextResponse.json({ ok: true });
}

export async function OPTIONS(request: NextRequest) {
  console.log("[shopify-webhook][compliance] OPTIONS probe", {
    path: request.nextUrl.pathname,
    userAgent: request.headers.get("user-agent"),
  });
  return new NextResponse(null, {
    status: 204,
    headers: {
      Allow: "POST,GET,OPTIONS",
    },
  });
}

export async function POST(request: NextRequest) {
  const verification = await verifyShopifyWebhook(request);
  if (!verification.ok) {
    return verification.response;
  }

  const { topic, shopDomain, webhookId, body } = verification.webhook;
  if (!topic || !COMPLIANCE_TOPICS.has(topic)) {
    console.log("[shopify-webhook][compliance] rejected unexpected topic", {
      topic,
      shopDomain,
      webhookId,
      payloadKeys: Object.keys(body),
    });
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

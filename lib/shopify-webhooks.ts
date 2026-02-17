import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";

const SHOP_DOMAIN_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/;

export type VerifiedShopifyWebhook = {
  body: Record<string, unknown>;
  rawBody: string;
  shopDomain: string;
  topic: string | null;
  webhookId: string | null;
};

export async function verifyShopifyWebhook(
  request: NextRequest
): Promise<
  { ok: true; webhook: VerifiedShopifyWebhook } | { ok: false; response: NextResponse }
> {
  const path = request.nextUrl.pathname;
  const webhookSecret = process.env.SHOPIFY_API_SECRET || process.env.SHOPIFY_CLIENT_SECRET;
  const hmacHeader = request.headers.get("x-shopify-hmac-sha256");
  const shopDomain = request.headers.get("x-shopify-shop-domain");
  const topic = request.headers.get("x-shopify-topic");
  const webhookId = request.headers.get("x-shopify-webhook-id");
  console.log("[shopify-webhook][verify] incoming", {
    path,
    method: request.method,
    topic,
    shopDomain,
    webhookId,
    hasSecret: !!webhookSecret,
    hasHmacHeader: !!hmacHeader,
    contentType: request.headers.get("content-type"),
  });

  if (!webhookSecret || !hmacHeader || !shopDomain || !SHOP_DOMAIN_REGEX.test(shopDomain)) {
    console.log("[shopify-webhook][verify] rejected invalid request", {
      path,
      topic,
      shopDomain,
      webhookId,
      hasSecret: !!webhookSecret,
      hasHmacHeader: !!hmacHeader,
      hasShopDomain: !!shopDomain,
      shopDomainValid: !!shopDomain && SHOP_DOMAIN_REGEX.test(shopDomain),
    });
    return {
      ok: false,
      response: NextResponse.json({ error: "Invalid webhook request" }, { status: 401 }),
    };
  }

  const rawBodyBuffer = Buffer.from(await request.arrayBuffer());
  const rawBody = rawBodyBuffer.toString("utf8");
  const digest = createHmac("sha256", webhookSecret)
    .update(rawBodyBuffer)
    .digest("base64");

  const hmacBuffer = Buffer.from(hmacHeader, "base64");
  const digestBuffer = Buffer.from(digest, "base64");
  const validSignature =
    hmacBuffer.length === digestBuffer.length &&
    timingSafeEqual(hmacBuffer, digestBuffer);

  if (!validSignature) {
    console.log("[shopify-webhook][verify] rejected signature mismatch", {
      path,
      topic,
      shopDomain,
      webhookId,
      receivedLength: hmacBuffer.length,
      expectedLength: digestBuffer.length,
    });
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Invalid webhook signature" },
        { status: 401 }
      ),
    };
  }

  let body: Record<string, unknown>;
  try {
    const parsed = JSON.parse(rawBody) as unknown;
    body = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    console.log("[shopify-webhook][verify] rejected invalid JSON payload", {
      path,
      topic,
      shopDomain,
      webhookId,
      bodyBytes: rawBodyBuffer.length,
    });
    return {
      ok: false,
      response: NextResponse.json({ error: "Invalid webhook payload" }, { status: 400 }),
    };
  }

  console.log("[shopify-webhook][verify] success", {
    path,
    topic,
    shopDomain,
    webhookId,
    bodyBytes: rawBodyBuffer.length,
    payloadKeys: Object.keys(body),
  });

  return {
    ok: true,
    webhook: {
      body,
      rawBody,
      shopDomain,
      topic,
      webhookId,
    },
  };
}

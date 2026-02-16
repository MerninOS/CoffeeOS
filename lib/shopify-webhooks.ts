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
  const webhookSecret = process.env.SHOPIFY_CLIENT_SECRET;
  const hmacHeader = request.headers.get("x-shopify-hmac-sha256");
  const shopDomain = request.headers.get("x-shopify-shop-domain");
  const topic = request.headers.get("x-shopify-topic");
  const webhookId = request.headers.get("x-shopify-webhook-id");

  if (!webhookSecret || !hmacHeader || !shopDomain || !SHOP_DOMAIN_REGEX.test(shopDomain)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Invalid webhook request" }, { status: 401 }),
    };
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
    return {
      ok: false,
      response: NextResponse.json({ error: "Invalid webhook payload" }, { status: 400 }),
    };
  }

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

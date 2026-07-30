/**
 * Block routes are called cross-origin from Shopify's extension sandbox
 * (extensions.shopifycdn.com), so every response needs CORS headers and every
 * route needs an OPTIONS preflight handler. Auth is bearer-token (never
 * cookies), which is why a wildcard origin is acceptable here.
 */
import { NextResponse } from "next/server";

export const BLOCK_CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
} as const;

export function blockJson(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: BLOCK_CORS_HEADERS });
}

export function blockOptions(): NextResponse {
  return new NextResponse(null, { status: 204, headers: BLOCK_CORS_HEADERS });
}

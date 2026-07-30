/**
 * Shopify session-token (App Bridge / admin-extension ID token) verification.
 *
 * Extracted from app/api/shopify/session-token/route.ts and hardened with two
 * fixes the original inline copy was missing:
 *
 * 1. `aud` check: without it, a session token minted for a DIFFERENT Shopify
 *    app (same shop, attacker-owned app) verifies successfully, because all
 *    session tokens for a shop are signed per-app but the shop can install
 *    many apps. `aud` must be OUR client id.
 * 2. `exp` is now required, not merely checked when present: the original
 *    inline check was `typeof exp === "number" && exp < now`, which silently
 *    ACCEPTED a token with no `exp` claim at all, forever. This version
 *    requires `exp` to be a number and not yet elapsed.
 *
 * The shop is taken ONLY from the verified `dest` claim — never from a query
 * param or header, which the caller controls.
 */
import { createHmac, timingSafeEqual } from "crypto";

export interface VerifiedShopifySession {
  shop: string;
}

export function verifyShopifySessionToken(
  token: string,
  secret: string,
  clientId: string
): VerifiedShopifySession | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [header, payload, signature] = parts;

  // The signing algorithm is hardcoded to HMAC-SHA256 deliberately and must
  // never be dispatched off the header's `alg` claim (that claim is
  // attacker-controlled input, and dispatching on it is the classic JWT
  // "alg confusion" vulnerability). We simply ignore `header` beyond using
  // its raw bytes in the signature input below.
  const expectedSig = createHmac("sha256", secret)
    .update(`${header}.${payload}`)
    .digest("base64url");

  // timing-safe: both sides are our own digest encoding, equal length or reject
  const a = Buffer.from(expectedSig);
  const b = Buffer.from(signature);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return null;
  }
  const payloadData = parsed as Record<string, unknown>;

  if (typeof payloadData.exp !== "number" || payloadData.exp < Math.floor(Date.now() / 1000)) {
    return null;
  }

  const aud = payloadData.aud;
  const audOk =
    aud === clientId || (Array.isArray(aud) && aud.includes(clientId));
  if (!audOk) return null;

  let shop: string;
  try {
    shop = new URL(payloadData.dest as string).hostname.toLowerCase();
  } catch {
    return null;
  }
  if (!shop) return null;

  return { shop };
}

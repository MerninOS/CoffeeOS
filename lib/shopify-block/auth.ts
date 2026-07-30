/**
 * Resolve a block request's Authorization header to a CoffeeOS tenant.
 *
 * The shop comes ONLY from the verified session token (lib/shopify-block/
 * session.ts) — never from the request body or query string. Everything the
 * routes do afterwards is scoped by the returned userId; that scoping is the
 * multi-tenant boundary, so no route may query without it.
 *
 * Deps are injected so the resolution logic is unit-testable without a
 * Supabase client; blockContextFromRequest wires the real ones.
 */
import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyShopifySessionToken } from "@/lib/shopify-block/session";

export interface ShopSettingsRow {
  user_id: string;
  store_domain: string;
  admin_access_token: string | null;
}

export type BlockContext =
  | {
      ok: true;
      userId: string;
      storeDomain: string;
      adminAccessToken: string | null;
    }
  | { ok: false; status: number; error: string };

export interface BlockAuthDeps {
  secret: string;
  clientId: string;
  getSettingsByShop: (shop: string) => Promise<ShopSettingsRow | null>;
}

export async function resolveBlockContext(
  authHeader: string | null,
  deps: BlockAuthDeps
): Promise<BlockContext> {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { ok: false, status: 401, error: "Missing bearer token" };
  }

  const session = verifyShopifySessionToken(
    authHeader.slice("Bearer ".length),
    deps.secret,
    deps.clientId
  );
  if (!session) {
    return { ok: false, status: 401, error: "Invalid or expired token" };
  }

  const settings = await deps.getSettingsByShop(session.shop);
  if (!settings?.user_id) {
    return {
      ok: false,
      status: 404,
      error: "This store is not connected to a CoffeeOS account",
    };
  }

  return {
    ok: true,
    userId: settings.user_id,
    storeDomain: settings.store_domain,
    adminAccessToken: settings.admin_access_token,
  };
}

/** Route-handler entrypoint: reads env + the real shopify_settings lookup. */
export async function blockContextFromRequest(
  request: NextRequest
): Promise<BlockContext> {
  const secret = process.env.SHOPIFY_CLIENT_SECRET;
  const clientId = process.env.SHOPIFY_CLIENT_ID;
  if (!secret || !clientId) {
    return { ok: false, status: 500, error: "Server misconfigured" };
  }

  return resolveBlockContext(request.headers.get("authorization"), {
    secret,
    clientId,
    getSettingsByShop: async (shop) => {
      const supabaseAdmin = createAdminClient();
      const { data } = await supabaseAdmin
        .from("shopify_settings")
        .select("user_id, store_domain, admin_access_token")
        .eq("store_domain", shop)
        .maybeSingle();
      return (data as ShopSettingsRow | null) ?? null;
    },
  });
}

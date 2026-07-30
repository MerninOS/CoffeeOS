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
  /**
   * May reject — e.g. the real Supabase-backed implementation throws when
   * the lookup itself fails (including the "more than one row" case, since
   * store_domain has no unique constraint). resolveBlockContext treats a
   * rejection as a distinguishable 500, never as "not connected" (404).
   */
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

  let settings: ShopSettingsRow | null;
  try {
    settings = await deps.getSettingsByShop(session.shop);
  } catch {
    // A rejected lookup is a data/infra fault, not "shop not connected" —
    // keep it a distinct 500 so it can never be mistaken for the 404 case.
    return { ok: false, status: 500, error: "Settings lookup failed" };
  }
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
      const { data, error } = await supabaseAdmin
        .from("shopify_settings")
        .select("user_id, store_domain, admin_access_token")
        .eq("store_domain", shop)
        .maybeSingle();
      if (error) {
        // PGRST116 here means MORE THAN ONE settings row for this shop —
        // store_domain has no unique constraint. Never silently treat that
        // as "not connected": it is a data-integrity fault, not a missing
        // install.
        console.error("[shopify-block] shopify_settings lookup failed", {
          shop,
          code: error.code,
          message: error.message,
        });
        throw new Error("Settings lookup failed");
      }
      return (data as ShopSettingsRow | null) ?? null;
    },
  });
}

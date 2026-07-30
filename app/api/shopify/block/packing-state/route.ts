import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { blockContextFromRequest } from "@/lib/shopify-block/auth";
import { blockJson, blockOptions } from "@/lib/shopify-block/http";
import { fetchShopifyOrderById } from "@/lib/shopify";
import { upsertShopifyOrder } from "@/lib/orders/sync";
import { getPackingState } from "@/lib/orders/packing-state";

// Shopify numeric ids (the block sends the trailing segment of a
// `gid://shopify/Order/<id>` gid) are unsigned integers. Real ids are well
// under this many digits; the cap just keeps a pathological input from
// reaching a query or an outbound Shopify API call.
const SHOPIFY_ORDER_ID_PATTERN = /^\d{1,32}$/;

export async function GET(request: NextRequest) {
  const ctx = await blockContextFromRequest(request);
  if (!ctx.ok) return blockJson({ error: ctx.error }, ctx.status);

  const shopifyOrderId = request.nextUrl.searchParams.get("shopify_order_id");
  if (!shopifyOrderId || !SHOPIFY_ORDER_ID_PATTERN.test(shopifyOrderId)) {
    return blockJson({ error: "Missing or invalid shopify_order_id" }, 400);
  }

  const supabase = createAdminClient();

  // getPackingState THROWS on infra/query failure and returns null only for
  // a genuine "no matching order for this tenant" — both calls below must be
  // wrapped, or a throw becomes an unhandled exception (a framework 500 with
  // no CORS headers, which the block sees as an opaque network failure
  // rather than a readable error).
  let state;
  try {
    state = await getPackingState(supabase, ctx.userId, shopifyOrderId);
  } catch (e) {
    console.error("[block/packing-state] getPackingState failed", e);
    return blockJson({ error: "Could not load packing state for this order" }, 500);
  }

  if (!state) {
    // Sync-on-demand: the block can open an order CoffeeOS has never seen.
    //
    // Tenant isolation: the `null` above only means "no row for this
    // shopify_order_id scoped to ctx.userId" — it does NOT mean the order
    // doesn't exist anywhere, so it's not evidence this id is safe to
    // import under this tenant. What actually makes the import safe is
    // fetchShopifyOrderById below: it calls shop-scoped Shopify Admin API
    // (ctx.storeDomain + ctx.adminAccessToken), and Shopify order ids are
    // globally unique and only resolvable through the token of the shop
    // that owns them. So if an operator on shop A requests an id belonging
    // to shop B, this fetch returns null (404 "not found on Shopify") —
    // shop A's token simply cannot see shop B's order. The upsert that
    // follows is therefore never reachable for another tenant's order.
    if (!ctx.adminAccessToken) {
      return blockJson(
        { error: "Shopify admin access is not configured for this store" },
        409
      );
    }
    let order;
    try {
      order = await fetchShopifyOrderById(
        ctx.storeDomain,
        ctx.adminAccessToken,
        shopifyOrderId
      );
    } catch (e) {
      console.error("[block/packing-state] shopify fetch failed", e);
      return blockJson({ error: "Could not reach Shopify to load this order" }, 502);
    }
    if (!order) return blockJson({ error: "Order not found on Shopify" }, 404);

    const { data: products, error: productsError } = await supabase
      .from("products")
      .select("id, shopify_id")
      .eq("user_id", ctx.userId);

    // Do NOT fall back to `[] `on error: an empty productMap silently
    // unlinks every line item from its product, which makes the order
    // display as "items not linked" with near-zero COGS and no sign a
    // query failed — the exact failure mode getPackingState's contract
    // (see lib/orders/packing-state.ts) was hardened to prevent, one layer
    // up. Fail loudly instead.
    if (productsError) {
      console.error("[block/packing-state] products lookup failed", productsError);
      return blockJson({ error: "Could not load product links for this order" }, 500);
    }

    const productMap = new Map(
      (products || []).map((p) => [p.shopify_id as string, p.id as string])
    );

    const result = await upsertShopifyOrder(supabase, ctx.userId, order, productMap);
    if ("error" in result) {
      console.error("[block/packing-state] order upsert failed", result.error);
      return blockJson({ error: "Could not save this order" }, 500);
    }

    try {
      state = await getPackingState(supabase, ctx.userId, shopifyOrderId);
    } catch (e) {
      console.error("[block/packing-state] getPackingState failed after sync", e);
      return blockJson({ error: "Could not load packing state for this order" }, 500);
    }
  }

  if (!state) return blockJson({ error: "Order could not be loaded" }, 500);
  return blockJson({ state });
}

export const OPTIONS = blockOptions;

import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { blockContextFromRequest } from "@/lib/shopify-block/auth";
import { blockJson, blockOptions } from "@/lib/shopify-block/http";
import { getPackingState } from "@/lib/orders/packing-state";

// Kept in sync with packing/route.ts and packing-state/route.ts.
const SHOPIFY_ORDER_ID_PATTERN = /^\d{1,32}$/;

interface ShippingCostBody {
  shopifyOrderId: string;
  amount: number;
}

function parseBody(raw: unknown): ShippingCostBody | null {
  if (!raw || typeof raw !== "object") return null;
  const b = raw as Record<string, unknown>;
  if (typeof b.shopifyOrderId !== "string" || !SHOPIFY_ORDER_ID_PATTERN.test(b.shopifyOrderId))
    return null;
  if (typeof b.amount !== "number" || !Number.isFinite(b.amount) || b.amount < 0) return null;
  return { shopifyOrderId: b.shopifyOrderId, amount: b.amount };
}

export async function POST(request: NextRequest) {
  const ctx = await blockContextFromRequest(request);
  if (!ctx.ok) return blockJson({ error: ctx.error }, ctx.status);

  const body = parseBody(await request.json().catch(() => null));
  if (!body) return blockJson({ error: "Invalid request body" }, 400);

  const supabase = createAdminClient();

  // Scoped by user_id — the tenant boundary for both the lookup and the
  // write that follows (the update path targets a cost row by id, only
  // ever resolved off this order).
  const { data: order, error: orderLookupError } = await supabase
    .from("orders")
    .select("id")
    .eq("shopify_order_id", body.shopifyOrderId)
    .eq("user_id", ctx.userId)
    .maybeSingle();
  if (orderLookupError) {
    console.error("[block/shipping-cost] order lookup failed", orderLookupError);
    return blockJson({ error: "Could not load this order" }, 500);
  }
  if (!order) return blockJson({ error: "Order not found" }, 404);

  // Match "Shipping" case-insensitively, oldest first: adopts a row someone
  // typed by hand in the dashboard instead of duplicating it, and makes a
  // repeat save from the block update-in-place rather than accumulate rows.
  const { data: existingRows, error: existingError } = await supabase
    .from("order_custom_costs")
    .select("id")
    .eq("order_id", order.id)
    .ilike("description", "shipping")
    .order("created_at", { ascending: true })
    .limit(1);
  if (existingError) {
    console.error("[block/shipping-cost] existing cost lookup failed", existingError);
    return blockJson({ error: "Could not check for an existing shipping cost" }, 500);
  }
  const existing = existingRows?.[0];

  if (existing) {
    const { error: updateError } = await supabase
      .from("order_custom_costs")
      .update({ amount: body.amount })
      .eq("id", existing.id);
    if (updateError) {
      console.error("[block/shipping-cost] update failed", updateError);
      return blockJson({ error: "Could not save shipping cost" }, 500);
    }
  } else {
    const { error: insertError } = await supabase.from("order_custom_costs").insert({
      order_id: order.id,
      description: "Shipping",
      amount: body.amount,
    });
    if (insertError) {
      console.error("[block/shipping-cost] insert failed", insertError);
      return blockJson({ error: "Could not save shipping cost" }, 500);
    }
  }

  let state;
  try {
    state = await getPackingState(supabase, ctx.userId, body.shopifyOrderId);
  } catch (e) {
    console.error("[block/shipping-cost] getPackingState failed", e);
    return blockJson({ error: "Shipping cost saved, but could not reload order state" }, 500);
  }
  if (!state) return blockJson({ error: "Order could not be loaded" }, 500);

  return blockJson({ state });
}

export const OPTIONS = blockOptions;

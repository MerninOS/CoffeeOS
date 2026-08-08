/**
 * The single-order upsert shared by the dashboard's bulk sync
 * (app/(dashboard)/orders/actions.ts) and the admin block's sync-on-demand
 * (app/api/shopify/block/packing-state). One implementation so the two
 * entry points cannot drift on how an order row is shaped.
 *
 * Also the first writer of orders.total_shipping (migration 025): the
 * customer-paid shipping shown as a reference figure in the block.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { type ShopifyOrder, parseShopifyGid } from "@/lib/shopify";
import { computeProcessingFee } from "./fees";

export interface LineItemRow {
  shopify_line_item_id: string;
  shopify_product_id: string | null;
  shopify_variant_id: string | null;
  product_id: string | null;
  title: string;
  variant_title: string | null;
  sku: string | null;
  quantity: number;
  price: number;
  total_price: number;
}

// Postgrest errors carry code/details/hint alongside message — the fields
// that actually explain a constraint violation. The returned `{ error }`
// stays a plain string (callers union-match on it), but log the full object
// here, where it is available, so a failure is diagnosable from the logs.
function logSupabaseError(
  context: string,
  error: { message: string; code?: string; details?: string | null; hint?: string | null }
) {
  console.error(context, {
    message: error.message,
    code: error.code,
    details: error.details,
    hint: error.hint,
  });
}

export function buildLineItemRows(
  order: ShopifyOrder,
  productMap: Map<string, string>
): LineItemRow[] {
  return order.lineItems.edges.map(({ node: lineItem }) => {
    const shopifyProductId = lineItem.product
      ? parseShopifyGid(lineItem.product.id)
      : null;
    const localProductId = shopifyProductId
      ? productMap.get(shopifyProductId) || null
      : null;

    const unitPrice = parseFloat(lineItem.discountedUnitPriceSet.shopMoney.amount);

    return {
      shopify_line_item_id: parseShopifyGid(lineItem.id),
      shopify_product_id: shopifyProductId,
      shopify_variant_id: null,
      product_id: localProductId,
      title: lineItem.title,
      variant_title: null,
      sku: lineItem.sku,
      quantity: lineItem.quantity,
      price: unitPrice,
      total_price: unitPrice * lineItem.quantity,
    };
  });
}

/**
 * The order-row shape both entry points write, extracted so the fee rule can
 * be tested without a Supabase mock.
 *
 * The fee fields are SPREAD IN ONLY WHEN KNOWN. computeProcessingFee returns
 * null for an order whose fee is not yet knowable (unpaid, malformed fee
 * payload) — omitting the keys makes the update leave any previously stored
 * fee untouched, where writing nulls would clobber a known figure because one
 * re-sync happened to get an odd payload. The unpaid→paid transition still
 * updates: once paid, the result is non-null and the keys are present.
 */
export function buildOrderFields(order: ShopifyOrder) {
  const processingFee = computeProcessingFee(order);

  return {
    shopify_order_number: order.name,
    order_name: order.name,
    created_at_shopify: order.createdAt,
    financial_status: order.displayFinancialStatus,
    fulfillment_status: order.displayFulfillmentStatus,
    subtotal_price: parseFloat(order.subtotalPriceSet.shopMoney.amount),
    total_tax: parseFloat(order.totalTaxSet.shopMoney.amount),
    total_price: parseFloat(order.totalPriceSet.shopMoney.amount),
    total_shipping: parseFloat(order.totalShippingPriceSet.shopMoney.amount),
    currency: order.totalPriceSet.shopMoney.currencyCode,
    synced_at: new Date().toISOString(),
    ...(processingFee
      ? {
          total_processing_fee: processingFee.fee,
          processing_fee_source: processingFee.source,
        }
      : {}),
  };
}

export async function upsertShopifyOrder(
  supabase: SupabaseClient,
  ownerId: string,
  order: ShopifyOrder,
  productMap: Map<string, string>
): Promise<{ orderId: string } | { error: string }> {
  const shopifyOrderId = parseShopifyGid(order.id);

  const orderFields = buildOrderFields(order);

  const { data: existingOrder } = await supabase
    .from("orders")
    .select("id")
    .eq("shopify_order_id", shopifyOrderId)
    .eq("user_id", ownerId)
    .maybeSingle();

  let orderId: string;

  if (existingOrder) {
    const { error } = await supabase
      .from("orders")
      .update(orderFields)
      .eq("id", existingOrder.id);
    if (error) {
      logSupabaseError("Order update error:", error);
      return { error: error.message };
    }
    orderId = existingOrder.id;
  } else {
    const { data: newOrder, error } = await supabase
      .from("orders")
      .insert({ user_id: ownerId, shopify_order_id: shopifyOrderId, ...orderFields })
      .select("id")
      .single();
    if (error || !newOrder) {
      if (error) logSupabaseError("Order insert error:", error);
      return { error: error?.message || "Order insert failed" };
    }
    orderId = newOrder.id;
  }

  // Delete-then-reinsert shape matches the existing sync behavior; unlike the
  // old fire-and-forget version, both halves now check for errors — a failed
  // delete must not be followed by an insert, or the order ends up with
  // duplicate line items.
  const { error: deleteError } = await supabase
    .from("order_line_items")
    .delete()
    .eq("order_id", orderId);
  if (deleteError) {
    logSupabaseError("Line item delete error:", deleteError);
    return { error: deleteError.message };
  }

  const rows = buildLineItemRows(order, productMap);
  if (rows.length > 0) {
    const { error } = await supabase
      .from("order_line_items")
      .insert(rows.map((item) => ({ order_id: orderId, ...item })));
    if (error) {
      logSupabaseError("Line item insert error:", error);
      return { error: error.message };
    }
  }

  return { orderId };
}

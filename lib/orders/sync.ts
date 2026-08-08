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

/** What the row already holds, so a re-sync cannot make the record worse. */
export interface StoredFeeRow {
  total_processing_fee: number | null;
  processing_fee_source: string | null;
}

/**
 * The order-row shape both entry points write, extracted so the fee rule can
 * be tested without a Supabase mock.
 *
 * The fee fields are SPREAD IN ONLY WHEN KNOWN, and never when they would
 * make the stored record less true. Two distinct hazards:
 *
 *   1. computeProcessingFee returns null (unpaid, malformed payload, a
 *      gateway we cannot price). Omitting the keys leaves any stored fee
 *      untouched, where writing nulls would erase a known figure because one
 *      re-sync happened to get an odd payload. unpaid→paid still updates:
 *      once paid, the result is non-null and the keys are present.
 *
 *   2. An ESTIMATE would overwrite a figure Shopify actually REPORTED. This
 *      is not hypothetical and not rare: past Shopify's 60-day protected-order
 *      window the transactions payload comes back empty, and the dashboard
 *      sync walks the newest 500 orders on every run. Without this guard every
 *      order eventually crosses day 60 and has its exact, reported fee
 *      replaced by 2.9% × total + 30¢, flipping `actual` → `estimated` and
 *      putting a `~` on a figure that used to be precise. The column would
 *      degrade monotonically and never recover.
 *
 * Downgrade is refused; UPGRADE is not. An estimate replaced by a reported
 * figure is exactly what should happen, and a re-reported actual may freely
 * correct an earlier actual.
 */
export function buildOrderFields(order: ShopifyOrder, stored?: StoredFeeRow | null) {
  const processingFee = computeProcessingFee(order);

  const wouldDowngrade =
    processingFee?.source === "estimated" &&
    stored?.processing_fee_source === "actual" &&
    stored.total_processing_fee != null;

  const feeFields =
    processingFee && !wouldDowngrade
      ? {
          total_processing_fee: processingFee.fee,
          processing_fee_source: processingFee.source,
        }
      : {};

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
    ...feeFields,
  };
}

export async function upsertShopifyOrder(
  supabase: SupabaseClient,
  ownerId: string,
  order: ShopifyOrder,
  productMap: Map<string, string>
): Promise<{ orderId: string } | { error: string }> {
  const shopifyOrderId = parseShopifyGid(order.id);

  // Selected BEFORE the row is built: buildOrderFields needs to know what is
  // already stored so an estimate cannot overwrite a reported fee. Reordered
  // from its original position below the row construction for that reason.
  const { data: existingOrder } = await supabase
    .from("orders")
    .select("id, total_processing_fee, processing_fee_source")
    .eq("shopify_order_id", shopifyOrderId)
    .eq("user_id", ownerId)
    .maybeSingle();

  const orderFields = buildOrderFields(order, existingOrder);

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

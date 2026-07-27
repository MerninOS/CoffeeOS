import { createClient } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/team";
import { OrdersClient } from "./orders-client";
import {
  ORDERS_PAGE_LIMIT,
  periodStartISO,
  resolvePeriod,
} from "@/lib/orders/constants";
import { aggregate, getOrderLineItemsCogs, type CostableOrder } from "@/lib/orders/cogs";

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const supabase = await createClient();
  const { ownerId } = await getEffectiveOwnerId();

  if (!ownerId) {
    return null;
  }

  // `?period=` is user-editable; resolvePeriod falls back rather than throwing.
  const { period: rawPeriod } = await searchParams;
  const period = resolvePeriod(rawPeriod);
  const since = periodStartISO(period);

  // Fetch orders with line items and order-level components
  const { data: orders } = await supabase
    .from("orders")
    .select(`
      *,
      order_line_items (
        id,
        title,
        sku,
        quantity,
        price,
        total_price,
        product_id,
        shopify_product_id
      ),
      order_components (
        id,
        component_id,
        quantity,
        components (
          id,
          name,
          cost_per_unit,
          unit,
          type
        )
      ),
      order_custom_costs (
        id,
        description,
        amount
      )
    `)
    .eq("user_id", ownerId)
    .gte("created_at_shopify", since)
    .order("created_at_shopify", { ascending: false })
    .limit(ORDERS_PAGE_LIMIT);

  // Fetch all available components for adding to orders
  const { data: allComponents } = await supabase
    .from("components")
    .select("id, name, cost_per_unit, unit, type")
    .eq("user_id", ownerId)
    .order("name");

  // Fetch coffee inventory for roast requests
  const { data: coffeeInventory } = await supabase
    .from("green_coffee_inventory")
    .select("id, name, origin, current_green_quantity_g")
    .eq("user_id", ownerId)
    .gt("current_green_quantity_g", 0)
    .order("name");

  // Fetch all products with their components and component costs
  // This allows us to calculate COGS for each line item
  const { data: productsWithCogs } = await supabase
    .from("products")
    .select(`
      id,
      product_components (
        quantity,
        components (
          cost_per_unit
        )
      )
    `)
    .eq("user_id", ownerId);

  // Build a map of product_id -> total COGS
  const productCogsMap: Record<string, number> = {};
  if (productsWithCogs) {
    for (const product of productsWithCogs) {
      let totalCogs = 0;
      if (product.product_components) {
        for (const pc of product.product_components) {
          const componentCost = (pc.components as { cost_per_unit: number } | null)?.cost_per_unit || 0;
          totalCogs += (pc.quantity || 0) * componentCost;
        }
      }
      productCogsMap[product.id] = totalCogs;
    }
  }

  // Check if Shopify Admin API is configured
  const { data: settings } = await supabase
    .from("shopify_settings")
    .select("store_domain, admin_access_token")
    .eq("user_id", ownerId)
    .maybeSingle();

  const isAdminConfigured = !!settings?.admin_access_token;

  // Range aggregate — deliberately NOT limited. It is bounded by the period
  // instead, and selects only the fields the COGS math needs (no titles, SKUs,
  // customer names or statuses), so it is far lighter per row than the query
  // above.
  //
  // Summing the paginated `orders` above would silently under-report the moment
  // a period exceeds one page, and would look entirely plausible while doing it.
  // That is spec Criterion 5.
  const { data: aggregateRows } = await supabase
    .from("orders")
    .select(`
      total_price,
      order_line_items ( product_id, quantity ),
      order_components ( quantity, components ( cost_per_unit ) ),
      order_custom_costs ( amount )
    `)
    .eq("user_id", ownerId)
    .gte("created_at_shopify", since);

  const rangeRows: CostableOrder[] = aggregateRows || [];
  const totals = aggregate(rangeRows, productCogsMap);

  // An order whose line items resolve to zero product COGS counts as pure
  // profit — the failure mode the page exists to surface.
  const missingCogsCount = rangeRows.filter(
    (o) => getOrderLineItemsCogs(o, productCogsMap) === 0
  ).length;

  return (
    <OrdersClient
      initialOrders={orders || []}
      productCogsMap={productCogsMap}
      allComponents={allComponents || []}
      coffeeInventory={coffeeInventory || []}
      isAdminConfigured={isAdminConfigured}
      period={period}
      totals={totals}
      missingCogsCount={missingCogsCount}
    />
  );
}

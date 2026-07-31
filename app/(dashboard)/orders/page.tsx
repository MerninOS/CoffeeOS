import { createClient } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/team";
import { OrdersClient } from "./orders-client";
import {
  ORDERS_PAGE_LIMIT,
  periodStartISO,
  resolvePeriod,
} from "@/lib/orders/constants";
import { aggregate, type CostableOrder } from "@/lib/orders/cogs";
import { loadProductLookup, asLookupClient } from "@/lib/products/load-lookup";

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

  // Cost every line item on this page through the SAME lookup the order detail
  // page and the Shopify packing block use. The two queries, the tenancy scope
  // and the fail-loudly behaviour live in lib/products/load-lookup.ts —
  // extracted so the `user_id` filter is pinned by a test rather than by a
  // comment. See that file for why each of those matters; the reasoning that
  // used to sit here moved with the code.
  const productLookup = await loadProductLookup(asLookupClient(supabase), ownerId);

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
  const { data: aggregateRows, error: aggregateError } = await supabase
    .from("orders")
    .select(`
      total_price,
      order_line_items ( product_id, quantity ),
      order_components ( quantity, components ( cost_per_unit ) ),
      order_custom_costs ( amount )
    `)
    .eq("user_id", ownerId)
    .gte("created_at_shopify", since);

  // `rangeRows.length` is the honest denominator for anything the UI phrases as
  // "in the last N days". `orders` above is capped at ORDERS_PAGE_LIMIT, so the
  // client cannot derive this — and a footer that counts the page while naming
  // the period is the same class of defect Criterion 5 guards the aggregate
  // against, just in copy instead of arithmetic.
  // Same reasoning as the products query: falling through with `[]` would
  // report a period that genuinely holds orders as empty, at 0% margin, with no
  // indication anything failed.
  if (aggregateError) {
    throw new Error(`Could not load the period aggregate: ${aggregateError.message}`);
  }

  const rangeRows: CostableOrder[] = aggregateRows || [];
  const totals = aggregate(rangeRows, productLookup);

  return (
    <OrdersClient
      initialOrders={orders || []}
      products={productLookup}
      allComponents={allComponents || []}
      coffeeInventory={coffeeInventory || []}
      isAdminConfigured={isAdminConfigured}
      period={period}
      totals={totals}
      rangeCount={rangeRows.length}
    />
  );
}

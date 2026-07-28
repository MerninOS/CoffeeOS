import { createClient } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/team";
import { OrdersClient } from "./orders-client";
import {
  ORDERS_PAGE_LIMIT,
  periodStartISO,
  resolvePeriod,
} from "@/lib/orders/constants";
import { aggregate, type CostableOrder } from "@/lib/orders/cogs";
import { buildProductLookup } from "@/lib/products/costing";

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
  // `title` is here for the excluded-row badge, which has to NAME the product
  // blocking an order. Keep `.eq("user_id", ownerId)` on THIS query rather than
  // relying on any parent scope — CoffeeOS#75 is exactly that mistake, an
  // unscoped product_components count that read as true for every account.
  const { data: productsWithCogs, error: productsError } = await supabase
    .from("products")
    .select(`
      id,
      title,
      product_components (
        quantity,
        components (
          cost_per_unit
        )
      )
    `)
    .eq("user_id", ownerId);

  // FAIL LOUDLY. Without this lookup there is no cost data at all, so every
  // order classifies `unlinked` and the page states, as fact, that each one's
  // Shopify product "was deleted or replaced" — a specific, confident, wrong
  // diagnosis of a transient database error. Every figure would also be wrong
  // while looking entirely plausible, which is the exact defect this page was
  // rebuilt to remove. A blank error beats a convincing lie.
  if (productsError) {
    throw new Error(`Could not load product costs: ${productsError.message}`);
  }

  // A recipe can live at PRODUCT level or at VARIANT level, and this page used to
  // read only the first — so a product costed per-variant looked uncosted, its
  // orders were excluded, and the operator was told to add a recipe that was
  // already there. On this account it took covered revenue to $0.00 of $261.80
  // over 30 days while every order in that window was fully costed.
  //
  // `order_line_items.shopify_variant_id` is null for 432 of 436 rows (the sync
  // never populates it), so a line item cannot be matched to the variant that
  // actually sold. The cost is therefore only KNOWABLE when it does not depend on
  // that choice: every variant costed, and all of them agreeing. Anything else
  // stays uncosted rather than guessing — this page exists to stop plausible
  // figures standing in for unknown ones.
  const { data: variantRows, error: variantsError } = await supabase
    .from("product_variants")
    .select(`
      id,
      product_id,
      product_variant_components (
        quantity,
        components ( cost_per_unit )
      )
    `)
    .in("product_id", (productsWithCogs || []).map((p) => p.id));

  if (variantsError) {
    throw new Error(`Could not load variant costs: ${variantsError.message}`);
  }

  // The product/variant precedence rule lives in lib/products/costing.ts so that
  // /products resolves costing identically — see CoffeeOS#69. The comments that
  // used to sit here moved with it; they are the specification for that rule.
  const productLookup = buildProductLookup(productsWithCogs, variantRows);

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

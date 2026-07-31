import { createClient } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/team";
import { buildProductLookup } from "@/lib/products/costing";
import { redirect, notFound } from "next/navigation";
import { OrderDetailClient } from "./order-detail-client";

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { ownerId } = await getEffectiveOwnerId();
  const user = { id: ownerId }; // Declare the user variable

  if (!ownerId) {
    redirect("/auth/login");
  }

  // Get order with all related data
  const { data: order, error } = await supabase
    .from("orders")
    .select(`
      *,
      order_line_items (
        id,
        title,
        variant_title,
        sku,
        quantity,
        price,
        total_price,
        product_id,
        products (
          id,
          title,
          product_components (
            id,
            quantity,
            components (
              id,
              name,
              type,
              cost_per_unit
            )
          )
        )
      ),
      order_components (
        id,
        component_id,
        quantity,
        components (
          id,
          name,
          type,
          cost_per_unit
        )
      ),
      order_custom_costs (
        id,
        description,
        amount
      ),
      order_roasted_coffee (
        id,
        green_coffee_id,
        amount_g,
        assigned_at,
        green_coffee_inventory (
          id,
          name
        )
      )
    `)
    .eq("id", id)
    .eq("user_id", ownerId)
    .single();

  if (error || !order) {
    notFound();
  }

  // Fetch all products with their components and component costs, so this page
  // costs the order through the SAME lookup /orders and the Shopify packing block
  // use. It must cover EVERY owned product, not just the ones this order
  // references: `classifyOrder` tells "line item points at a product that no
  // longer exists" (unlinked) from "product exists but has no recipe" (uncosted)
  // purely by ABSENCE from this lookup, and a lookup scoped to the order makes
  // those two indistinguishable. The figures would still look right for a costed
  // order, which is what makes that mistake quiet.
  //
  // `title` is here because the copy has to NAME the product blocking an order,
  // and an id-to-cost map has no name in it.
  //
  // Keep `.eq("user_id", ownerId)` on THIS query rather than relying on any
  // parent scope — CoffeeOS#75 is exactly that mistake, an unscoped
  // product_components count that read as true for every account.
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

  // FAIL LOUDLY. Without this lookup there is no cost data at all, so the order
  // classifies `unlinked` and this page states, as fact, that its Shopify product
  // "was deleted or replaced" — a specific, confident, wrong diagnosis of a
  // transient database error. On a detail page the operator is looking at ONE
  // order and will believe what it says about it. A blank error beats a
  // convincing lie. Matches orders/page.tsx.
  if (productsError) {
    throw new Error(`Could not load product costs: ${productsError.message}`);
  }

  // A recipe can live at PRODUCT level or at VARIANT level, and this page read
  // only the first — the defect CoffeeOS#85 fixed for the list and CoffeeOS#100
  // fixes here. `order_line_items.shopify_variant_id` is null for 432 of 436 rows,
  // so a line item cannot be matched to the variant that actually sold; the cost
  // is therefore only KNOWABLE when it does not depend on that choice. The
  // agreement rule lives in buildProductLookup.
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
  // /orders, /products and this page resolve costing identically. Three
  // implementations of this formula is what CoffeeOS#100 exists to remove.
  const productLookup = buildProductLookup(productsWithCogs, variantRows);

  // Get available roasted coffee stock
  const { data: coffeeStock } = await supabase
    .from("green_coffee_inventory")
    .select(`
      id,
      name,
      origin,
      roasted_stock_g
    `)
    .eq("user_id", ownerId)
    .gt("roasted_stock_g", 0)
    .order("name");

  // Get all components for adding manual components
  const { data: components } = await supabase
    .from("components")
    .select("id, name, type, cost_per_unit")
    .eq("user_id", ownerId)
    .order("name");

  return (
    <OrderDetailClient
      order={order}
      products={productLookup}
      coffeeStock={coffeeStock || []}
      components={components || []}
    />
  );
}

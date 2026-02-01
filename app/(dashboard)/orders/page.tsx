import { createClient } from "@/lib/supabase/server";
import { OrdersClient } from "./orders-client";

export default async function OrdersPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

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
    .eq("user_id", user.id)
    .order("created_at_shopify", { ascending: false });

  // Fetch all available components for adding to orders
  const { data: allComponents } = await supabase
    .from("components")
    .select("id, name, cost_per_unit, unit, type")
    .eq("user_id", user.id)
    .order("name");

  // Fetch coffee inventory for roast requests
  const { data: coffeeInventory } = await supabase
    .from("green_coffee_inventory")
    .select("id, name, origin, current_green_quantity_g")
    .eq("user_id", user.id)
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
    .eq("user_id", user.id);

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
    .eq("user_id", user.id)
    .maybeSingle();

  const isAdminConfigured = !!settings?.admin_access_token;

  return (
    <OrdersClient
      initialOrders={orders || []}
      productCogsMap={productCogsMap}
      allComponents={allComponents || []}
      coffeeInventory={coffeeInventory || []}
      isAdminConfigured={isAdminConfigured}
    />
  );
}

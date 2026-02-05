import { createClient } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/team";
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
      coffeeStock={coffeeStock || []}
      components={components || []}
    />
  );
}

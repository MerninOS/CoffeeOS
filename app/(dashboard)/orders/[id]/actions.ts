"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/team";

export async function getOrderDetails(orderId: string) {
  const supabase = await createClient();

  const { ownerId: _oid } = await getEffectiveOwnerId();
  if (!_oid) {
    return { error: "Unauthorized" };
  }
  const ownerId = _oid;

  // Get order with line items
  const { data: order, error: orderError } = await supabase
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
              component_type,
              cost_per_unit,
              green_coffee_id
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
          component_type,
          cost_per_unit,
          green_coffee_id
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
    .eq("id", orderId)
    .eq("user_id", ownerId)
    .single();

  if (orderError || !order) {
    return { error: orderError?.message || "Order not found" };
  }

  return { order };
}

export async function getRoastedCoffeeStock() {
  const supabase = await createClient();

  const { ownerId: _oid } = await getEffectiveOwnerId();
  if (!_oid) {
    return { error: "Unauthorized" };
  }
  const ownerId = _oid;

  // Get green coffee inventory with stock amounts
  const { data: coffeeStock, error } = await supabase
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

  if (error) {
    return { error: error.message };
  }

  return { coffeeStock: coffeeStock || [] };
}

export async function updateOrderReadyToShip(orderId: string, readyToShip: boolean) {
  const supabase = await createClient();

  const { ownerId: _oid } = await getEffectiveOwnerId();
  if (!_oid) {
    return { error: "Unauthorized" };
  }
  const ownerId = _oid;

  const { error } = await supabase
    .from("orders")
    .update({ ready_to_ship: readyToShip })
    .eq("id", orderId)
    .eq("user_id", ownerId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/orders");
  return { success: true };
}

export async function assignRoastedCoffeeToOrder(
  orderId: string,
  greenCoffeeId: string,
  amountG: number
) {
  const supabase = await createClient();

  const { ownerId: _oid } = await getEffectiveOwnerId();
  if (!_oid) {
    return { error: "Unauthorized" };
  }
  const ownerId = _oid;

  // Verify order belongs to user
  const { data: order } = await supabase
    .from("orders")
    .select("id")
    .eq("id", orderId)
    .eq("user_id", ownerId)
    .single();

  if (!order) {
    return { error: "Order not found" };
  }

  // Check available stock
  const { data: coffeeInventory } = await supabase
    .from("green_coffee_inventory")
    .select("id, name, roasted_stock_g")
    .eq("id", greenCoffeeId)
    .eq("user_id", ownerId)
    .single();

  if (!coffeeInventory) {
    return { error: "Coffee not found" };
  }

  if ((coffeeInventory.roasted_stock_g || 0) < amountG) {
    return { error: `Not enough roasted coffee in stock. Available: ${coffeeInventory.roasted_stock_g}g` };
  }

  // Check if there's already an assignment for this coffee on this order
  const { data: existingAssignment } = await supabase
    .from("order_roasted_coffee")
    .select("id, amount_g")
    .eq("order_id", orderId)
    .eq("green_coffee_id", greenCoffeeId)
    .maybeSingle();

  if (existingAssignment) {
    // Update existing assignment
    const newAmount = existingAssignment.amount_g + amountG;
    
    const { error: updateError } = await supabase
      .from("order_roasted_coffee")
      .update({ amount_g: newAmount })
      .eq("id", existingAssignment.id);

    if (updateError) {
      return { error: updateError.message };
    }
  } else {
    // Create new assignment
    const { error: insertError } = await supabase
      .from("order_roasted_coffee")
      .insert({
        order_id: orderId,
        green_coffee_id: greenCoffeeId,
        amount_g: amountG,
      });

    if (insertError) {
      return { error: insertError.message };
    }
  }

  // Deduct from roasted stock
  const { error: stockError } = await supabase
    .from("green_coffee_inventory")
    .update({ 
      roasted_stock_g: (coffeeInventory.roasted_stock_g || 0) - amountG 
    })
    .eq("id", greenCoffeeId);

  if (stockError) {
    return { error: stockError.message };
  }

  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/orders");
  revalidatePath("/roasting");
  return { success: true };
}

export async function removeRoastedCoffeeFromOrder(assignmentId: string) {
  const supabase = await createClient();

  const { ownerId: _oid } = await getEffectiveOwnerId();
  if (!_oid) {
    return { error: "Unauthorized" };
  }
  const ownerId = _oid;

  // Get the assignment details
  const { data: assignment } = await supabase
    .from("order_roasted_coffee")
    .select(`
      id,
      order_id,
      green_coffee_id,
      amount_g,
      orders!inner(user_id)
    `)
    .eq("id", assignmentId)
    .single();

  if (!assignment || (assignment.orders as { user_id: string }).user_id !== ownerId) {
    return { error: "Assignment not found" };
  }

  // Return stock to inventory
  const { data: coffeeInventory } = await supabase
    .from("green_coffee_inventory")
    .select("id, roasted_stock_g")
    .eq("id", assignment.green_coffee_id)
    .single();

  if (coffeeInventory) {
    await supabase
      .from("green_coffee_inventory")
      .update({ 
        roasted_stock_g: (coffeeInventory.roasted_stock_g || 0) + assignment.amount_g 
      })
      .eq("id", assignment.green_coffee_id);
  }

  // Delete the assignment
  const { error } = await supabase
    .from("order_roasted_coffee")
    .delete()
    .eq("id", assignmentId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/orders/${assignment.order_id}`);
  revalidatePath("/orders");
  revalidatePath("/roasting");
  return { success: true };
}

export async function getRequiredCoffeeForOrder(orderId: string) {
  const supabase = await createClient();

  const { ownerId: _oid } = await getEffectiveOwnerId();
  if (!_oid) {
    return { error: "Unauthorized" };
  }
  const ownerId = _oid;

  // Get order with line items and their product components
  const { data: order } = await supabase
    .from("orders")
    .select(`
      id,
      order_line_items (
        quantity,
        products (
          id,
          product_components (
            quantity,
            components (
              id,
              name,
              component_type,
              green_coffee_id,
              green_coffee_inventory (
                id,
                name,
                roasted_stock_g
              )
            )
          )
        )
      )
    `)
    .eq("id", orderId)
    .eq("user_id", ownerId)
    .single();

  if (!order) {
    return { error: "Order not found" };
  }

  // Calculate required roasted coffee amounts by green_coffee_id
  const requiredCoffee: Record<string, {
    greenCoffeeId: string;
    coffeeName: string;
    requiredG: number;
    availableG: number;
  }> = {};

  for (const lineItem of order.order_line_items || []) {
    const product = lineItem.products as {
      id: string;
      product_components: Array<{
        quantity: number;
        components: {
          id: string;
          name: string;
          component_type: string;
          green_coffee_id: string | null;
          green_coffee_inventory: {
            id: string;
            name: string;
            roasted_stock_g: number;
          } | null;
        } | null;
      }>;
    } | null;

    if (!product) continue;

    for (const pc of product.product_components || []) {
      const component = pc.components;
      if (!component || component.component_type !== "roasted_coffee" || !component.green_coffee_id) {
        continue;
      }

      const coffeeId = component.green_coffee_id;
      const requiredAmount = pc.quantity * lineItem.quantity;

      if (!requiredCoffee[coffeeId]) {
        requiredCoffee[coffeeId] = {
          greenCoffeeId: coffeeId,
          coffeeName: component.green_coffee_inventory?.name || component.name,
          requiredG: 0,
          availableG: component.green_coffee_inventory?.roasted_stock_g || 0,
        };
      }

      requiredCoffee[coffeeId].requiredG += requiredAmount;
    }
  }

  return { requiredCoffee: Object.values(requiredCoffee) };
}

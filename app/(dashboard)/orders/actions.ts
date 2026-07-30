"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/team";
import { fetchShopifyOrders } from "@/lib/shopify";
import { getValidAdminToken } from "@/app/(dashboard)/settings/actions";
import { upsertShopifyOrder } from "@/lib/orders/sync";

export async function syncShopifyOrders() {
  const supabase = await createClient();

  const { ownerId: _oid } = await getEffectiveOwnerId();
  if (!_oid) {
    return { error: "Unauthorized" };
  }
  const ownerId = _oid;

  // Get a valid Admin API token using OAuth client credentials
  const tokenResult = await getValidAdminToken();
  
  if (tokenResult.error) {
    return { error: tokenResult.error };
  }

  if (!tokenResult.accessToken || !tokenResult.storeDomain) {
    return { error: "Failed to get Admin API access token." };
  }

  try {
    let allOrders: Awaited<ReturnType<typeof fetchShopifyOrders>>["orders"] = [];
    let hasNextPage = true;
    let cursor: string | undefined;

    // Fetch all orders with pagination
    while (hasNextPage) {
      const result = await fetchShopifyOrders(
        tokenResult.storeDomain,
        tokenResult.accessToken,
        50,
        cursor
      );

      allOrders = [...allOrders, ...result.orders];
      hasNextPage = result.pageInfo.hasNextPage;
      cursor = result.pageInfo.endCursor;

      // Limit to 500 orders for now
      if (allOrders.length >= 500) break;
    }

    // Get existing products to map Shopify IDs to local product IDs
    const { data: products } = await supabase
      .from("products")
      .select("id, shopify_id")
      .eq("user_id", ownerId);

    const productMap = new Map(
      (products || []).map((p) => [p.shopify_id, p.id])
    );

    let syncedCount = 0;

    // Process each order
    for (const order of allOrders) {
      const result = await upsertShopifyOrder(supabase, ownerId, order, productMap);
      if ("error" in result) {
        console.error("Order upsert error:", result.error);
        continue;
      }
      syncedCount++;
    }

    revalidatePath("/orders");
    revalidatePath("/dashboard");
    return { success: true, count: syncedCount };
  } catch (error) {
    console.error("Order sync error:", error);
    return { error: error instanceof Error ? error.message : "Failed to sync orders" };
  }
}

export async function deleteOrder(orderId: string) {
  const supabase = await createClient();

  const { ownerId: _oid } = await getEffectiveOwnerId();
  if (!_oid) {
    return { error: "Unauthorized" };
  }
  const ownerId = _oid;

  // Delete line items first (cascade should handle this, but being explicit)
  await supabase.from("order_line_items").delete().eq("order_id", orderId);

  // Delete order
  const { error } = await supabase
    .from("orders")
    .delete()
    .eq("id", orderId)
    .eq("user_id", ownerId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/orders");
  return { success: true };
}

export async function addOrderComponent(orderId: string, componentId: string, quantity: number) {
  const supabase = await createClient();

  const { ownerId: _oid } = await getEffectiveOwnerId();
  if (!_oid) {
    return { error: "Unauthorized" };
  }
  const ownerId = _oid;

  // Verify the order belongs to the user
  const { data: order } = await supabase
    .from("orders")
    .select("id")
    .eq("id", orderId)
    .eq("user_id", ownerId)
    .single();

  if (!order) {
    return { error: "Order not found" };
  }

  // Check if this component is already added to the order
  const { data: existingComponent } = await supabase
    .from("order_components")
    .select("id, quantity")
    .eq("order_id", orderId)
    .eq("component_id", componentId)
    .single();

  if (existingComponent) {
    // Update quantity
    const { error } = await supabase
      .from("order_components")
      .update({ quantity: existingComponent.quantity + quantity })
      .eq("id", existingComponent.id);

    if (error) {
      return { error: error.message };
    }
  } else {
    // Insert new
    const { error } = await supabase.from("order_components").insert({
      order_id: orderId,
      component_id: componentId,
      quantity,
    });

    if (error) {
      return { error: error.message };
    }
  }

  revalidatePath("/orders");
  return { success: true };
}

export async function updateOrderComponentQuantity(orderComponentId: string, quantity: number) {
  const supabase = await createClient();

  const { ownerId: _oid } = await getEffectiveOwnerId();
  if (!_oid) {
    return { error: "Unauthorized" };
  }
  const ownerId = _oid;

  // Verify ownership through the order
  const { data: orderComponent } = await supabase
    .from("order_components")
    .select("id, order_id, orders!inner(user_id)")
    .eq("id", orderComponentId)
    .single();

  if (!orderComponent || (orderComponent.orders as { user_id: string }).user_id !== ownerId) {
    return { error: "Order component not found" };
  }

  if (quantity <= 0) {
    // Delete if quantity is 0 or negative
    const { error } = await supabase
      .from("order_components")
      .delete()
      .eq("id", orderComponentId);

    if (error) {
      return { error: error.message };
    }
  } else {
    const { error } = await supabase
      .from("order_components")
      .update({ quantity })
      .eq("id", orderComponentId);

    if (error) {
      return { error: error.message };
    }
  }

  revalidatePath("/orders");
  return { success: true };
}

export async function removeOrderComponent(orderComponentId: string) {
  const supabase = await createClient();

  const { ownerId: _oid } = await getEffectiveOwnerId();
  if (!_oid) {
    return { error: "Unauthorized" };
  }
  const ownerId = _oid;

  // Verify ownership through the order
  const { data: orderComponent } = await supabase
    .from("order_components")
    .select("id, order_id, orders!inner(user_id)")
    .eq("id", orderComponentId)
    .single();

  if (!orderComponent || (orderComponent.orders as { user_id: string }).user_id !== ownerId) {
    return { error: "Order component not found" };
  }

  const { error } = await supabase
    .from("order_components")
    .delete()
    .eq("id", orderComponentId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/orders");
  return { success: true };
}

export async function addOrderCustomCost(orderId: string, description: string, amount: number) {
  const supabase = await createClient();

  const { ownerId: _oid } = await getEffectiveOwnerId();
  if (!_oid) {
    return { error: "Unauthorized" };
  }
  const ownerId = _oid;

  // Verify the order belongs to the user
  const { data: order } = await supabase
    .from("orders")
    .select("id")
    .eq("id", orderId)
    .eq("user_id", ownerId)
    .single();

  if (!order) {
    return { error: "Order not found" };
  }

  const { error } = await supabase.from("order_custom_costs").insert({
    order_id: orderId,
    description: description.trim(),
    amount,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/orders");
  return { success: true };
}

export async function updateOrderCustomCost(customCostId: string, description: string, amount: number) {
  const supabase = await createClient();

  const { ownerId: _oid } = await getEffectiveOwnerId();
  if (!_oid) {
    return { error: "Unauthorized" };
  }
  const ownerId = _oid;

  // Verify ownership through the order
  const { data: customCost } = await supabase
    .from("order_custom_costs")
    .select("id, order_id, orders!inner(user_id)")
    .eq("id", customCostId)
    .single();

  if (!customCost || (customCost.orders as { user_id: string }).user_id !== ownerId) {
    return { error: "Custom cost not found" };
  }

  const { error } = await supabase
    .from("order_custom_costs")
    .update({ description: description.trim(), amount })
    .eq("id", customCostId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/orders");
  return { success: true };
}

export async function removeOrderCustomCost(customCostId: string) {
  const supabase = await createClient();

  const { ownerId: _oid } = await getEffectiveOwnerId();
  if (!_oid) {
    return { error: "Unauthorized" };
  }
  const ownerId = _oid;

  // Verify ownership through the order
  const { data: customCost } = await supabase
    .from("order_custom_costs")
    .select("id, order_id, orders!inner(user_id)")
    .eq("id", customCostId)
    .single();

  if (!customCost || (customCost.orders as { user_id: string }).user_id !== ownerId) {
    return { error: "Custom cost not found" };
  }

  const { error } = await supabase
    .from("order_custom_costs")
    .delete()
    .eq("id", customCostId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/orders");
  return { success: true };
}

export async function createRoastRequestForOrder(data: {
  orderId: string;
  greenCoffeeId: string;
  coffeeName: string;
  requestedRoastedG: number;
  priority?: "low" | "normal" | "high" | "urgent";
  dueDate?: string;
  notes?: string;
}) {
  const supabase = await createClient();

  const { ownerId: _oid } = await getEffectiveOwnerId();
  if (!_oid) {
    return { error: "Unauthorized" };
  }
  const ownerId = _oid;

  // Verify the order belongs to the user
  const { data: order } = await supabase
    .from("orders")
    .select("id, order_name")
    .eq("id", data.orderId)
    .eq("user_id", ownerId)
    .single();

  if (!order) {
    return { error: "Order not found" };
  }

  // Check for existing unfulfilled request for the same coffee
  const { data: existingRequest } = await supabase
    .from("roast_requests")
    .select("*")
    .eq("user_id", ownerId)
    .eq("green_coffee_id", data.greenCoffeeId)
    .in("status", ["pending", "in_progress"])
    .order("created_at", { ascending: true })
    .limit(1)
    .single();

  if (existingRequest) {
    // Add to existing request
    const newRequestedAmount = existingRequest.requested_roasted_g + data.requestedRoastedG;
    
    // Use the higher priority if the new request has higher priority
    const priorityOrder = { urgent: 0, high: 1, normal: 2, low: 3 };
    const newPriority = data.priority && priorityOrder[data.priority] < priorityOrder[existingRequest.priority as keyof typeof priorityOrder]
      ? data.priority
      : existingRequest.priority;
    
    // Use the earlier due date
    let newDueDate = existingRequest.due_date;
    if (data.dueDate) {
      if (!existingRequest.due_date || new Date(data.dueDate) < new Date(existingRequest.due_date)) {
        newDueDate = data.dueDate;
      }
    }

    const { data: updatedRequest, error: updateError } = await supabase
      .from("roast_requests")
      .update({
        requested_roasted_g: newRequestedAmount,
        priority: newPriority,
        due_date: newDueDate,
      })
      .eq("id", existingRequest.id)
      .select()
      .single();

    if (updateError) {
      return { error: updateError.message };
    }

    revalidatePath("/orders");
    revalidatePath("/roasting");
    return { request: updatedRequest, merged: true };
  }

  // Create new request if no existing unfulfilled request for this coffee
  const { data: request, error } = await supabase
    .from("roast_requests")
    .insert({
      user_id: ownerId,
      green_coffee_id: data.greenCoffeeId,
      coffee_name: data.coffeeName,
      requested_roasted_g: data.requestedRoastedG,
      fulfilled_roasted_g: 0,
      priority: data.priority || "normal",
      status: "pending",
      due_date: data.dueDate || null,
      order_id: data.orderId,
      notes: data.notes || `Roast request for order ${order.order_name}`,
    })
    .select()
    .single();

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/orders");
  revalidatePath("/roasting");
  return { request };
}

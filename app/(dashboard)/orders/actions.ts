"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { fetchShopifyOrders, parseShopifyGid } from "@/lib/shopify";
import { getValidAdminToken } from "@/app/(dashboard)/settings/actions";

export async function syncShopifyOrders() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Unauthorized" };
  }

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
      .eq("user_id", user.id);

    const productMap = new Map(
      (products || []).map((p) => [p.shopify_id, p.id])
    );

    // Get product components for COGS calculation
    const { data: productComponents } = await supabase
      .from("product_components")
      .select(`
        product_id,
        quantity,
        components (cost_per_unit)
      `);

    // Calculate COGS per product
    const productCogs = new Map<string, number>();
    for (const pc of productComponents || []) {
      const cost = (pc.quantity || 0) * ((pc.components as { cost_per_unit: number } | null)?.cost_per_unit || 0);
      const current = productCogs.get(pc.product_id) || 0;
      productCogs.set(pc.product_id, current + cost);
    }

    let syncedCount = 0;

    // Process each order
    for (const order of allOrders) {
      const shopifyOrderId = parseShopifyGid(order.id);

      // Calculate order totals
      const subtotal = parseFloat(order.subtotalPriceSet.shopMoney.amount);
      const tax = parseFloat(order.totalTaxSet.shopMoney.amount);
      const total = parseFloat(order.totalPriceSet.shopMoney.amount);

      // Build line items data
      const lineItemsData: Array<{
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
      }> = [];

      for (const lineItemEdge of order.lineItems.edges) {
        const lineItem = lineItemEdge.node;
        const shopifyProductId = lineItem.product
          ? parseShopifyGid(lineItem.product.id)
          : null;
        const localProductId = shopifyProductId
          ? productMap.get(shopifyProductId)
          : null;

        const unitPrice = parseFloat(lineItem.discountedUnitPriceSet.shopMoney.amount);
        const lineTotal = unitPrice * lineItem.quantity;

        lineItemsData.push({
          shopify_line_item_id: parseShopifyGid(lineItem.id),
          shopify_product_id: shopifyProductId,
          shopify_variant_id: null, // We'd need to fetch variant ID separately
          product_id: localProductId || null,
          title: lineItem.title,
          variant_title: null,
          sku: lineItem.sku,
          quantity: lineItem.quantity,
          price: unitPrice,
          total_price: lineTotal,
        });
      }

      // First check if order exists
      const { data: existingOrder } = await supabase
        .from("orders")
        .select("id")
        .eq("shopify_order_id", shopifyOrderId)
        .eq("user_id", user.id)
        .single();

      let orderId: string;

      if (existingOrder) {
        // Update existing order
        const { error: updateError } = await supabase
          .from("orders")
          .update({
            shopify_order_number: order.name,
            order_name: order.name,
            created_at_shopify: order.createdAt,
            financial_status: order.displayFinancialStatus,
            fulfillment_status: order.displayFulfillmentStatus,
            subtotal_price: subtotal,
            total_tax: tax,
            total_price: total,
            currency: order.totalPriceSet.shopMoney.currencyCode,
            synced_at: new Date().toISOString(),
          })
          .eq("id", existingOrder.id);

        if (updateError) {
          console.error("Order update error:", updateError);
          continue;
        }
        orderId = existingOrder.id;
      } else {
        // Insert new order
        const { data: newOrder, error: insertError } = await supabase
          .from("orders")
          .insert({
            user_id: user.id,
            shopify_order_id: shopifyOrderId,
            shopify_order_number: order.name,
            order_name: order.name,
            created_at_shopify: order.createdAt,
            financial_status: order.displayFinancialStatus,
            fulfillment_status: order.displayFulfillmentStatus,
            subtotal_price: subtotal,
            total_tax: tax,
            total_price: total,
            currency: order.totalPriceSet.shopMoney.currencyCode,
            synced_at: new Date().toISOString(),
          })
          .select("id")
          .single();

        if (insertError || !newOrder) {
          console.error("Order insert error:", insertError);
          continue;
        }
        orderId = newOrder.id;
      }

// Delete existing line items and re-insert
      await supabase
        .from("order_line_items")
        .delete()
        .eq("order_id", orderId);

      // Insert line items
      if (lineItemsData.length > 0) {
        await supabase.from("order_line_items").insert(
          lineItemsData.map((item) => ({
            order_id: orderId,
            ...item,
          }))
        );
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Unauthorized" };
  }

  // Delete line items first (cascade should handle this, but being explicit)
  await supabase.from("order_line_items").delete().eq("order_id", orderId);

  // Delete order
  const { error } = await supabase
    .from("orders")
    .delete()
    .eq("id", orderId)
    .eq("user_id", user.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/orders");
  return { success: true };
}

export async function addOrderComponent(orderId: string, componentId: string, quantity: number) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Unauthorized" };
  }

  // Verify the order belongs to the user
  const { data: order } = await supabase
    .from("orders")
    .select("id")
    .eq("id", orderId)
    .eq("user_id", user.id)
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Unauthorized" };
  }

  // Verify ownership through the order
  const { data: orderComponent } = await supabase
    .from("order_components")
    .select("id, order_id, orders!inner(user_id)")
    .eq("id", orderComponentId)
    .single();

  if (!orderComponent || (orderComponent.orders as { user_id: string }).user_id !== user.id) {
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Unauthorized" };
  }

  // Verify ownership through the order
  const { data: orderComponent } = await supabase
    .from("order_components")
    .select("id, order_id, orders!inner(user_id)")
    .eq("id", orderComponentId)
    .single();

  if (!orderComponent || (orderComponent.orders as { user_id: string }).user_id !== user.id) {
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Unauthorized" };
  }

  // Verify the order belongs to the user
  const { data: order } = await supabase
    .from("orders")
    .select("id")
    .eq("id", orderId)
    .eq("user_id", user.id)
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Unauthorized" };
  }

  // Verify ownership through the order
  const { data: customCost } = await supabase
    .from("order_custom_costs")
    .select("id, order_id, orders!inner(user_id)")
    .eq("id", customCostId)
    .single();

  if (!customCost || (customCost.orders as { user_id: string }).user_id !== user.id) {
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Unauthorized" };
  }

  // Verify ownership through the order
  const { data: customCost } = await supabase
    .from("order_custom_costs")
    .select("id, order_id, orders!inner(user_id)")
    .eq("id", customCostId)
    .single();

  if (!customCost || (customCost.orders as { user_id: string }).user_id !== user.id) {
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Unauthorized" };
  }

  // Verify the order belongs to the user
  const { data: order } = await supabase
    .from("orders")
    .select("id, order_name")
    .eq("id", data.orderId)
    .eq("user_id", user.id)
    .single();

  if (!order) {
    return { error: "Order not found" };
  }

  // Check for existing unfulfilled request for the same coffee
  const { data: existingRequest } = await supabase
    .from("roast_requests")
    .select("*")
    .eq("user_id", user.id)
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
      user_id: user.id,
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

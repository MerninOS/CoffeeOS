"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// Session Actions
export async function createSession(data: {
  sessionDate: string;
  vendorName: string;
  ratePerHour: number;
  setupMinutes?: number;
  cleanupMinutes?: number;
  billingGranularityMinutes?: number;
  allocationMode?: string;
  notes?: string;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Unauthorized" };
  }

  const { data: session, error } = await supabase
    .from("roasting_sessions")
    .insert({
      user_id: user.id,
      session_date: data.sessionDate,
      vendor_name: data.vendorName,
      rate_per_hour: data.ratePerHour,
      setup_minutes: data.setupMinutes || 0,
      cleanup_minutes: data.cleanupMinutes || 0,
      billing_granularity_minutes: data.billingGranularityMinutes || 15,
      allocation_mode: data.allocationMode || "time_weighted",
      notes: data.notes || null,
    })
    .select()
    .single();

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/roasting");
  return { session };
}

export async function updateSession(
  id: string,
  data: {
    sessionDate?: string;
    vendorName?: string;
    ratePerHour?: number;
    setupMinutes?: number;
    cleanupMinutes?: number;
    billingGranularityMinutes?: number;
    allocationMode?: string;
    notes?: string;
  }
) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Unauthorized" };
  }

  const updateData: Record<string, unknown> = {};
  if (data.sessionDate) updateData.session_date = data.sessionDate;
  if (data.vendorName) updateData.vendor_name = data.vendorName;
  if (data.ratePerHour !== undefined) updateData.rate_per_hour = data.ratePerHour;
  if (data.setupMinutes !== undefined) updateData.setup_minutes = data.setupMinutes;
  if (data.cleanupMinutes !== undefined) updateData.cleanup_minutes = data.cleanupMinutes;
  if (data.billingGranularityMinutes !== undefined) updateData.billing_granularity_minutes = data.billingGranularityMinutes;
  if (data.allocationMode) updateData.allocation_mode = data.allocationMode;
  if (data.notes !== undefined) updateData.notes = data.notes;

  const { error } = await supabase
    .from("roasting_sessions")
    .update(updateData)
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/roasting");
  revalidatePath(`/roasting/sessions/${id}`);
  return { success: true };
}

export async function deleteSession(id: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Unauthorized" };
  }

  const { error } = await supabase
    .from("roasting_sessions")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/roasting");
  return { success: true };
}

// Batch Actions
export async function createBatch(data: {
  sessionId: string;
  coffeeInventoryId?: string;
  coffeeName: string;
  lotCode?: string;
  priceBasis: "per_lb" | "per_kg";
  priceValue: number;
  greenWeightG: number;
  roastedWeightG: number;
  rejectsG?: number;
  roastMinutes: number;
  batchDate: string;
  energyKwh?: number;
  kwhRate?: number;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Unauthorized" };
  }

  // Calculate derived values
  const sellableG = data.roastedWeightG - (data.rejectsG || 0);
  const lossPercent = ((data.greenWeightG - data.roastedWeightG) / data.greenWeightG) * 100;
  
  // Calculate green cost per gram
  const pricePerG = data.priceBasis === "per_lb" 
    ? data.priceValue / 453.592 
    : data.priceValue / 1000;
  const greenCostPerG = pricePerG;

  // If using inventory, deduct the green weight (stored in grams)
  if (data.coffeeInventoryId) {
    // Get current inventory (quantity stored in grams)
    const { data: coffee, error: fetchError } = await supabase
      .from("green_coffee_inventory")
      .select("current_green_quantity_g")
      .eq("id", data.coffeeInventoryId)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !coffee) {
      return { error: "Coffee inventory not found" };
    }

    if (coffee.current_green_quantity_g < data.greenWeightG) {
      const availableLbs = (coffee.current_green_quantity_g / 453.592).toFixed(2);
      const neededLbs = (data.greenWeightG / 453.592).toFixed(2);
      return { error: `Insufficient inventory. Available: ${availableLbs} lbs, Needed: ${neededLbs} lbs` };
    }

    // Deduct from inventory (in grams)
    const { error: updateError } = await supabase
      .from("green_coffee_inventory")
      .update({ current_green_quantity_g: coffee.current_green_quantity_g - data.greenWeightG })
      .eq("id", data.coffeeInventoryId);

    if (updateError) {
      return { error: updateError.message };
    }

    // Record the inventory change (in grams)
    await supabase.from("coffee_inventory_changes").insert({
      coffee_id: data.coffeeInventoryId,
      user_id: user.id,
      changed_by_user_id: user.id,
      change_type: "roast_deduct",
      green_quantity_change_g: -data.greenWeightG,
      reference_type: "roasting_batch",
      notes: `Roasted batch: ${data.coffeeName}`,
    });
  }

  const { data: batch, error } = await supabase
    .from("roasting_batches")
    .insert({
      user_id: user.id,
      session_id: data.sessionId,
      coffee_inventory_id: data.coffeeInventoryId || null,
      coffee_name: data.coffeeName,
      lot_code: data.lotCode || null,
      price_basis: data.priceBasis,
      price_value: data.priceValue,
      green_weight_g: data.greenWeightG,
      roasted_weight_g: data.roastedWeightG,
      rejects_g: data.rejectsG || 0,
      roast_minutes: data.roastMinutes,
      batch_date: data.batchDate,
      energy_kwh: data.energyKwh || null,
      kwh_rate: data.kwhRate || null,
      sellable_g: sellableG,
      loss_percent: lossPercent,
      green_cost_per_g: greenCostPerG,
    })
    .select()
    .single();

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/roasting");
  revalidatePath(`/roasting/sessions/${data.sessionId}`);
  revalidatePath("/roasting/batches");
  revalidatePath("/inventory");
  return { batch };
}

export async function updateBatch(
  id: string,
  data: {
    coffeeName?: string;
    lotCode?: string;
    priceBasis?: "per_lb" | "per_kg";
    priceValue?: number;
    greenWeightG?: number;
    roastedWeightG?: number;
    rejectsG?: number;
    roastMinutes?: number;
    energyKwh?: number;
    kwhRate?: number;
  }
) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Unauthorized" };
  }

  const updateData: Record<string, unknown> = {};
  if (data.coffeeName !== undefined) updateData.coffee_name = data.coffeeName;
  if (data.lotCode !== undefined) updateData.lot_code = data.lotCode;
  if (data.priceBasis !== undefined) updateData.price_basis = data.priceBasis;
  if (data.priceValue !== undefined) updateData.price_value = data.priceValue;
  if (data.greenWeightG !== undefined) updateData.green_weight_g = data.greenWeightG;
  if (data.roastedWeightG !== undefined) updateData.roasted_weight_g = data.roastedWeightG;
  if (data.rejectsG !== undefined) updateData.rejects_g = data.rejectsG;
  if (data.roastMinutes !== undefined) updateData.roast_minutes = data.roastMinutes;
  if (data.energyKwh !== undefined) updateData.energy_kwh = data.energyKwh;
  if (data.kwhRate !== undefined) updateData.kwh_rate = data.kwhRate;

  // Recalculate derived values if weights changed
  if (data.greenWeightG !== undefined || data.roastedWeightG !== undefined || data.rejectsG !== undefined) {
    // Get current batch data
    const { data: currentBatch } = await supabase
      .from("roasting_batches")
      .select("green_weight_g, roasted_weight_g, rejects_g, price_basis, price_value")
      .eq("id", id)
      .single();

    if (currentBatch) {
      const greenG = data.greenWeightG ?? currentBatch.green_weight_g;
      const roastedG = data.roastedWeightG ?? currentBatch.roasted_weight_g;
      const rejectsG = data.rejectsG ?? currentBatch.rejects_g;
      
      updateData.sellable_g = roastedG - rejectsG;
      updateData.loss_percent = ((greenG - roastedG) / greenG) * 100;
      
      const priceBasis = data.priceBasis ?? currentBatch.price_basis;
      const priceValue = data.priceValue ?? currentBatch.price_value;
      const pricePerG = priceBasis === "per_lb" ? priceValue / 453.592 : priceValue / 1000;
      updateData.green_cost_per_g = pricePerG;
    }
  }

  const { error } = await supabase
    .from("roasting_batches")
    .update(updateData)
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/roasting");
  revalidatePath("/roasting/batches");
  return { success: true };
}

export async function deleteBatch(id: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Unauthorized" };
  }

  // Get the batch to find its session
  const { data: batch } = await supabase
    .from("roasting_batches")
    .select("session_id")
    .eq("id", id)
    .single();

  const { error } = await supabase
    .from("roasting_batches")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/roasting");
  if (batch?.session_id) {
    revalidatePath(`/roasting/sessions/${batch.session_id}`);
  }
  revalidatePath("/roasting/batches");
  return { success: true };
}

// Roasting Settings Actions
export async function getRoastingSettings() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Unauthorized" };
  }

  const { data: settings } = await supabase
    .from("roasting_settings")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  return { settings };
}

export async function saveRoastingSettings(data: {
  defaultBillingGranularityMinutes?: number;
  defaultSetupMinutes?: number;
  defaultCleanupMinutes?: number;
  defaultAllocationMode?: string;
  defaultKwhRate?: number;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Unauthorized" };
  }

  const { data: existing } = await supabase
    .from("roasting_settings")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  const settingsData = {
    user_id: user.id,
    default_billing_granularity_minutes: data.defaultBillingGranularityMinutes || 15,
    default_setup_minutes: data.defaultSetupMinutes || 0,
    default_cleanup_minutes: data.defaultCleanupMinutes || 0,
    default_allocation_mode: data.defaultAllocationMode || "time_weighted",
    default_kwh_rate: data.defaultKwhRate || null,
  };

  if (existing) {
    const { error } = await supabase
      .from("roasting_settings")
      .update(settingsData)
      .eq("id", existing.id);

    if (error) {
      return { error: error.message };
    }
  } else {
    const { error } = await supabase
      .from("roasting_settings")
      .insert(settingsData);

    if (error) {
      return { error: error.message };
    }
  }

  revalidatePath("/roasting/settings");
  return { success: true };
}

// Roast Request Actions
export async function createRoastRequest(data: {
  coffeeInventoryId: string;
  requestedQuantityG: number;
  priority?: "low" | "normal" | "high" | "urgent";
  dueDate?: string;
  orderId?: string;
  orderLineItemId?: string;
  notes?: string;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Unauthorized" };
  }

  const { data: request, error } = await supabase
    .from("roast_requests")
    .insert({
      user_id: user.id,
      coffee_inventory_id: data.coffeeInventoryId,
      requested_quantity_g: data.requestedQuantityG,
      fulfilled_quantity_g: 0,
      priority: data.priority || "normal",
      status: "pending",
      due_date: data.dueDate || null,
      order_id: data.orderId || null,
      order_line_item_id: data.orderLineItemId || null,
      notes: data.notes || null,
    })
    .select()
    .single();

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/roasting");
  revalidatePath("/orders");
  return { request };
}

export async function updateRoastRequest(
  id: string,
  data: {
    requestedQuantityG?: number;
    priority?: "low" | "normal" | "high" | "urgent";
    status?: "pending" | "in_progress" | "completed" | "cancelled";
    dueDate?: string;
    notes?: string;
  }
) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Unauthorized" };
  }

  const updateData: Record<string, unknown> = {};
  if (data.requestedQuantityG !== undefined) updateData.requested_quantity_g = data.requestedQuantityG;
  if (data.priority !== undefined) updateData.priority = data.priority;
  if (data.status !== undefined) updateData.status = data.status;
  if (data.dueDate !== undefined) updateData.due_date = data.dueDate;
  if (data.notes !== undefined) updateData.notes = data.notes;

  const { error } = await supabase
    .from("roast_requests")
    .update(updateData)
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/roasting");
  return { success: true };
}

export async function deleteRoastRequest(id: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Unauthorized" };
  }

  const { error } = await supabase
    .from("roast_requests")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/roasting");
  return { success: true };
}

export async function fulfillRoastRequest(data: {
  requestId: string;
  batchId: string;
  quantityG: number;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Unauthorized" };
  }

  // Get the current request
  const { data: request, error: fetchError } = await supabase
    .from("roast_requests")
    .select("*")
    .eq("id", data.requestId)
    .eq("user_id", user.id)
    .single();

  if (fetchError || !request) {
    return { error: "Request not found" };
  }

  // Create fulfillment record
  const { error: fulfillError } = await supabase
    .from("roast_request_fulfillments")
    .insert({
      request_id: data.requestId,
      batch_id: data.batchId,
      quantity_g: data.quantityG,
    });

  if (fulfillError) {
    return { error: fulfillError.message };
  }

  // Update the request's fulfilled quantity and status
  const newFulfilledQuantity = request.fulfilled_quantity_g + data.quantityG;
  const newStatus = newFulfilledQuantity >= request.requested_quantity_g ? "completed" : "in_progress";

  const { error: updateError } = await supabase
    .from("roast_requests")
    .update({
      fulfilled_quantity_g: newFulfilledQuantity,
      status: newStatus,
    })
    .eq("id", data.requestId);

  if (updateError) {
    return { error: updateError.message };
  }

  revalidatePath("/roasting");
  revalidatePath("/orders");
  return { success: true };
}

// Create component from batch
export async function createComponentFromBatch(
  batchId: string,
  data: {
    name: string;
    costPerUnit: number;
    unit: string;
  }
) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Unauthorized" };
  }

  // Get the batch details
  const { data: batch } = await supabase
    .from("roasting_batches")
    .select("*, roasting_sessions(session_date)")
    .eq("id", batchId)
    .single();

  if (!batch) {
    return { error: "Batch not found" };
  }

  // Create the component
  const { data: component, error } = await supabase
    .from("components")
    .insert({
      user_id: user.id,
      name: data.name,
      type: "ingredient",
      cost_per_unit: data.costPerUnit,
      unit: data.unit,
      notes: `Created from roasting batch "${batch.coffee_name}" on ${batch.roasting_sessions?.session_date || batch.batch_date || "unknown date"}. Lot: ${batch.lot_code || "N/A"}`,
    })
    .select()
    .single();

  if (error) {
    return { error: error.message };
  }

  // Update the batch to link to the component
  await supabase
    .from("roasting_batches")
    .update({ component_id: component.id })
    .eq("id", batchId);

  revalidatePath("/roasting/batches");
  revalidatePath("/components");
  return { component };
}

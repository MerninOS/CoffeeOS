"use server";

import { createClient } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/team";
import { revalidatePath } from "next/cache";

type SessionCostContext = {
  rate_per_hour: number | null;
  cost_mode: "toll_roasting" | "power_usage" | null;
  machine_energy_kwh_per_hour: number | null;
  kwh_rate: number | null;
  setup_minutes: number | null;
  cleanup_minutes: number | null;
  billing_granularity_minutes: number | null;
};

type BatchCostContext = {
  session_id: string;
  roast_minutes: number;
  green_cost_per_g: number;
  green_weight_g: number;
  sellable_g: number;
  roasting_sessions: SessionCostContext | null;
};

function getSessionCostContext(
  sessionRelation: SessionCostContext | SessionCostContext[] | null | undefined
) {
  if (!sessionRelation) return null;
  if (Array.isArray(sessionRelation)) {
    return sessionRelation[0] || null;
  }
  return sessionRelation;
}

function computeSessionTollCost(
  session: SessionCostContext | null,
  totalRoastMinutesForSession: number
) {
  if (!session) return 0;

  const setupMinutes = Number(session.setup_minutes || 0);
  const cleanupMinutes = Number(session.cleanup_minutes || 0);
  const billingGranularityMinutes = Number(
    session.billing_granularity_minutes || 15
  );

  const totalSessionMinutes =
    setupMinutes + Number(totalRoastMinutesForSession || 0) + cleanupMinutes;
  const billableMinutes =
    Math.ceil(totalSessionMinutes / billingGranularityMinutes) *
    billingGranularityMinutes;

  if (session.cost_mode === "power_usage") {
    const machineKwhPerHour = session.machine_energy_kwh_per_hour || 0;
    const kwhRate = session.kwh_rate || 0;
    return (billableMinutes / 60) * Number(machineKwhPerHour) * Number(kwhRate);
  }

  return (billableMinutes / 60) * Number(session.rate_per_hour || 0);
}

function computeBatchCostPerGram(
  batch: BatchCostContext,
  totalRoastMinutesForSession: number,
  batchCountForSession: number
) {
  const sellableG = Number(batch.sellable_g || 0);
  if (sellableG <= 0) return 0;

  const roastMinutes = Number(batch.roast_minutes || 0);
  const setupMinutes = Number(batch.roasting_sessions?.setup_minutes || 0);
  const cleanupMinutes = Number(batch.roasting_sessions?.cleanup_minutes || 0);
  const totalSessionMinutes =
    setupMinutes + Number(totalRoastMinutesForSession || 0) + cleanupMinutes;
  const safeBatchCount = Math.max(Number(batchCountForSession || 0), 1);
  const totalGreenCost =
    Number(batch.green_cost_per_g || 0) * Number(batch.green_weight_g || 0);
  const sessionCost = computeSessionTollCost(
    batch.roasting_sessions,
    totalRoastMinutesForSession
  );
  const batchEffectiveMinutes =
    roastMinutes + (setupMinutes + cleanupMinutes) / safeBatchCount;
  const batchSessionAllocatedCost =
    totalSessionMinutes > 0
      ? sessionCost * (batchEffectiveMinutes / totalSessionMinutes)
      : 0;

  return (totalGreenCost + batchSessionAllocatedCost) / sellableG;
}

type SessionAgg = {
  totalRoastMinutes: number;
  batchCount: number;
};

function buildSessionAggMap(
  sessionBatches: Array<{ session_id: string | null; roast_minutes: number | null }>
) {
  const aggMap: Record<string, SessionAgg> = {};
  for (const sb of sessionBatches) {
    if (!sb.session_id) continue;
    if (!aggMap[sb.session_id]) {
      aggMap[sb.session_id] = { totalRoastMinutes: 0, batchCount: 0 };
    }
    aggMap[sb.session_id].totalRoastMinutes += Number(sb.roast_minutes || 0);
    aggMap[sb.session_id].batchCount += 1;
  }
  return aggMap;
}

// Session Actions
export async function createSession(data: {
  sessionDate: string;
  vendorName: string;
  ratePerHour?: number;
  costMode?: "toll_roasting" | "power_usage";
  machineEnergyKwhPerHour?: number;
  kwhRate?: number;
  setupMinutes?: number;
  cleanupMinutes?: number;
  billingGranularityMinutes?: number;
  allocationMode?: string;
  notes?: string;
}) {
  const supabase = await createClient();
  const { ownerId, error: ownerError } = await getEffectiveOwnerId();

  if (ownerError || !ownerId) {
    return { error: ownerError || "Unauthorized" };
  }

  const { data: session, error } = await supabase
    .from("roasting_sessions")
    .insert({
      user_id: ownerId,
      session_date: data.sessionDate,
      vendor_name: data.vendorName,
      rate_per_hour: data.ratePerHour || 0,
      cost_mode: data.costMode || "toll_roasting",
      machine_energy_kwh_per_hour: data.machineEnergyKwhPerHour || null,
      kwh_rate: data.kwhRate || null,
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
    costMode?: "toll_roasting" | "power_usage";
    machineEnergyKwhPerHour?: number;
    kwhRate?: number;
    setupMinutes?: number;
    cleanupMinutes?: number;
    billingGranularityMinutes?: number;
    allocationMode?: string;
    notes?: string;
  }
) {
  const supabase = await createClient();
  const { ownerId, error: ownerError } = await getEffectiveOwnerId();

  if (ownerError || !ownerId) {
    return { error: ownerError || "Unauthorized" };
  }

  const updateData: Record<string, unknown> = {};
  if (data.sessionDate) updateData.session_date = data.sessionDate;
  if (data.vendorName) updateData.vendor_name = data.vendorName;
  if (data.ratePerHour !== undefined) updateData.rate_per_hour = data.ratePerHour;
  if (data.costMode !== undefined) updateData.cost_mode = data.costMode;
  if (data.machineEnergyKwhPerHour !== undefined) updateData.machine_energy_kwh_per_hour = data.machineEnergyKwhPerHour;
  if (data.kwhRate !== undefined) updateData.kwh_rate = data.kwhRate;
  if (data.setupMinutes !== undefined) updateData.setup_minutes = data.setupMinutes;
  if (data.cleanupMinutes !== undefined) updateData.cleanup_minutes = data.cleanupMinutes;
  if (data.billingGranularityMinutes !== undefined) updateData.billing_granularity_minutes = data.billingGranularityMinutes;
  if (data.allocationMode) updateData.allocation_mode = data.allocationMode;
  if (data.notes !== undefined) updateData.notes = data.notes;

  const { error } = await supabase
    .from("roasting_sessions")
    .update(updateData)
    .eq("id", id)
    .eq("user_id", ownerId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/roasting");
  revalidatePath(`/roasting/sessions/${id}`);
  return { success: true };
}

export async function deleteSession(id: string) {
  const supabase = await createClient();

  const { ownerId: _oid } = await getEffectiveOwnerId();
  if (!_oid) {
    return { error: "Unauthorized" };
  }
  const ownerId = _oid;

  const { error } = await supabase
    .from("roasting_sessions")
    .delete()
    .eq("id", id)
    .eq("user_id", ownerId);

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

  const { ownerId: _oid } = await getEffectiveOwnerId();
  if (!_oid) {
    return { error: "Unauthorized" };
  }
  const ownerId = _oid;

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
      .eq("user_id", ownerId)
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
      user_id: ownerId,
      changed_by_user_id: ownerId,
      change_type: "roast_deduct",
      green_quantity_change_g: -data.greenWeightG,
      reference_type: "roasting_batch",
      notes: `Roasted batch: ${data.coffeeName}`,
    });
  }

  const { data: batch, error } = await supabase
    .from("roasting_batches")
    .insert({
      user_id: ownerId,
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

  // Add sellable amount to roasted stock if using inventory
  if (data.coffeeInventoryId) {
    const { data: currentCoffee } = await supabase
      .from("green_coffee_inventory")
      .select("roasted_stock_g")
      .eq("id", data.coffeeInventoryId)
      .single();

    if (currentCoffee) {
      await supabase
        .from("green_coffee_inventory")
        .update({ 
          roasted_stock_g: (currentCoffee.roasted_stock_g || 0) + sellableG 
        })
        .eq("id", data.coffeeInventoryId);
    }
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

  const { ownerId: _oid } = await getEffectiveOwnerId();
  if (!_oid) {
    return { error: "Unauthorized" };
  }
  const ownerId = _oid;

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
    .eq("user_id", ownerId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/roasting");
  revalidatePath("/roasting/batches");
  return { success: true };
}

export async function deleteBatch(id: string) {
  const supabase = await createClient();

  const { ownerId: _oid } = await getEffectiveOwnerId();
  if (!_oid) {
    return { error: "Unauthorized" };
  }
  const ownerId = _oid;

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
    .eq("user_id", ownerId);

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

  const { ownerId: _oid } = await getEffectiveOwnerId();
  if (!_oid) {
    return { error: "Unauthorized" };
  }
  const ownerId = _oid;

  const { data: settings } = await supabase
    .from("roasting_settings")
    .select("*")
    .eq("user_id", ownerId)
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

  const { ownerId: _oid } = await getEffectiveOwnerId();
  if (!_oid) {
    return { error: "Unauthorized" };
  }
  const ownerId = _oid;

  const { data: existing } = await supabase
    .from("roasting_settings")
    .select("id")
    .eq("user_id", ownerId)
    .maybeSingle();

  const settingsData = {
    user_id: ownerId,
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
  greenCoffeeId: string;
  coffeeName: string;
  requestedRoastedG: number;
  priority?: "low" | "normal" | "high" | "urgent";
  dueDate?: string;
  orderId?: string;
  notes?: string;
}) {
  const supabase = await createClient();

  const { ownerId: _oid } = await getEffectiveOwnerId();
  if (!_oid) {
    return { error: "Unauthorized" };
  }
  const ownerId = _oid;

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

    revalidatePath("/roasting");
    revalidatePath("/orders");
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
      order_id: data.orderId || null,
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
    requestedRoastedG?: number;
    priority?: "low" | "normal" | "high" | "urgent";
    status?: "pending" | "in_progress" | "fulfilled" | "cancelled";
    dueDate?: string;
    notes?: string;
  }
) {
  const supabase = await createClient();

  const { ownerId: _oid } = await getEffectiveOwnerId();
  if (!_oid) {
    return { error: "Unauthorized" };
  }
  const ownerId = _oid;

  const updateData: Record<string, unknown> = {};
  if (data.requestedRoastedG !== undefined) updateData.requested_roasted_g = data.requestedRoastedG;
  if (data.priority !== undefined) updateData.priority = data.priority;
  if (data.status !== undefined) updateData.status = data.status;
  if (data.dueDate !== undefined) updateData.due_date = data.dueDate;
  if (data.notes !== undefined) updateData.notes = data.notes;

  const { error } = await supabase
    .from("roast_requests")
    .update(updateData)
    .eq("id", id)
    .eq("user_id", ownerId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/roasting");
  return { success: true };
}

export async function deleteRoastRequest(id: string) {
  const supabase = await createClient();

  const { ownerId: _oid } = await getEffectiveOwnerId();
  if (!_oid) {
    return { error: "Unauthorized" };
  }
  const ownerId = _oid;

  const { error } = await supabase
    .from("roast_requests")
    .delete()
    .eq("id", id)
    .eq("user_id", ownerId);

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

  const { ownerId: _oid } = await getEffectiveOwnerId();
  if (!_oid) {
    return { error: "Unauthorized" };
  }
  const ownerId = _oid;

  // Get the current request
  const { data: request, error: fetchError } = await supabase
    .from("roast_requests")
    .select("*")
    .eq("id", data.requestId)
    .eq("user_id", ownerId)
    .single();

  if (fetchError || !request) {
    return { error: "Request not found" };
  }

  // Create fulfillment record
  const { error: fulfillError } = await supabase
    .from("roast_request_fulfillments")
    .insert({
      roast_request_id: data.requestId,
      roasting_batch_id: data.batchId,
      quantity_g: data.quantityG,
      source_type: "batch",
    });

  if (fulfillError) {
    return { error: fulfillError.message };
  }

  // Update the request's fulfilled quantity and status
  const newFulfilledQuantity = (request.fulfilled_roasted_g || 0) + data.quantityG;
  const newStatus = newFulfilledQuantity >= request.requested_roasted_g ? "fulfilled" : "in_progress";

  const { error: updateError } = await supabase
    .from("roast_requests")
    .update({
      fulfilled_roasted_g: newFulfilledQuantity,
      status: newStatus,
      ...(newStatus === "fulfilled" ? { fulfilled_at: new Date().toISOString() } : {}),
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

  const { ownerId: _oid } = await getEffectiveOwnerId();
  if (!_oid) {
    return { error: "Unauthorized" };
  }
  const ownerId = _oid;

  // Get the batch details
  const { data: batch } = await supabase
    .from("roasting_batches")
    .select(`
      *,
      roasting_sessions(
        session_date,
        rate_per_hour,
        cost_mode,
        machine_energy_kwh_per_hour,
        kwh_rate,
        setup_minutes,
        cleanup_minutes,
        billing_granularity_minutes
      )
    `)
    .eq("id", batchId)
    .single();

  if (!batch) {
    return { error: "Batch not found" };
  }

  const { data: sessionBatches } = await supabase
    .from("roasting_batches")
    .select("session_id, roast_minutes")
    .eq("session_id", batch.session_id)
    .eq("user_id", ownerId);
  const sessionAggMap = buildSessionAggMap(sessionBatches || []);
  const sessionAgg = sessionAggMap[batch.session_id] || {
    totalRoastMinutes: Number(batch.roast_minutes || 0),
    batchCount: 1,
  };

  const computedCostPerG = computeBatchCostPerGram(
    {
      session_id: batch.session_id,
      roast_minutes: batch.roast_minutes || 0,
      green_cost_per_g: batch.green_cost_per_g || 0,
      green_weight_g: batch.green_weight_g || 0,
      sellable_g: batch.sellable_g || 0,
      roasting_sessions: getSessionCostContext(
        batch.roasting_sessions as SessionCostContext | SessionCostContext[] | null
      ),
    },
    sessionAgg.totalRoastMinutes,
    sessionAgg.batchCount
  );

  // Create the component
  const { data: component, error } = await supabase
    .from("components")
    .insert({
      user_id: ownerId,
      name: data.name,
      type: "ingredient",
      cost_per_unit: computedCostPerG || data.costPerUnit,
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

// Add roasted coffee to an existing component with averaged pricing
export async function addToExistingComponent(
  batchId: string,
  componentId: string
) {
  const supabase = await createClient();

  const { ownerId: _oid } = await getEffectiveOwnerId();
  if (!_oid) {
    return { error: "Unauthorized" };
  }
  const ownerId = _oid;

  // Get the batch details
  const { data: batch } = await supabase
    .from("roasting_batches")
    .select(`
      *,
      roasting_sessions(
        session_date,
        rate_per_hour,
        cost_mode,
        machine_energy_kwh_per_hour,
        kwh_rate,
        setup_minutes,
        cleanup_minutes,
        billing_granularity_minutes
      )
    `)
    .eq("id", batchId)
    .eq("user_id", ownerId)
    .single();

  if (!batch) {
    return { error: "Batch not found" };
  }

  // Get the existing component
  const { data: existingComponent } = await supabase
    .from("components")
    .select("*")
    .eq("id", componentId)
    .eq("user_id", ownerId)
    .single();

  if (!existingComponent) {
    return { error: "Component not found" };
  }

  // Get total sellable weight from existing linked batches
  const { data: linkedBatches } = await supabase
    .from("roasting_batches")
    .select(`
      session_id,
      roast_minutes,
      sellable_g,
      green_cost_per_g,
      green_weight_g,
      roasting_sessions(
        rate_per_hour,
        cost_mode,
        machine_energy_kwh_per_hour,
        kwh_rate,
        setup_minutes,
        cleanup_minutes,
        billing_granularity_minutes
      )
    `)
    .eq("user_id", ownerId)
    .eq("component_id", componentId)
    .neq("id", batchId);

  const sessionIds = Array.from(
    new Set(
      [batch.session_id, ...(linkedBatches || []).map((lb) => lb.session_id)].filter(
        Boolean
      )
    )
  ) as string[];

  const { data: sessionBatches } = await supabase
    .from("roasting_batches")
    .select("session_id, roast_minutes")
    .eq("user_id", ownerId)
    .in("session_id", sessionIds);
  const sessionAggMap = buildSessionAggMap(sessionBatches || []);

  // Calculate existing total cost and quantity
  let existingTotalCost = 0;
  let existingTotalQuantityG = 0;

  if (linkedBatches && linkedBatches.length > 0) {
    for (const lb of linkedBatches) {
      const linkedSellableG = Number(lb.sellable_g || 0);
      const linkedSessionAgg = sessionAggMap[lb.session_id] || {
        totalRoastMinutes: Number(lb.roast_minutes || 0),
        batchCount: 1,
      };
      const costPerG = computeBatchCostPerGram(
        {
          session_id: lb.session_id,
          roast_minutes: lb.roast_minutes || 0,
          sellable_g: lb.sellable_g || 0,
          green_cost_per_g: lb.green_cost_per_g || 0,
          green_weight_g: lb.green_weight_g || 0,
          roasting_sessions: getSessionCostContext(
            lb.roasting_sessions as SessionCostContext | SessionCostContext[] | null
          ),
        },
        linkedSessionAgg.totalRoastMinutes,
        linkedSessionAgg.batchCount
      );

      existingTotalCost += costPerG * linkedSellableG;
      existingTotalQuantityG += linkedSellableG;
    }
  }

  // Add this batch's contribution
  const newQuantityG = Number(batch.sellable_g || 0);
  const newBatchSessionAgg = sessionAggMap[batch.session_id] || {
    totalRoastMinutes: Number(batch.roast_minutes || 0),
    batchCount: 1,
  };
  const newBatchCostPerG = computeBatchCostPerGram(
    {
      session_id: batch.session_id,
      roast_minutes: batch.roast_minutes || 0,
      sellable_g: batch.sellable_g || 0,
      green_cost_per_g: batch.green_cost_per_g || 0,
      green_weight_g: batch.green_weight_g || 0,
      roasting_sessions: getSessionCostContext(
        batch.roasting_sessions as SessionCostContext | SessionCostContext[] | null
      ),
    },
    newBatchSessionAgg.totalRoastMinutes,
    newBatchSessionAgg.batchCount
  );
  const newBatchTotalCost = newBatchCostPerG * newQuantityG;
  const totalQuantityG = existingTotalQuantityG + newQuantityG;
  const totalCost = existingTotalCost + newBatchTotalCost;

  // Calculate new averaged cost per gram
  const newCostPerG = totalQuantityG > 0 ? totalCost / totalQuantityG : 0;

  // Update the component with averaged cost
  const { data: updatedComponent, error: updateError } = await supabase
    .from("components")
    .update({
      cost_per_unit: newCostPerG,
      notes: `${existingComponent.notes || ""}\nAdded batch "${batch.coffee_name}" (${batch.sellable_g}g) on ${batch.roasting_sessions?.session_date || batch.batch_date || "unknown date"}. Lot: ${batch.lot_code || "N/A"}`.trim(),
    })
    .eq("id", componentId)
    .select()
    .single();

  if (updateError) {
    return { error: updateError.message };
  }

  // Link the batch to the component
  await supabase
    .from("roasting_batches")
    .update({ component_id: componentId })
    .eq("id", batchId);

  revalidatePath("/roasting/batches");
  revalidatePath("/components");
  return { 
    component: updatedComponent,
    previousCost: existingComponent.cost_per_unit,
    newAveragedCost: newCostPerG,
    totalQuantityG,
  };
}

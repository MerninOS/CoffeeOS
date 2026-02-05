"use server";

import { createClient } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/team";
import { revalidatePath } from "next/cache";

// Conversion: 1 lb = 453.592 grams
const LBS_TO_GRAMS = 453.592;

export async function createCoffeeInventory(data: {
  name: string;
  origin: string;
  lot_code?: string;
  supplier?: string;
  price_per_lb: number;
  quantity_lbs: number;
  purchase_date?: string;
  notes?: string;
}) {
  const supabase = await createClient();
  const { ownerId, userId, error: ownerError } = await getEffectiveOwnerId();

  if (ownerError || !ownerId || !userId) {
    return { error: ownerError || "Unauthorized" };
  }

  const quantityGrams = data.quantity_lbs * LBS_TO_GRAMS;

  const { data: inventory, error } = await supabase
    .from("green_coffee_inventory")
    .insert({
      user_id: ownerId,
      name: data.name,
      origin: data.origin,
      lot_code: data.lot_code || null,
      supplier: data.supplier || null,
      price_per_lb: data.price_per_lb,
      initial_quantity_g: quantityGrams,
      current_green_quantity_g: quantityGrams,
      purchase_date: data.purchase_date || null,
      notes: data.notes || null,
    })
    .select()
    .single();

  if (error) {
    return { error: error.message };
  }

  await supabase.from("coffee_inventory_changes").insert({
    coffee_id: inventory.id,
    user_id: ownerId,
    changed_by_user_id: userId,
    change_type: "initial",
    green_quantity_change_g: quantityGrams,
    notes: "Initial inventory",
  });

  revalidatePath("/inventory");
  return { success: true, data: inventory };
}

export async function updateCoffeeInventory(
  id: string,
  data: {
    name?: string;
    origin?: string;
    lot_code?: string;
    supplier?: string;
    price_per_lb?: number;
    purchase_date?: string;
    notes?: string;
  }
) {
  const supabase = await createClient();
  const { ownerId, error: ownerError } = await getEffectiveOwnerId();

  if (ownerError || !ownerId) {
    return { error: ownerError || "Unauthorized" };
  }

  const { error } = await supabase
    .from("green_coffee_inventory")
    .update(data)
    .eq("id", id)
    .eq("user_id", ownerId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/inventory");
  return { success: true };
}

export async function adjustInventoryQuantity(
  coffeeId: string,
  changeType: "manual_green_adjust" | "roast_deduct" | "roast_add" | "sale_deduct",
  quantityChangeLbs: number,
  notes?: string,
  referenceId?: string,
  referenceType?: "roasting_batch" | "order" | "manual"
) {
  const supabase = await createClient();
  const { ownerId, userId, error: ownerError } = await getEffectiveOwnerId();

  if (ownerError || !ownerId || !userId) {
    return { error: ownerError || "Unauthorized" };
  }

  const { data: coffee, error: fetchError } = await supabase
    .from("green_coffee_inventory")
    .select("current_green_quantity_g, user_id")
    .eq("id", coffeeId)
    .single();

  if (fetchError || !coffee) {
    return { error: "Coffee not found" };
  }

  if (coffee.user_id !== ownerId) {
    return { error: "Unauthorized" };
  }

  const quantityChangeGrams = quantityChangeLbs * LBS_TO_GRAMS;
  const newQuantityGrams = coffee.current_green_quantity_g + quantityChangeGrams;

  if (newQuantityGrams < 0) {
    return { error: "Insufficient inventory" };
  }

  const { error: updateError } = await supabase
    .from("green_coffee_inventory")
    .update({ current_green_quantity_g: newQuantityGrams })
    .eq("id", coffeeId);

  if (updateError) {
    return { error: updateError.message };
  }

  const { error: changeError } = await supabase
    .from("coffee_inventory_changes")
    .insert({
      coffee_id: coffeeId,
      user_id: ownerId,
      changed_by_user_id: userId,
      change_type: changeType,
      green_quantity_change_g: quantityChangeGrams,
      reference_id: referenceId || null,
      reference_type: referenceType || "manual",
      notes,
    });

  if (changeError) {
    return { error: changeError.message };
  }

  revalidatePath("/inventory");
  revalidatePath("/roasting");
  return { success: true };
}

export async function deleteCoffeeInventory(id: string) {
  const supabase = await createClient();
  const { ownerId, error: ownerError } = await getEffectiveOwnerId();

  if (ownerError || !ownerId) {
    return { error: ownerError || "Unauthorized" };
  }

  const { error } = await supabase
    .from("green_coffee_inventory")
    .delete()
    .eq("id", id)
    .eq("user_id", ownerId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/inventory");
  return { success: true };
}

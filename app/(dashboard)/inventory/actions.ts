"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function createCoffeeInventory(data: {
  name: string;
  origin: string;
  region?: string;
  farm?: string;
  process?: string;
  variety?: string;
  harvest_date?: string;
  cost_per_lb: number;
  quantity_lbs: number;
  notes?: string;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Unauthorized" };
  }

  const { data: inventory, error } = await supabase
    .from("green_coffee_inventory")
    .insert({
      user_id: user.id,
      ...data,
    })
    .select()
    .single();

  if (error) {
    return { error: error.message };
  }

  // Record the initial addition
  await supabase.from("coffee_inventory_changes").insert({
    coffee_id: inventory.id,
    change_type: "purchase",
    quantity_change: data.quantity_lbs,
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
    region?: string;
    farm?: string;
    process?: string;
    variety?: string;
    harvest_date?: string;
    cost_per_lb?: number;
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

  const { error } = await supabase
    .from("green_coffee_inventory")
    .update(data)
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/inventory");
  return { success: true };
}

export async function adjustInventoryQuantity(
  coffeeId: string,
  changeType: "purchase" | "roast" | "adjustment" | "waste",
  quantityChange: number,
  notes?: string,
  roastBatchId?: string
) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Unauthorized" };
  }

  // Get current inventory
  const { data: coffee, error: fetchError } = await supabase
    .from("green_coffee_inventory")
    .select("quantity_lbs, user_id")
    .eq("id", coffeeId)
    .single();

  if (fetchError || !coffee) {
    return { error: "Coffee not found" };
  }

  if (coffee.user_id !== user.id) {
    return { error: "Unauthorized" };
  }

  const newQuantity = coffee.quantity_lbs + quantityChange;
  if (newQuantity < 0) {
    return { error: "Insufficient inventory" };
  }

  // Update quantity
  const { error: updateError } = await supabase
    .from("green_coffee_inventory")
    .update({ quantity_lbs: newQuantity })
    .eq("id", coffeeId);

  if (updateError) {
    return { error: updateError.message };
  }

  // Record the change
  const { error: changeError } = await supabase
    .from("coffee_inventory_changes")
    .insert({
      coffee_id: coffeeId,
      change_type: changeType,
      quantity_change: quantityChange,
      roast_batch_id: roastBatchId,
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Unauthorized" };
  }

  const { error } = await supabase
    .from("green_coffee_inventory")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/inventory");
  return { success: true };
}

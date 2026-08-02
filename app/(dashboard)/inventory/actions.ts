"use server";

import { createClient } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/team";
import { revalidatePath } from "next/cache";
import { lbsToGrams } from "@/lib/inventory/units";
import { toMovements, type Movement, type MovementRow } from "@/lib/inventory/movements";


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

  const quantityGrams = lbsToGrams(data.quantity_lbs);

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

  const quantityChangeGrams = lbsToGrams(quantityChangeLbs);
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

/**
 * One lot's change history, newest first.
 *
 * LAZY BY DESIGN. This is invoked when a row is expanded, not with the page —
 * the log grows without bound and a catalogue view would fetch every lot's
 * history to render none of it (spec Criterion 13).
 *
 * SCOPED BY ownerId EXPLICITLY, on top of the team-scoped RLS in
 * 017_team_write_policies.sql. The policy is the real boundary; this matches
 * what the other four actions in this file do, and defence in depth costs one
 * `.eq()`.
 *
 * The actor comes from a `profiles` join. An OWNER's own profile row has a null
 * `owner_id`, and `profiles_select` does not grant an employee access to it, so
 * that join legitimately returns nothing for owner-made changes — `actorLabel`
 * turns it into "Owner" rather than a blank (Criterion 14a).
 *
 * CAPPED AT 20 and the cap is REPORTED. A lot roasted weekly for a year has
 * ~50 rows, and price changes add more. Returning a silently truncated list
 * from a panel whose whole claim is "this explains where the coffee went" is
 * exactly the kind of quiet lie the rest of this ticket argues against, so the
 * caller is told whether more exist.
 */
const MOVEMENT_LIMIT = 20;

export async function getLotMovements(
  coffeeId: string,
): Promise<{ movements?: Movement[]; hasMore?: boolean; error?: string }> {
  const supabase = await createClient();
  const { ownerId, error: ownerError } = await getEffectiveOwnerId();

  if (ownerError || !ownerId) {
    return { error: ownerError || "Unauthorized" };
  }

  // One extra row is the cheapest way to know whether the list is partial.
  const { data, error } = await supabase
    .from("coffee_inventory_changes")
    .select(
      `id, change_type, green_quantity_change_g, old_price_per_lb,
       new_price_per_lb, reference_type, notes, created_at,
       profiles:changed_by_user_id ( full_name )`,
    )
    .eq("coffee_id", coffeeId)
    .eq("user_id", ownerId)
    .order("created_at", { ascending: false })
    .limit(MOVEMENT_LIMIT + 1);

  if (error) {
    return { error: error.message };
  }

  const rows = data || [];
  const hasMore = rows.length > MOVEMENT_LIMIT;

  const mapped: MovementRow[] = rows.slice(0, MOVEMENT_LIMIT).map((row) => {
    // Supabase types a nested relation as an ARRAY even when it is many-to-one,
    // so `profiles` arrives typed `{...}[]` while at runtime it is a single
    // object. Normalise both, exactly as lib/orders/cogs.ts does for the same
    // quirk, rather than asserting a shape that is untrue to the type.
    const rel = (row as { profiles?: unknown }).profiles as
      | { full_name: string | null }
      | { full_name: string | null }[]
      | null;
    const one = Array.isArray(rel) ? rel[0] : rel;
    return {
      id: row.id as string,
      change_type: row.change_type as MovementRow["change_type"],
      green_quantity_change_g: row.green_quantity_change_g as number | null,
      old_price_per_lb: row.old_price_per_lb as number | null,
      new_price_per_lb: row.new_price_per_lb as number | null,
      reference_type: row.reference_type as MovementRow["reference_type"],
      notes: row.notes as string | null,
      created_at: row.created_at as string,
      actorName: one?.full_name ?? null,
    };
  });

  return { movements: toMovements(mapped), hasMore };
}

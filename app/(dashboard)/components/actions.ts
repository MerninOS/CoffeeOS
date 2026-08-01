"use server";

import { createClient } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/team";
import { revalidatePath } from "next/cache";

export async function createComponent(data: {
  name: string;
  type: string;
  costPerUnit: number;
  unit: string;
  notes?: string;
}) {
  const supabase = await createClient();
  const { ownerId, error: ownerError } = await getEffectiveOwnerId();

  if (ownerError || !ownerId) {
    return { error: ownerError || "Unauthorized" };
  }

  const { data: component, error } = await supabase
    .from("components")
    .insert({
      user_id: ownerId,
      name: data.name,
      type: data.type,
      cost_per_unit: data.costPerUnit,
      unit: data.unit,
      notes: data.notes || null,
    })
    .select()
    .single();

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/components", "max");
  return { success: true, component };
}

export async function updateComponent(
  id: string,
  data: {
    name: string;
    type: string;
    costPerUnit: number;
    unit: string;
    notes?: string;
  }
) {
  const supabase = await createClient();
  const { ownerId, error: ownerError } = await getEffectiveOwnerId();

  if (ownerError || !ownerId) {
    return { error: ownerError || "Unauthorized" };
  }

  const { error } = await supabase
    .from("components")
    .update({
      name: data.name,
      type: data.type,
      cost_per_unit: data.costPerUnit,
      unit: data.unit,
      notes: data.notes || null,
    })
    .eq("id", id)
    .eq("user_id", ownerId);

  if (error) {
    return { error: error.message };
  }

  // No COGS write-back here: `products` has no `total_cogs` column. Both
  // /products and /dashboard derive product cost at read time by joining
  // product_components -> components.cost_per_unit, so editing a component's
  // cost is already reflected on the next render — the revalidations below are
  // what actually propagate this change, and both are load-bearing.
  //
  // (The block that used to live here looped over every referencing product and
  // issued `products.update({ total_cogs })`. The column does not exist, the
  // result was never destructured, so every one of those writes failed silently
  // — one wasted query per referencing product on each save.)
  revalidatePath("/components", "max");
  revalidatePath("/products", "max");
  revalidatePath("/dashboard", "max");

  return { success: true };
}

export async function deleteComponent(id: string) {
  const supabase = await createClient();
  const { ownerId, error: ownerError } = await getEffectiveOwnerId();

  if (ownerError || !ownerId) {
    return { error: ownerError || "Unauthorized" };
  }

  // Check if component is used in any products
  const { data: usedInProducts } = await supabase
    .from("product_components")
    .select("product_id")
    .eq("component_id", id);

  if (usedInProducts && usedInProducts.length > 0) {
    return {
      error: `This component is used in ${usedInProducts.length} product(s). Remove it from products before deleting.`,
    };
  }

  const { error } = await supabase
    .from("components")
    .delete()
    .eq("id", id)
    .eq("user_id", ownerId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/components", "max");
  return { success: true };
}

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

  // No second argument. `revalidatePath`'s optional second parameter is a route
  // TYPE ("page" | "layout"), not a cache-lifetime profile — the "max" that used
  // to be passed here belongs to `revalidateTag`, which grew a profile argument
  // in Next 16 and is easy to confuse with this. Next does not validate it: the
  // value is concatenated onto the tag, so `revalidatePath("/components", "max")`
  // invalidated `_N_T_/components/max`, a tag no route ever registers. It was a
  // silent no-op. Bare, the tag is `_N_T_/components`, which /components does
  // register from its pathname — matching every other call site in this repo.
  revalidatePath("/components");
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
  // what propagate this change, and all three are load-bearing.
  //
  // (The block that used to live here looped over every referencing product and
  // issued `products.update({ total_cogs })`. The column does not exist, the
  // result was never destructured, so every one of those writes failed silently
  // — one wasted query per referencing product on each save.)
  //
  // /products and /dashboard are revalidated, not just /components, precisely
  // because they read component costs: app/(dashboard)/products/page.tsx joins
  // `product_components ( quantity, components ( cost_per_unit ) )` through
  // lib/products/costing.ts, and the dashboard builds its own productCogs map
  // from the same join. See createComponent above for why none of these pass a
  // second argument.
  revalidatePath("/components");
  revalidatePath("/products");
  revalidatePath("/dashboard");

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

  revalidatePath("/components");
  return { success: true };
}

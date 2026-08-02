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

/**
 * What a component is wired into, scoped to the acting owner.
 *
 * NONE of the three join tables carries a `user_id` of its own, so each has to
 * be scoped through its parent — `products`, `product_variants`, `orders` — the
 * same `!inner(user_id)` idiom orders/actions.ts uses. The check this replaces
 * filtered on `component_id` alone, so another tenant's recipe could block your
 * delete and leak its count.
 *
 * The three numbers are NOT the same kind of fact, which is why they are
 * reported separately rather than summed:
 *
 *   recipes / variantRecipes  FORWARD-looking. Those products get cheaper from
 *                             now on, and the operator can detach the component
 *                             first, so these BLOCK the delete.
 *   orders / orderCost        RETROACTIVE. lib/orders/cogs.ts computes order
 *                             COGS live from the join — nothing is snapshotted
 *                             at fulfilment — so deleting the component removes
 *                             those cost lines and the margin on already-shipped
 *                             orders silently improves. Nobody can "detach" a
 *                             shipped order, so this WARNS instead of blocking.
 */
export type ComponentUsage = {
  recipes: number;
  variantRecipes: number;
  orders: number;
  orderCost: number;
};

export async function getComponentUsage(
  id: string
): Promise<{ usage?: ComponentUsage; error?: string }> {
  const supabase = await createClient();
  const { ownerId, error: ownerError } = await getEffectiveOwnerId();

  if (ownerError || !ownerId) {
    return { error: ownerError || "Unauthorized" };
  }

  const [{ data: recipes }, { data: variantRecipes }, { data: orderRows }, { data: component }] =
    await Promise.all([
      supabase
        .from("product_components")
        .select("id, products!inner(user_id)")
        .eq("component_id", id)
        .eq("products.user_id", ownerId),
      supabase
        .from("product_variant_components")
        .select("id, product_variants!inner(user_id)")
        .eq("component_id", id)
        .eq("product_variants.user_id", ownerId),
      supabase
        .from("order_components")
        .select("order_id, quantity, orders!inner(user_id)")
        .eq("component_id", id)
        .eq("orders.user_id", ownerId),
      supabase
        .from("components")
        .select("cost_per_unit")
        .eq("id", id)
        .eq("user_id", ownerId)
        .maybeSingle(),
    ]);

  const rows = orderRows ?? [];
  const costPerUnit = component?.cost_per_unit ?? 0;

  return {
    usage: {
      recipes: recipes?.length ?? 0,
      variantRecipes: variantRecipes?.length ?? 0,
      // DISTINCT orders — one order can carry several rows for the same
      // component, and "9 past orders" must mean nine orders.
      orders: new Set(rows.map((r) => r.order_id)).size,
      orderCost: rows.reduce((sum, r) => sum + Number(r.quantity) * Number(costPerUnit), 0),
    },
  };
}

export async function deleteComponent(id: string) {
  const supabase = await createClient();
  const { ownerId, error: ownerError } = await getEffectiveOwnerId();

  if (ownerError || !ownerId) {
    return { error: ownerError || "Unauthorized" };
  }

  /**
   * Block on anything the operator can actually detach first.
   *
   * Previously this checked `product_components` only, so a component used
   * solely in a VARIANT recipe deleted cleanly and the row vanished by cascade
   * — every FK into `components` is ON DELETE CASCADE (roasting_batches is SET
   * NULL). The seed's own data contains such a component.
   *
   * Past orders are deliberately NOT blocking: a shipped order cannot be
   * edited, so blocking would make the component permanently undeletable. The
   * confirm dialog warns with the count and the cost instead.
   */
  const { usage, error: usageError } = await getComponentUsage(id);
  if (usageError || !usage) {
    return { error: usageError || "Could not check what this component is used in" };
  }

  if (usage.recipes > 0 || usage.variantRecipes > 0) {
    const parts: string[] = [];
    if (usage.recipes > 0) {
      parts.push(`${usage.recipes} product recipe${usage.recipes === 1 ? "" : "s"}`);
    }
    if (usage.variantRecipes > 0) {
      parts.push(
        `${usage.variantRecipes} variant recipe${usage.variantRecipes === 1 ? "" : "s"}`
      );
    }
    return {
      error: `This component is used in ${parts.join(" and ")}. Remove it there before deleting.`,
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

"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function createComponent(data: {
  name: string;
  type: string;
  costPerUnit: number;
  unit: string;
  notes?: string;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Unauthorized" };
  }

  const { data: component, error } = await supabase
    .from("components")
    .insert({
      user_id: user.id,
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Unauthorized" };
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
    .eq("user_id", user.id);

  if (error) {
    return { error: error.message };
  }

  // Recalculate COGS for all products using this component
  const { data: productComponents } = await supabase
    .from("product_components")
    .select("product_id")
    .eq("component_id", id);

  if (productComponents && productComponents.length > 0) {
    const productIds = [...new Set(productComponents.map((pc) => pc.product_id))];

    for (const productId of productIds) {
      // Recalculate total COGS for each product
      const { data: pcs } = await supabase
        .from("product_components")
        .select(
          `
          quantity,
          components (
            cost_per_unit
          )
        `
        )
        .eq("product_id", productId);

      const totalCogs =
        pcs?.reduce((sum, pc) => {
          const component = pc.components as { cost_per_unit: number } | null;
          if (component) {
            return sum + pc.quantity * component.cost_per_unit;
          }
          return sum;
        }, 0) || 0;

      await supabase
        .from("products")
        .update({ total_cogs: totalCogs })
        .eq("id", productId);
    }
  }

  revalidatePath("/components", "max");
  revalidatePath("/products", "max");
  revalidatePath("/dashboard", "max");

  return { success: true };
}

export async function deleteComponent(id: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Unauthorized" };
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
    .eq("user_id", user.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/components", "max");
  return { success: true };
}

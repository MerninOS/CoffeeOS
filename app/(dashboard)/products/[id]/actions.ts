"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function updateProductComponents(
  productId: string,
  components: Array<{
    componentId: string;
    quantity: number;
  }>
) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Unauthorized" };
  }

  // Verify product ownership
  const { data: product } = await supabase
    .from("products")
    .select("id")
    .eq("id", productId)
    .eq("user_id", user.id)
    .single();

  if (!product) {
    return { error: "Product not found" };
  }

  // Delete existing product components
  await supabase
    .from("product_components")
    .delete()
    .eq("product_id", productId);

  // Insert new product components
  if (components.length > 0) {
    const { error: insertError } = await supabase
      .from("product_components")
      .insert(
        components.map((c) => ({
          product_id: productId,
          component_id: c.componentId,
          quantity: c.quantity,
        }))
      );

    if (insertError) {
      return { error: insertError.message };
    }
  }

  // Calculate total COGS for return value (not stored in DB - calculated dynamically)
  const { data: productComponents } = await supabase
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
    productComponents?.reduce((sum, pc) => {
      const component = pc.components as { cost_per_unit: number } | null;
      if (component) {
        return sum + pc.quantity * component.cost_per_unit;
      }
      return sum;
    }, 0) || 0;

  revalidatePath(`/products/${productId}`, "max");
  revalidatePath("/products", "max");
  revalidatePath("/dashboard", "max");

  return { success: true, totalCogs };
}

export async function updateProductPrice(productId: string, price: number) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Unauthorized" };
  }

  const { error } = await supabase
    .from("products")
    .update({ price })
    .eq("id", productId)
    .eq("user_id", user.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/products/${productId}`, "max");
  revalidatePath("/products", "max");
  revalidatePath("/dashboard", "max");

  return { success: true };
}

export async function updateWholesalePricing(
  productId: string,
  data: {
    wholesale_enabled: boolean;
    wholesale_price: number | null;
    wholesale_minimum_qty: number;
    price_tiers: Array<{ min_quantity: number; price: number }>;
  }
) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Unauthorized" };
  }

  // Verify product ownership
  const { data: product } = await supabase
    .from("products")
    .select("id")
    .eq("id", productId)
    .eq("user_id", user.id)
    .single();

  if (!product) {
    return { error: "Product not found" };
  }

  // Update product wholesale settings
  const { error: updateError } = await supabase
    .from("products")
    .update({
      wholesale_enabled: data.wholesale_enabled,
      wholesale_price: data.wholesale_price,
      wholesale_minimum_qty: data.wholesale_minimum_qty,
    })
    .eq("id", productId);

  if (updateError) {
    return { error: updateError.message };
  }

  // Delete existing price tiers
  await supabase
    .from("wholesale_price_tiers")
    .delete()
    .eq("product_id", productId);

  // Insert new price tiers
  if (data.price_tiers.length > 0) {
    const { error: insertError } = await supabase
      .from("wholesale_price_tiers")
      .insert(
        data.price_tiers.map((tier) => ({
          product_id: productId,
          min_quantity: tier.min_quantity,
          price: tier.price,
        }))
      );

    if (insertError) {
      return { error: insertError.message };
    }
  }

  revalidatePath(`/products/${productId}`, "max");
  revalidatePath("/products", "max");

  return { success: true };
}

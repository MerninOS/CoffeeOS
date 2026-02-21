"use server";

import { createClient } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/team";
import { revalidatePath } from "next/cache";

function extractCostPerUnit(value: unknown): number {
  if (Array.isArray(value)) {
    return (value[0] as { cost_per_unit?: number } | undefined)?.cost_per_unit || 0;
  }
  return (value as { cost_per_unit?: number } | null)?.cost_per_unit || 0;
}

export async function updateProductComponents(
  productId: string,
  components: Array<{
    componentId: string;
    quantity: number;
  }>
) {
  const supabase = await createClient();
  const { ownerId, error: ownerError } = await getEffectiveOwnerId();

  if (ownerError || !ownerId) {
    return { error: ownerError || "Unauthorized" };
  }

  // Verify product ownership
  const { data: product } = await supabase
    .from("products")
    .select("id")
    .eq("id", productId)
    .eq("user_id", ownerId)
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
      return sum + pc.quantity * extractCostPerUnit(pc.components);
    }, 0) || 0;

  revalidatePath(`/products/${productId}`);
  revalidatePath("/products");
  revalidatePath("/dashboard");

  return { success: true, totalCogs };
}

export async function updateProductVariantComponents(
  productId: string,
  variantId: string,
  components: Array<{
    componentId: string;
    quantity: number;
  }>
) {
  const supabase = await createClient();
  const { ownerId, error: ownerError } = await getEffectiveOwnerId();

  if (ownerError || !ownerId) {
    return { error: ownerError || "Unauthorized" };
  }

  const { data: variant, error: variantError } = await supabase
    .from("product_variants")
    .select("id, product_id")
    .eq("id", variantId)
    .eq("product_id", productId)
    .eq("user_id", ownerId)
    .single();

  if (variantError || !variant) {
    return { error: "Variant not found" };
  }

  await supabase
    .from("product_variant_components")
    .delete()
    .eq("product_variant_id", variantId);

  if (components.length > 0) {
    const { error: insertError } = await supabase
      .from("product_variant_components")
      .insert(
        components.map((c) => ({
          product_variant_id: variantId,
          component_id: c.componentId,
          quantity: c.quantity,
        }))
      );

    if (insertError) {
      return { error: insertError.message };
    }
  }

  const { data: variantComponents } = await supabase
    .from("product_variant_components")
    .select(
      `
      quantity,
      components (
        cost_per_unit
      )
    `
    )
    .eq("product_variant_id", variantId);

  const totalCogs =
    variantComponents?.reduce((sum, pc) => {
      return sum + pc.quantity * extractCostPerUnit(pc.components);
    }, 0) || 0;

  revalidatePath(`/products/${productId}`);
  revalidatePath("/products");
  revalidatePath("/dashboard");

  return { success: true, totalCogs };
}

export async function cloneProductVariantCogs(
  productId: string,
  sourceVariantId: string,
  targetVariantId: string
) {
  const supabase = await createClient();
  const { ownerId, error: ownerError } = await getEffectiveOwnerId();

  if (ownerError || !ownerId) {
    return { error: ownerError || "Unauthorized" };
  }

  if (sourceVariantId === targetVariantId) {
    return { error: "Source and target variants must be different" };
  }

  const { data: variants, error: variantsError } = await supabase
    .from("product_variants")
    .select("id")
    .in("id", [sourceVariantId, targetVariantId])
    .eq("product_id", productId)
    .eq("user_id", ownerId);

  if (variantsError || !variants || variants.length !== 2) {
    return { error: "One or more variants are invalid" };
  }

  const { data: sourceRows, error: sourceError } = await supabase
    .from("product_variant_components")
    .select("component_id, quantity")
    .eq("product_variant_id", sourceVariantId);

  if (sourceError) {
    return { error: sourceError.message };
  }

  const { error: deleteError } = await supabase
    .from("product_variant_components")
    .delete()
    .eq("product_variant_id", targetVariantId);

  if (deleteError) {
    return { error: deleteError.message };
  }

  if ((sourceRows || []).length > 0) {
    const { error: insertError } = await supabase
      .from("product_variant_components")
      .insert(
        (sourceRows || []).map((row) => ({
          product_variant_id: targetVariantId,
          component_id: row.component_id,
          quantity: row.quantity,
        }))
      );

    if (insertError) {
      return { error: insertError.message };
    }
  }

  revalidatePath(`/products/${productId}`);
  revalidatePath("/products");
  revalidatePath("/dashboard");

  return { success: true };
}

export async function createProductVariant(
  productId: string,
  data: {
    title: string;
    sku?: string | null;
    price: number | null;
  },
  options?: {
    copyFromVariantId?: string | null;
    copyFromProductCogs?: boolean;
  }
) {
  const supabase = await createClient();
  const { ownerId, error: ownerError } = await getEffectiveOwnerId();

  if (ownerError || !ownerId) {
    return { error: ownerError || "Unauthorized" };
  }

  const { data: product, error: productError } = await supabase
    .from("products")
    .select("id")
    .eq("id", productId)
    .eq("user_id", ownerId)
    .single();

  if (productError || !product) {
    return { error: "Product not found" };
  }

  const { data: variant, error: insertError } = await supabase
    .from("product_variants")
    .insert({
      product_id: productId,
      user_id: ownerId,
      title: data.title.trim(),
      sku: data.sku || null,
      price: data.price,
    })
    .select("id, title, sku, price, shopify_variant_id")
    .single();

  if (insertError || !variant) {
    return { error: insertError?.message || "Failed to create variant" };
  }

  let sourceRows: Array<{ component_id: string; quantity: number }> = [];

  if (options?.copyFromVariantId) {
    const { data: sourceVariant, error: sourceVariantError } = await supabase
      .from("product_variants")
      .select("id")
      .eq("id", options.copyFromVariantId)
      .eq("product_id", productId)
      .eq("user_id", ownerId)
      .single();

    if (sourceVariantError || !sourceVariant) {
      return { error: "Source variant not found" };
    }

    const { data: rows, error: rowsError } = await supabase
      .from("product_variant_components")
      .select("component_id, quantity")
      .eq("product_variant_id", options.copyFromVariantId);

    if (rowsError) {
      return { error: rowsError.message };
    }

    sourceRows = rows || [];
  } else if (options?.copyFromProductCogs) {
    const { data: rows, error: rowsError } = await supabase
      .from("product_components")
      .select("component_id, quantity")
      .eq("product_id", productId);

    if (rowsError) {
      return { error: rowsError.message };
    }

    sourceRows = rows || [];
  }

  if (sourceRows.length > 0) {
    const { error: copyError } = await supabase
      .from("product_variant_components")
      .insert(
        sourceRows.map((row) => ({
          product_variant_id: variant.id,
          component_id: row.component_id,
          quantity: row.quantity,
        }))
      );

    if (copyError) {
      return { error: copyError.message };
    }
  }

  revalidatePath(`/products/${productId}`);
  revalidatePath("/products");
  revalidatePath("/dashboard");

  return { success: true, variant };
}

export async function deleteProductVariant(productId: string, variantId: string) {
  const supabase = await createClient();
  const { ownerId, error: ownerError } = await getEffectiveOwnerId();

  if (ownerError || !ownerId) {
    return { error: ownerError || "Unauthorized" };
  }

  const { error } = await supabase
    .from("product_variants")
    .delete()
    .eq("id", variantId)
    .eq("product_id", productId)
    .eq("user_id", ownerId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/products/${productId}`);
  revalidatePath("/products");
  revalidatePath("/dashboard");

  return { success: true };
}

export async function updateProductVariantPrice(
  productId: string,
  variantId: string,
  price: number
) {
  const supabase = await createClient();
  const { ownerId, error: ownerError } = await getEffectiveOwnerId();

  if (ownerError || !ownerId) {
    return { error: ownerError || "Unauthorized" };
  }

  const { error } = await supabase
    .from("product_variants")
    .update({ price })
    .eq("id", variantId)
    .eq("product_id", productId)
    .eq("user_id", ownerId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/products/${productId}`);
  revalidatePath("/products");
  revalidatePath("/dashboard");

  return { success: true };
}

export async function updateProductPrice(productId: string, price: number) {
  const supabase = await createClient();
  const { ownerId, error: ownerError } = await getEffectiveOwnerId();

  if (ownerError || !ownerId) {
    return { error: ownerError || "Unauthorized" };
  }

  const { error } = await supabase
    .from("products")
    .update({ price })
    .eq("id", productId)
    .eq("user_id", ownerId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/products/${productId}`);
  revalidatePath("/products");
  revalidatePath("/dashboard");

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
  const { ownerId, error: ownerError } = await getEffectiveOwnerId();

  if (ownerError || !ownerId) {
    return { error: ownerError || "Unauthorized" };
  }

  // Verify product ownership
  const { data: product } = await supabase
    .from("products")
    .select("id")
    .eq("id", productId)
    .eq("user_id", ownerId)
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

  revalidatePath(`/products/${productId}`);
  revalidatePath("/products");

  return { success: true };
}

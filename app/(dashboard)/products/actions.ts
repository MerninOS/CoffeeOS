"use server";

import { createClient } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/team";
import { fetchShopifyProducts, parseShopifyGid } from "@/lib/shopify";
import { revalidatePath } from "next/cache";
import { User } from "@supabase/supabase-js";

export async function syncShopifyProducts() {
  const supabase = await createClient();

  const { ownerId, error: ownerError } = await getEffectiveOwnerId();

  if (ownerError || !ownerId) {
    return { error: ownerError || "Unauthorized" };
  }

  // Get Shopify settings scoped to the owner
  const { data: settings, error: settingsError } = await supabase
    .from("shopify_settings")
    .select("*")
    .eq("user_id", ownerId)
    .single();

  if (settingsError || !settings) {
    return { error: "Shopify not connected. Please connect your store in Settings." };
  }

  if (!settings.admin_access_token) {
    return { error: "Shopify Admin API not configured. Please reconnect your store in Settings." };
  }

  try {
    let hasMore = true;
    let cursor: string | undefined;
    let syncedCount = 0;

    while (hasMore) {
      const productsData = await fetchShopifyProducts(
        settings.store_domain,
        settings.admin_access_token,
        50,
        cursor
      );

      for (const edge of productsData.edges) {
        const product = edge.node;
        const shopifyId = parseShopifyGid(product.id);
        const firstVariant = product.variants.edges[0]?.node;
        const firstImage = product.images.edges[0]?.node;

        // Upsert product - use correct column names from schema
        const { data: user } = await supabase.auth.getUser();
        if (!user) {
          console.error("User is unauthorized");
          continue;
        }

        const { error: upsertError } = await supabase.from("products").upsert(
          {
            shopify_id: shopifyId,
            user_id: ownerId,
            title: product.title,
            description: product.description || null,
            sku: firstVariant?.sku || null,
            price: firstVariant ? parseFloat(firstVariant.price) : null,
            image_url: firstImage?.url || null,
            shopify_handle: product.handle,
            variant_id: firstVariant?.id || null,
            variant_title: firstVariant?.title || null,
            synced_at: new Date().toISOString(),
          },
          {
            onConflict: "shopify_id,user_id",
          }
        );

        if (upsertError) {
          console.error("Error upserting product:", upsertError);
        } else {
          syncedCount++;
        }
      }

      hasMore = productsData.pageInfo.hasNextPage;
      cursor = productsData.pageInfo.endCursor;
    }

    revalidatePath("/products", "max");
    return { success: true, count: syncedCount };
  } catch (error) {
    console.error("Shopify sync error:", error);
    return {
      error: error instanceof Error ? error.message : "Failed to sync products",
    };
  }
}

export async function createProduct(data: {
  title: string;
  description?: string;
  sku?: string;
  price: number;
  image_url?: string;
}) {
  const supabase = await createClient();

  const { ownerId, error: ownerError } = await getEffectiveOwnerId();

  if (ownerError || !ownerId) {
    return { error: ownerError || "Unauthorized" };
  }

  const { data: product, error } = await supabase
    .from("products")
    .insert({
      user_id: ownerId,
      title: data.title,
      description: data.description || null,
      sku: data.sku || null,
      price: data.price,
      image_url: data.image_url || null,
    })
    .select()
    .single();

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/products");
  return { success: true, product };
}

export async function deleteProduct(productId: string) {
  const supabase = await createClient();

  const { ownerId, error: ownerError } = await getEffectiveOwnerId();

  if (ownerError || !ownerId) {
    return { error: ownerError || "Unauthorized" };
  }

  const { error } = await supabase
    .from("products")
    .delete()
    .eq("id", productId)
    .eq("user_id", ownerId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/products", "max");
  return { success: true };
}

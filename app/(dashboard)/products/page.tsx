import { createClient } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/team";
import { ProductsClient } from "./products-client";

export default async function ProductsPage() {
  const supabase = await createClient();
  const { ownerId } = await getEffectiveOwnerId();

  // Fetch products and calculate COGS from product_components
  const [productsResult, productComponentsResult, settingsResult] = await Promise.all([
    supabase
      .from("products")
      .select("id, shopify_id, title, description, sku, price, image_url, created_at")
      .eq("user_id", ownerId!)
      .order("created_at", { ascending: false }),
    supabase
      .from("product_components")
      .select("product_id, quantity, components(cost_per_unit)"),
    supabase
      .from("shopify_settings")
      .select("store_domain")
      .eq("user_id", ownerId!)
      .maybeSingle(),
  ]);

  const products = productsResult.data || [];
  
  // Calculate COGS per product from product_components
  const productCogs: Record<string, number> = {};
  for (const pc of productComponentsResult.data || []) {
    const cost = (pc.quantity || 0) * ((pc.components as { cost_per_unit: number } | null)?.cost_per_unit || 0);
    productCogs[pc.product_id] = (productCogs[pc.product_id] || 0) + cost;
  }

  // Add total_cogs to each product
  const productsWithCogs = products.map(product => ({
    ...product,
    total_cogs: productCogs[product.id] || null,
  }));

  const isShopifyConfigured = !!settingsResult.data?.store_domain;

  return (
    <ProductsClient
      initialProducts={productsWithCogs}
      isShopifyConfigured={isShopifyConfigured}
    />
  );
}

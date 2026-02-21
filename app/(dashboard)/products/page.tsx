import { createClient } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/team";
import { ProductsClient } from "./products-client";

export default async function ProductsPage() {
  const supabase = await createClient();
  const { ownerId } = await getEffectiveOwnerId();

  // Fetch products and calculate COGS from both product-level and variant-level components
  const [productsResult, productComponentsResult, variantsResult, variantComponentsResult, settingsResult] = await Promise.all([
    supabase
      .from("products")
      .select("id, shopify_id, title, description, sku, price, image_url, created_at")
      .eq("user_id", ownerId!)
      .order("created_at", { ascending: false }),
    supabase
      .from("product_components")
      .select("product_id, quantity, components(cost_per_unit)"),
    supabase
      .from("product_variants")
      .select("id, product_id, title, sku, price")
      .eq("user_id", ownerId!)
      .order("created_at", { ascending: true }),
    supabase
      .from("product_variant_components")
      .select("product_variant_id, quantity, components(cost_per_unit)"),
    supabase
      .from("shopify_settings")
      .select("store_domain")
      .eq("user_id", ownerId!)
      .maybeSingle(),
  ]);

  const products = productsResult.data || [];

  const extractCostPerUnit = (value: unknown): number => {
    if (Array.isArray(value)) {
      return (value[0] as { cost_per_unit?: number } | undefined)?.cost_per_unit || 0;
    }
    return (value as { cost_per_unit?: number } | null)?.cost_per_unit || 0;
  };
  
  // Calculate COGS per product from product_components
  const productCogs: Record<string, number> = {};
  for (const pc of productComponentsResult.data || []) {
    const cost = (pc.quantity || 0) * extractCostPerUnit(pc.components);
    productCogs[pc.product_id] = (productCogs[pc.product_id] || 0) + cost;
  }

  const variantCogs: Record<string, number> = {};
  for (const pvc of variantComponentsResult.data || []) {
    const cost = (pvc.quantity || 0) * extractCostPerUnit(pvc.components);
    variantCogs[pvc.product_variant_id] = (variantCogs[pvc.product_variant_id] || 0) + cost;
  }

  const variantsByProduct: Record<
    string,
    Array<{
      id: string;
      title: string;
      sku: string | null;
      price: number | null;
      total_cogs: number | null;
    }>
  > = {};

  for (const variant of variantsResult.data || []) {
    if (!variantsByProduct[variant.product_id]) {
      variantsByProduct[variant.product_id] = [];
    }

    variantsByProduct[variant.product_id].push({
      id: variant.id,
      title: variant.title,
      sku: variant.sku || null,
      price: variant.price,
      total_cogs: variantCogs[variant.id] ?? null,
    });
  }

  // Add total_cogs to each product
  const productsWithCogs = products.map((product) => {
    const productVariants = variantsByProduct[product.id] || [];
    const variantCogsValues = productVariants
      .map((variant) => variant.total_cogs || 0)
      .filter((value) => value > 0);

    const averageVariantCogs =
      variantCogsValues.length > 0
        ? variantCogsValues.reduce((sum, value) => sum + value, 0) / variantCogsValues.length
        : null;

    const variantMargins = productVariants
      .map((variant) => {
        if (!variant.price || !variant.total_cogs) return null;
        return ((variant.price - variant.total_cogs) / variant.price) * 100;
      })
      .filter((margin): margin is number => margin !== null);

    const averageVariantMargin =
      variantMargins.length > 0
        ? variantMargins.reduce((sum, margin) => sum + margin, 0) / variantMargins.length
        : null;

    const variantPrices = productVariants
      .map((variant) => variant.price)
      .filter((price): price is number => price !== null && price !== undefined);

    const minVariantPrice =
      variantPrices.length > 0
        ? Math.min(...variantPrices)
        : null;

    return {
      ...product,
      variants: productVariants,
      min_selling_price: minVariantPrice ?? product.price ?? null,
      average_margin: averageVariantMargin,
      total_cogs: productCogs[product.id] || averageVariantCogs || null,
    };
  });

  const isShopifyConfigured = !!settingsResult.data?.store_domain;

  return (
    <ProductsClient
      initialProducts={productsWithCogs}
      isShopifyConfigured={isShopifyConfigured}
    />
  );
}

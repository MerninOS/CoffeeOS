import { createClient } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/team";
import { buildProductLookup, costBasis } from "@/lib/products/costing";
import { ProductsClient } from "./products-client";

/**
 * CoffeeOS#69 Stage C — /products resolves costing through the SAME module
 * /orders uses.
 *
 * What this replaced, and why it mattered:
 *
 *   total_cogs: productCogs[product.id] || averageVariantCogs || null
 *
 * That line did three wrong things at once. It averaged variants that disagree
 * into one plausible-looking number — on the seeded fixture, Sumatra's $11.30
 * and $29.64 became $20.47, a figure no invoice will ever use, while /orders
 * had already dropped that product from margin entirely. It used `||` rather
 * than `??`, so a product costed at exactly $0 fell through to the variant
 * average. And it could not distinguish "no recipe" from "a $0 recipe", so the
 * page rendered `—` for both.
 *
 * `buildProductLookup` answers the same question /orders asks, with the rule
 * stated once: a variant-level figure counts as known only when EVERY variant
 * is costed and all of them agree. `hasRecipe` is carried separately from
 * `cogs` because recipe presence is not the same question as a positive total.
 *
 * The component rows are now NESTED under the owner-scoped product and variant
 * queries rather than fetched as two unfiltered top-level selects. Same data,
 * one less place relying on RLS alone.
 */
export default async function ProductsPage() {
  const supabase = await createClient();
  const { ownerId } = await getEffectiveOwnerId();

  const [productsResult, variantsResult, settingsResult] = await Promise.all([
    supabase
      .from("products")
      .select(
        `id, shopify_id, title, description, sku, price, image_url, created_at,
         product_components ( quantity, components ( cost_per_unit ) )`
      )
      .eq("user_id", ownerId!)
      .order("created_at", { ascending: false }),
    supabase
      .from("product_variants")
      .select(
        `id, product_id, title, sku, price,
         product_variant_components ( quantity, components ( cost_per_unit ) )`
      )
      .eq("user_id", ownerId!)
      .order("created_at", { ascending: true }),
    supabase
      .from("shopify_settings")
      .select("store_domain")
      .eq("user_id", ownerId!)
      .maybeSingle(),
  ]);

  const products = productsResult.data || [];
  const variantRows = variantsResult.data || [];

  // The one implementation, shared with /orders.
  const lookup = buildProductLookup(products, variantRows);

  const extractCostPerUnit = (value: unknown): number => {
    if (Array.isArray(value)) {
      return (value[0] as { cost_per_unit?: number } | undefined)?.cost_per_unit || 0;
    }
    return (value as { cost_per_unit?: number } | null)?.cost_per_unit || 0;
  };

  /** Per-variant cost, for the variant column and the detail page. */
  const variantCogs: Record<string, number> = {};
  for (const variant of variantRows) {
    const rows = (variant.product_variant_components || []) as Array<{
      quantity: number | null;
      components: unknown;
    }>;
    variantCogs[variant.id] = rows.reduce(
      (sum, vc) => sum + (vc.quantity || 0) * extractCostPerUnit(vc.components),
      0
    );
  }

  const variantsByProduct: Record<
    string,
    Array<{ id: string; title: string; sku: string | null; price: number | null; total_cogs: number | null }>
  > = {};
  for (const variant of variantRows) {
    (variantsByProduct[variant.product_id] ||= []).push({
      id: variant.id,
      title: variant.title,
      sku: variant.sku || null,
      price: variant.price,
      // A variant with no rows has no cost, which is NOT the same as costing 0.
      total_cogs: (variant.product_variant_components || []).length > 0 ? variantCogs[variant.id] : null,
    });
  }

  const productsWithCogs = products.map((product) => {
    const productVariants = variantsByProduct[product.id] || [];
    const entry = lookup[product.id];
    const hasRecipe = entry?.hasRecipe ?? false;

    const variantPrices = productVariants
      .map((v) => v.price)
      .filter((p): p is number => p !== null && p !== undefined);
    const minSellingPrice = variantPrices.length > 0 ? Math.min(...variantPrices) : product.price ?? null;

    // Margin is WITHHELD, not invented, when the cost is unknowable — and it is
    // derived from the same price the row displays, so the two columns can no
    // longer disagree. The old `average_margin` mean-averaged every variant's
    // margin, letting a product with 12 variants outweigh one with 1.
    const margin =
      hasRecipe && minSellingPrice
        ? ((minSellingPrice - entry.cogs) / minSellingPrice) * 100
        : null;

    return {
      ...product,
      variants: productVariants,
      min_selling_price: minSellingPrice,
      // `null` now means exactly one thing: the cost is not knowable. A costed
      // product reports its figure even when that figure is 0.
      total_cogs: hasRecipe ? entry.cogs : null,
      has_recipe: hasRecipe,
      cost_basis: costBasis(product, variantRows),
      average_margin: margin,
    };
  });

  return (
    <ProductsClient
      initialProducts={productsWithCogs}
      isShopifyConfigured={!!settingsResult.data?.store_domain}
    />
  );
}

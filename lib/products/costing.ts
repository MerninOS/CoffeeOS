/**
 * How a product's unit COGS is resolved, and whether it is knowable at all.
 *
 * This lived inline in `app/(dashboard)/orders/page.tsx`. It moved here because
 * it is *product* costing that the orders page happens to consume — and because
 * `/products` needs the identical answer. Two implementations of this rule is
 * exactly the drift CoffeeOS#69 exists to remove: `/orders` was rebuilt to stop
 * averaging disagreeing variants, while `/products` still does it
 * (`productCogs[id] || averageVariantCogs`), so the same product can read costed
 * on one screen and be dropped from margin on the other.
 *
 * The rule is deliberately stricter than "product recipe wins":
 *
 *   hasProductRecipe      -> cogs = product total,  hasRecipe = true
 *   else hasVariantRecipe -> cogs = agreed variant, hasRecipe = true
 *   else                  -> cogs = 0,              hasRecipe = false
 *
 * ...where a variant-level figure only counts as known when EVERY variant is
 * costed and all of them agree. A product with three carefully costed variants
 * and one empty one is `hasRecipe: false`.
 */

import type { ProductLookup } from "@/lib/orders/cogs";

export type { ProductLookup };

/** A product row carrying its product-level recipe, as both pages select it. */
export interface CostableProduct {
  id: string;
  title?: string | null;
  product_components?: Array<{
    quantity: number | null;
    components: unknown;
  }> | null;
}

/** A variant row carrying its variant-level recipe. */
export interface CostableVariant {
  id?: string;
  product_id: string;
  product_variant_components?: Array<{
    quantity: number | null;
    components: unknown;
  }> | null;
}

/**
 * Which recipe rows a product actually carries.
 *
 * `'both'` is not a data error — it is the state CoffeeOS#69 makes explicit via
 * `products.costing_mode`. Until that column is read, `'both'` behaves as
 * `'product'`, because that is what `buildProductLookup` bills.
 */
export type CostBasis = "product" | "variant" | "both" | "none";

/**
 * Which recipe rows exist for a product — a question about STORAGE, not about
 * billing.
 *
 * Deliberately distinct from `buildProductLookup`. A product can be `'variant'`
 * here and still be uncosted for billing, because its variants disagree or one
 * of them is empty. `/products` shows both facts in different columns, and
 * collapsing them is how the current list ends up claiming a product is costed
 * that `/orders` has dropped from margin.
 */
export function costBasis(
  product: CostableProduct,
  variantRows: CostableVariant[] | null | undefined,
): CostBasis {
  const hasProduct = (product.product_components?.length ?? 0) > 0;
  const hasVariant = (variantRows || []).some(
    (v) =>
      v.product_id === product.id &&
      (v.product_variant_components?.length ?? 0) > 0,
  );

  if (hasProduct && hasVariant) return "both";
  if (hasProduct) return "product";
  if (hasVariant) return "variant";
  return "none";
}

/**
 * The value `023_add_product_costing_mode.sql` backfills for a product.
 *
 * Expressed here as a pure function so the rule is testable before the SQL
 * exists, and so the migration and the app can be checked against ONE
 * statement of it. The rule is: variant rows AND no product rows -> 'variant';
 * everything else -> 'product'.
 *
 * "Everything else" deliberately includes `'none'`. A product with no recipe at
 * all opens on the product-level editor, which is where a first recipe should be
 * written — and it includes `'both'`, because product-level is what
 * `buildProductLookup` already bills. That agreement in every case is what makes
 * the migration figure-preserving.
 */
export function backfillCostingMode(
  basis: CostBasis,
): "product" | "variant" {
  return basis === "variant" ? "variant" : "product";
}

/**
 * Build the product_id -> {title, cogs, hasRecipe} lookup.
 *
 * Moved verbatim from orders/page.tsx. The comments inside are the specification
 * for this logic — they record defects that were paid for once already.
 */
export function buildProductLookup(
  productsWithCogs: CostableProduct[] | null | undefined,
  variantRows: CostableVariant[] | null | undefined,
): ProductLookup {
  /** product_id -> the one cost every variant agrees on, or null when unknowable. */
  const variantCogsByProduct = new Map<string, number | null>();
  for (const variant of variantRows || []) {
    const rows = (variant.product_variant_components || []) as Array<{
      quantity: number | null;
      components: unknown;
    }>;
    const cost = rows.reduce((sum, vc) => {
      const rel = vc.components as unknown as
        | { cost_per_unit: number | null }
        | { cost_per_unit: number | null }[]
        | null;
      const one = Array.isArray(rel) ? rel[0] : rel;
      return sum + (vc.quantity || 0) * (one?.cost_per_unit || 0);
    }, 0);

    const key = variant.product_id as string;
    const seen = variantCogsByProduct.get(key);

    if (rows.length === 0) {
      // An uncosted variant makes the product's cost depend on which one sold,
      // which we cannot know. Poisons the product for good.
      variantCogsByProduct.set(key, null);
      continue;
    }
    if (seen === undefined) variantCogsByProduct.set(key, cost);
    else if (seen !== null && Math.abs(seen - cost) > 0.0001) {
      variantCogsByProduct.set(key, null); // variants disagree
    }
  }

  // Every owned product gets an entry, INCLUDING uncosted ones at 0. That is
  // what lets classifyOrder tell "linked but has no recipe" (present, 0) apart
  // from "points at a product that no longer exists" (absent). Making this
  // write conditional would silently merge the two classes.
  const productLookup: ProductLookup = {};
  if (productsWithCogs) {
    for (const product of productsWithCogs) {
      let totalCogs = 0;
      if (product.product_components) {
        for (const pc of product.product_components) {
          // Supabase types a nested relation as an ARRAY even when it is
          // many-to-one, so `components` arrives typed `{...}[]` while at runtime
          // it is a single object. The previous cast here asserted the object
          // shape outright, which was simply untrue to the type — normalise both
          // instead, exactly as lib/orders/cogs.ts does for the same quirk.
          const rel = pc.components as unknown as
            | { cost_per_unit: number | null }
            | { cost_per_unit: number | null }[]
            | null;
          const one = Array.isArray(rel) ? rel[0] : rel;
          totalCogs += (pc.quantity || 0) * (one?.cost_per_unit || 0);
        }
      }
      const hasProductRecipe = (product.product_components?.length ?? 0) > 0;
      const variantCogs = variantCogsByProduct.get(product.id);
      const hasVariantRecipe = variantCogs !== undefined && variantCogs !== null;

      // Product level wins where both exist — it is the coarser, deliberately
      // maintained figure, and only one product on this account has both.
      productLookup[product.id] = {
        title: (product as { title: string | null }).title || "Untitled product",
        cogs: hasProductRecipe ? totalCogs : hasVariantRecipe ? variantCogs : 0,
        // Presence of a recipe at EITHER level, not a positive total: a product
        // costed from zero-cost components is costed. See lib/orders/cogs.ts.
        hasRecipe: hasProductRecipe || hasVariantRecipe,
      };
    }
  }

  return productLookup;
}

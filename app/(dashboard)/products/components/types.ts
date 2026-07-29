/**
 * Shapes the /products list renders. Moved out of products-client.tsx unchanged
 * (CoffeeOS#69 Stage A — extract with styling and behaviour untouched).
 *
 * `total_cogs` is optional and nullable, and both states are load-bearing today:
 * page.tsx writes `productCogs[id] || averageVariantCogs || null`. Stage C
 * replaces that with lib/products/costing.ts, at which point the meaning of a
 * missing value stops being ambiguous.
 */

export interface ProductVariant {
  id: string;
  title: string;
  sku: string | null;
  price: number | null;
  total_cogs: number | null;
}

export interface Product {
  id: string;
  shopify_id: string | null;
  title: string;
  description: string | null;
  sku: string | null;
  price: number | null;
  total_cogs?: number | null;
  min_selling_price?: number | null;
  average_margin?: number | null;
  /**
   * Whether the product carries a recipe AT ALL — the question
   * lib/products/costing.ts answers, and deliberately NOT `total_cogs > 0`.
   * A product costed entirely from zero-cost components has a recipe and a
   * cost of 0; a product with none has neither.
   */
  has_recipe?: boolean;
  /** Which rows exist: product | variant | both | none. A storage question,
   *  separate from whether the cost is knowable. */
  cost_basis?: "product" | "variant" | "both" | "none";
  variants?: ProductVariant[];
  image_url: string | null;
  created_at: string;
}

/**
 * Shapes the /products/[id] detail page renders. Moved out of
 * product-detail-client.tsx unchanged (CoffeeOS#69 Stage A — extract with
 * styling and behaviour untouched).
 *
 * Note for the reader: `ProductVariant` here is NOT the same shape as the
 * `ProductVariant` in ../../components/types.ts. The list page's variant carries
 * `total_cogs` and no `shopify_variant_id`; this one is the reverse. Both are
 * hand-written mirrors of the same table. Stage C's lib/products/costing.ts is
 * where that duplication is meant to collapse — deliberately NOT unified here,
 * because unifying them would change what the two pages type-check against.
 */

export interface Component {
  id: string;
  name: string;
  cost_per_unit: number;
  unit: string;
  type?: string;
}

export interface ProductComponent {
  id: string;
  quantity: number;
  component_id: string;
  components: Component | null;
}

export interface ProductVariant {
  id: string;
  title: string;
  sku: string | null;
  price: number | null;
  shopify_variant_id: string | null;
}

export interface ProductVariantComponent extends ProductComponent {
  product_variant_id: string;
}

export interface Product {
  id: string;
  title: string;
  description: string | null;
  sku: string | null;
  /**
   * Type-only addition (CoffeeOS#69 Stage B). page.tsx already does
   * `select("*")`, so this field has always been present at runtime — the header
   * caption reads it to say whether a product came from Shopify or was created
   * by hand. Nothing is fetched that was not fetched before.
   */
  shopify_id?: string | null;
  price: number | null;
  image_url: string | null;
  wholesale_price: number | null;
  wholesale_minimum_qty: number | null;
  wholesale_enabled: boolean | null;
  /**
   * Which recipe basis is BILLED — 'product' or 'variant' (CoffeeOS#69,
   * migration 023). Stored rather than inferred, so the operator's intent and
   * what an invoice uses can no longer diverge silently.
   */
  costing_mode?: "product" | "variant" | null;
}

export interface WholesaleTier {
  id: string;
  min_quantity: number;
  price: number;
}

export interface SelectedComponent {
  componentId: string;
  quantity: number;
}

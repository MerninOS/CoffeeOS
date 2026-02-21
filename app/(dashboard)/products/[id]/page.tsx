import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProductDetailClient } from "./product-detail-client";

interface ProductDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function ProductDetailPage({ params }: ProductDetailPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  // Fetch product with all fields (including wholesale fields)
  const { data: product, error } = await supabase
    .from("products")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("[v0] Product fetch error:", error);
    notFound();
  }
  
  if (!product) {
    notFound();
  }

  // Fetch all available components
  const { data: components } = await supabase
    .from("components")
    .select("*")
    .order("name");

  // Fetch product's current components
  const { data: productComponents } = await supabase
    .from("product_components")
    .select(
      `
      id,
      quantity,
      component_id,
      components (
        id,
        name,
        cost_per_unit,
        unit
      )
    `
    )
    .eq("product_id", id);

  const normalizeJoinedComponent = (
    value: unknown
  ): { id: string; name: string; cost_per_unit: number; unit: string } | null => {
    if (Array.isArray(value)) {
      return value[0] || null;
    }
    return (value as { id: string; name: string; cost_per_unit: number; unit: string } | null) || null;
  };

  // Fetch Shopify/manual variants for this product
  const { data: productVariants } = await supabase
    .from("product_variants")
    .select("id, title, sku, price, shopify_variant_id")
    .eq("product_id", id)
    .order("created_at", { ascending: true });

  let productVariantComponents: Array<{
    id: string;
    quantity: number;
    component_id: string;
    product_variant_id: string;
    components: { id: string; name: string; cost_per_unit: number; unit: string } | null;
  }> = [];

  const variantIds = (productVariants || []).map((variant) => variant.id);
  if (variantIds.length > 0) {
    const { data } = await supabase
      .from("product_variant_components")
      .select(
        `
        id,
        quantity,
        component_id,
        product_variant_id,
        components (
          id,
          name,
          cost_per_unit,
          unit
        )
      `
      )
      .in("product_variant_id", variantIds);

    productVariantComponents = (data || []).map((row) => ({
      ...row,
      components: normalizeJoinedComponent(row.components),
    }));
  }

  const normalizedProductComponents = (productComponents || []).map((row) => ({
    ...row,
    components: normalizeJoinedComponent(row.components),
  }));

  // Fetch wholesale price tiers
  const { data: wholesaleTiers } = await supabase
    .from("wholesale_price_tiers")
    .select("*")
    .eq("product_id", id)
    .order("min_quantity");

  return (
    <ProductDetailClient
      product={product}
      availableComponents={components || []}
      productComponents={normalizedProductComponents}
      productVariants={productVariants || []}
      productVariantComponents={productVariantComponents}
      wholesaleTiers={wholesaleTiers || []}
    />
  );
}

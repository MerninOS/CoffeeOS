import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProductDetailClient } from "./product-detail-client";

interface ProductDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function ProductDetailPage({ params }: ProductDetailPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  // Fetch product with wholesale fields
  const { data: product, error } = await supabase
    .from("products")
    .select("*, wholesale_price, wholesale_minimum_qty, wholesale_enabled")
    .eq("id", id)
    .single();

  if (error || !product) {
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
      productComponents={productComponents || []}
      wholesaleTiers={wholesaleTiers || []}
    />
  );
}

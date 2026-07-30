/**
 * Assembles everything the admin block renders, in one shape, computed
 * server-side. COGS comes from lib/orders/cogs.ts — the block NEVER does its
 * own cost math, which is the design's parity guarantee with the dashboard.
 *
 * Returned by the GET and by every mutation route, so the block re-syncs to
 * authoritative state after each write.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  classifyOrder,
  getOrderCogs,
  type ProductLookup,
  type CostableOrder,
  type ClassifiableOrder,
} from "@/lib/orders/cogs";
import {
  buildProductLookup,
  type CostableProduct,
  type CostableVariant,
} from "@/lib/products/costing";
import {
  buildPrefillSuggestion,
  type HistoricalOrder,
  type SuggestionLine,
} from "@/lib/orders/prefill";

export interface PackingLine extends SuggestionLine {
  id: string; // order_components row id
}

export interface PackingState {
  order: {
    id: string;
    shopifyOrderId: string;
    orderName: string | null;
    totalPrice: number | null;
    customerPaidShipping: number | null;
    lineItems: { id: string; title: string; quantity: number }[];
  };
  library: {
    id: string;
    name: string;
    type: string;
    unit: string;
    costPerUnit: number;
  }[];
  packing: PackingLine[];
  customCosts: { id: string; description: string; amount: number }[];
  suggestion: SuggestionLine[];
  costability: "costed" | "unlinked" | "uncosted";
  cogs: {
    total: number;
    margin: number | null; // null unless costability === 'costed' and revenue > 0
  };
}

interface ComponentRef {
  id: string;
  name: string;
  unit: string;
  cost_per_unit: number | null;
}

// Supabase types nested many-to-one relations as arrays; normalise.
function one<T>(ref: T | T[] | null): T | null {
  if (!ref) return null;
  return Array.isArray(ref) ? (ref[0] ?? null) : ref;
}

function toLine(oc: {
  id?: string;
  quantity: number;
  components: ComponentRef | ComponentRef[] | null;
}): PackingLine | null {
  const c = one(oc.components);
  if (!c) return null;
  return {
    id: oc.id ?? "",
    componentId: c.id,
    name: c.name,
    unit: c.unit,
    costPerUnit: c.cost_per_unit || 0,
    quantity: Number(oc.quantity),
  };
}

const HISTORY_LIMIT = 25;

export async function getPackingState(
  supabase: SupabaseClient,
  userId: string,
  shopifyOrderId: string
): Promise<PackingState | null> {
  const { data: order } = await supabase
    .from("orders")
    .select(
      `
      id, shopify_order_id, order_name, total_price, total_shipping,
      order_line_items ( id, title, quantity, product_id ),
      order_components ( id, quantity, components ( id, name, unit, cost_per_unit ) ),
      order_custom_costs ( id, description, amount )
    `
    )
    .eq("shopify_order_id", shopifyOrderId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!order) return null;

  // Component library (all of the user's components, name-sorted).
  const { data: library } = await supabase
    .from("components")
    .select("id, name, type, unit, cost_per_unit")
    .eq("user_id", userId)
    .order("name");

  // ProductLookup for classify/cogs — every owned product, per the cogs.ts
  // contract ("the builder must write an entry for EVERY owned product").
  //
  // A recipe can live at PRODUCT level or VARIANT level (CoffeeOS "fix(orders):
  // read variant-level recipes, not just product-level"). Building the lookup
  // from product_components alone would under-report COGS relative to the
  // dashboard for any product costed only per-variant — breaking the exact
  // parity guarantee this module exists for. So this reuses the same
  // buildProductLookup() that app/(dashboard)/orders/page.tsx and /products
  // call, rather than re-deriving the precedence rule here.
  const { data: products } = await supabase
    .from("products")
    .select(
      `
      id, title,
      product_components ( quantity, components ( cost_per_unit ) )
    `
    )
    .eq("user_id", userId);

  const { data: variantRows } = await supabase
    .from("product_variants")
    .select(
      `
      id, product_id,
      product_variant_components ( quantity, components ( cost_per_unit ) )
    `
    )
    .in("product_id", (products || []).map((p) => p.id));

  const lookup: ProductLookup = buildProductLookup(
    (products || []) as CostableProduct[],
    (variantRows || []) as CostableVariant[]
  );

  const packing = ((order.order_components || []) as Parameters<typeof toLine>[0][])
    .map(toLine)
    .filter((l): l is PackingLine => l !== null);

  // Suggestion only when nothing is packed yet — never over real data.
  let suggestion: SuggestionLine[] = [];
  if (packing.length === 0) {
    const { data: recent } = await supabase
      .from("orders")
      .select(
        `id, created_at_shopify,
         order_line_items ( product_id ),
         order_components ( quantity, components ( id, name, unit, cost_per_unit ) )`
      )
      .eq("user_id", userId)
      .neq("id", order.id)
      .order("created_at_shopify", { ascending: false, nullsFirst: false })
      .limit(HISTORY_LIMIT);

    const history: HistoricalOrder[] = (recent || []).map((o) => ({
      productIds: ((o.order_line_items || []) as { product_id: string | null }[]).map(
        (li) => li.product_id
      ),
      components: ((o.order_components || []) as Parameters<typeof toLine>[0][])
        .map(toLine)
        .filter((l): l is PackingLine => l !== null)
        .map(({ componentId, name, unit, costPerUnit, quantity }) => ({
          componentId,
          name,
          unit,
          costPerUnit,
          quantity,
        })),
    }));

    suggestion = buildPrefillSuggestion(
      ((order.order_line_items || []) as { product_id: string | null }[]).map(
        (li) => li.product_id
      ),
      history
    );
  }

  const costable = order as unknown as CostableOrder & ClassifiableOrder;
  const { status: costability } = classifyOrder(costable, lookup);
  const cogsTotal = getOrderCogs(costable, lookup);
  const revenue = order.total_price || 0;
  const margin =
    costability === "costed" && revenue > 0
      ? ((revenue - cogsTotal) / revenue) * 100
      : null;

  return {
    order: {
      id: order.id,
      shopifyOrderId: order.shopify_order_id,
      orderName: order.order_name,
      totalPrice: order.total_price,
      customerPaidShipping: order.total_shipping,
      lineItems: ((order.order_line_items || []) as {
        id: string;
        title: string;
        quantity: number;
      }[]).map(({ id, title, quantity }) => ({ id, title, quantity })),
    },
    library: (library || []).map((c) => ({
      id: c.id,
      name: c.name,
      type: c.type,
      unit: c.unit,
      costPerUnit: c.cost_per_unit || 0,
    })),
    packing,
    customCosts: ((order.order_custom_costs || []) as {
      id: string;
      description: string;
      amount: number;
    }[]).map(({ id, description, amount }) => ({ id, description, amount: Number(amount) })),
    suggestion,
    costability,
    cogs: { total: cogsTotal, margin },
  };
}

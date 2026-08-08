/**
 * Assembles everything the admin block renders, in one shape, computed
 * server-side. COGS comes from lib/orders/cogs.ts — the block NEVER does its
 * own cost math, which is the design's parity guarantee with the dashboard.
 *
 * Returned by the GET and by every mutation route, so the block re-syncs to
 * authoritative state after each write.
 *
 * FAILS LOUDLY on infrastructure errors, matching app/(dashboard)/orders/page.tsx
 * ("A blank error beats a convincing lie"). A silently-swallowed error here is
 * worse than one on the dashboard: `products`/`product_variants` erroring and
 * falling back to `[]` collapses the lookup to `{}`, which makes every line
 * item look unlinked — a well-costed order would flip to a wrong-but-plausible
 * "items not linked" badge with near-zero COGS, and nothing would say a query
 * failed. That is the exact class of defect the variant-level lookup fix
 * (buildProductLookup) exists to prevent, just moved one layer down. So:
 * `getPackingState` THROWS on any query whose `error` is set, and returns
 * `null` ONLY for a genuine not-found (no matching `orders` row for this
 * user). Do not "helpfully" restore `|| []` on the queries marked below —
 * that reintroduces the outage-looks-like-empty-state failure this guards.
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
  // maybeSingle() returns {data: null, error: null} for a genuine zero-row
  // result and {data: null, error: set} for an infra failure (bad connection,
  // RLS misconfiguration, etc.) — those are NOT the same thing, and only the
  // former is a 404. Check `error` before `!order`, or a transient failure
  // silently reads as "this order doesn't exist."
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select(
      `
      id, shopify_order_id, order_name, total_price, total_shipping,
      total_processing_fee, processing_fee_source,
      order_line_items ( id, title, quantity, product_id ),
      order_components ( id, quantity, components ( id, name, unit, cost_per_unit ) ),
      order_custom_costs ( id, description, amount )
    `
    )
    .eq("shopify_order_id", shopifyOrderId)
    .eq("user_id", userId)
    .maybeSingle();

  if (orderError) {
    throw new Error(
      `Could not load order ${shopifyOrderId} for packing: ${orderError.message}`
    );
  }
  if (!order) return null;

  // Component library (all of the user's components, name-sorted). A failed
  // query here would otherwise render as "you have no components yet" — an
  // empty picker that looks like a routine empty state, not an outage.
  const { data: library, error: libraryError } = await supabase
    .from("components")
    .select("id, name, type, unit, cost_per_unit")
    .eq("user_id", userId)
    .order("name");

  if (libraryError) {
    throw new Error(`Could not load the component library: ${libraryError.message}`);
  }

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
  const { data: products, error: productsError } = await supabase
    .from("products")
    .select(
      `
      id, title,
      product_components ( quantity, components ( cost_per_unit ) )
    `
    )
    .eq("user_id", userId);

  // FAIL LOUDLY — see module header. `products` erroring and falling back to
  // `[]` here is the failure mode this whole change guards against: the
  // lookup collapses to `{}`, every line item's product_id looks absent, and
  // classifyOrder reports `unlinked` for orders that are actually costed.
  if (productsError) {
    throw new Error(`Could not load product costs for packing: ${productsError.message}`);
  }

  const { data: variantRows, error: variantsError } = await supabase
    .from("product_variants")
    .select(
      `
      id, product_id,
      product_variant_components ( quantity, components ( cost_per_unit ) )
    `
    )
    .in("product_id", (products || []).map((p) => p.id));

  if (variantsError) {
    throw new Error(`Could not load variant costs for packing: ${variantsError.message}`);
  }

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
    // Deliberately NOT thrown on error, unlike the queries above. A failure
    // here only degrades the prefill suggestion to empty — the operator packs
    // from a blank slate instead of a pre-filled one, which is a worse UX but
    // not a wrong COGS or a mislabeled order. That's a materially lower stake
    // than the lookup/order/library queries, so this one is allowed to fall
    // through to `[]` rather than fail the whole GET.
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

import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { blockContextFromRequest } from "@/lib/shopify-block/auth";
import { blockJson, blockOptions } from "@/lib/shopify-block/http";
import { getPackingState } from "@/lib/orders/packing-state";

// Shopify numeric ids (the block sends the trailing segment of a
// `gid://shopify/Order/<id>` gid) are unsigned integers. Real ids are well
// under this many digits; the cap just keeps a pathological input from
// reaching a query. Kept in sync with packing-state/route.ts.
const SHOPIFY_ORDER_ID_PATTERN = /^\d{1,32}$/;

// components.id is a UUID primary key. Rejecting a malformed value here is a
// clean 400 instead of a generic 500 once it reaches Postgres and fails to
// cast to uuid.
const UUID_PATTERN =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

// order_components.quantity is unconstrained NUMERIC (arbitrary precision),
// so nothing at the database layer stops an absurd value from being stored.
// Cap it well above any real packing quantity: past this, Number(...) in
// getPackingState's COGS math can overflow to Infinity, and
// JSON.stringify(Infinity) silently serializes to null — cogs.total/margin
// would go null in the API response with no error anywhere.
const MAX_QUANTITY = 1_000_000;

// A few hundred lines is well beyond any real packing list. Same-tenant
// only, so this is an availability cap (unbounded .in() / RPC payload), not
// a security boundary.
const MAX_LINES = 500;

interface PackingBody {
  shopifyOrderId: string;
  lines: { componentId: string; quantity: number }[];
}

function parseBody(raw: unknown): PackingBody | null {
  if (!raw || typeof raw !== "object") return null;
  const b = raw as Record<string, unknown>;
  if (typeof b.shopifyOrderId !== "string" || !SHOPIFY_ORDER_ID_PATTERN.test(b.shopifyOrderId))
    return null;
  if (!Array.isArray(b.lines) || b.lines.length > MAX_LINES) return null;
  const lines: PackingBody["lines"] = [];
  for (const l of b.lines) {
    if (!l || typeof l !== "object") return null;
    const line = l as Record<string, unknown>;
    if (typeof line.componentId !== "string" || !UUID_PATTERN.test(line.componentId))
      return null;
    if (
      typeof line.quantity !== "number" ||
      !Number.isFinite(line.quantity) ||
      line.quantity <= 0 ||
      line.quantity > MAX_QUANTITY
    )
      return null;
    lines.push({ componentId: line.componentId, quantity: line.quantity });
  }
  // order_components has UNIQUE(order_id, component_id) — duplicates are a
  // client bug; reject rather than silently merging. Rejecting here also
  // matters for the RPC: replace_order_packing DELETEs the existing rows
  // before re-INSERTing, so a duplicate that trips the unique constraint
  // would abort the INSERT and roll back the DELETE too, silently reverting
  // an operator's edit. Catching it before the call avoids that surprise.
  if (new Set(lines.map((l) => l.componentId)).size !== lines.length) return null;
  return { shopifyOrderId: b.shopifyOrderId, lines };
}

export async function POST(request: NextRequest) {
  const ctx = await blockContextFromRequest(request);
  if (!ctx.ok) return blockJson({ error: ctx.error }, ctx.status);

  const body = parseBody(await request.json().catch(() => null));
  if (!body) return blockJson({ error: "Invalid request body" }, 400);

  const supabase = createAdminClient();

  // Scoped by user_id — this is the tenant boundary for the write below.
  // replace_order_packing takes a raw order_id and does not itself check
  // ownership, so everything hinges on order.id only ever resolving to a row
  // this tenant owns.
  const { data: order, error: orderLookupError } = await supabase
    .from("orders")
    .select("id")
    .eq("shopify_order_id", body.shopifyOrderId)
    .eq("user_id", ctx.userId)
    .maybeSingle();
  if (orderLookupError) {
    console.error("[block/packing] order lookup failed", orderLookupError);
    return blockJson({ error: "Could not load this order" }, 500);
  }
  if (!order) return blockJson({ error: "Order not found" }, 404);

  // Every component must belong to this tenant — a foreign id here is either
  // a bug or an attack; refuse the whole write. This closes the hole the RPC
  // itself leaves open: replace_order_packing will happily insert any
  // component_id it's given, so component ownership must be verified here,
  // before the call, not left to the database.
  if (body.lines.length > 0) {
    const ids = body.lines.map((l) => l.componentId);
    const { data: owned, error: ownedError } = await supabase
      .from("components")
      .select("id")
      .eq("user_id", ctx.userId)
      .in("id", ids);
    if (ownedError) {
      console.error("[block/packing] component ownership check failed", ownedError);
      return blockJson({ error: "Could not verify components for this order" }, 500);
    }
    if ((owned || []).length !== ids.length) {
      return blockJson({ error: "Unknown component in packing list" }, 400);
    }
  }

  const { error: rpcError } = await supabase.rpc("replace_order_packing", {
    p_order_id: order.id,
    p_lines: body.lines.map((l) => ({
      component_id: l.componentId,
      quantity: l.quantity,
    })),
  });
  if (rpcError) {
    // Never surface error.message to the client — it can contain Postgres
    // internals (constraint names, column details). Log server-side, return
    // a generic message.
    console.error("[block/packing] replace_order_packing failed", rpcError);
    return blockJson({ error: "Could not save the packing list" }, 500);
  }

  let state;
  try {
    state = await getPackingState(supabase, ctx.userId, body.shopifyOrderId);
  } catch (e) {
    console.error("[block/packing] getPackingState failed", e);
    return blockJson({ error: "Packing list saved, but could not reload order state" }, 500);
  }
  if (!state) return blockJson({ error: "Order could not be loaded" }, 500);

  return blockJson({ state });
}

export const OPTIONS = blockOptions;

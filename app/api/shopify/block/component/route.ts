import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { blockContextFromRequest } from "@/lib/shopify-block/auth";
import { blockJson, blockOptions } from "@/lib/shopify-block/http";
import { getPackingState } from "@/lib/orders/packing-state";

// Kept in sync with packing/route.ts and packing-state/route.ts.
const SHOPIFY_ORDER_ID_PATTERN = /^\d{1,32}$/;

const COMPONENT_TYPES = ["ingredient", "labor", "packaging", "other"] as const;
type ComponentType = (typeof COMPONENT_TYPES)[number];

// components.cost_per_unit is DECIMAL(18,8) — 18 total digits, 8 after the
// point, so the integer part tops out at 10 digits. Bound it here rather
// than letting an oversized value either get rejected by Postgres as a
// confusing 500, or (worse) silently overflow toward Infinity downstream in
// getPackingState's COGS math, which JSON.stringify serializes as null with
// no error anywhere.
const MAX_COST_PER_UNIT = 1e10;

interface ComponentBody {
  name: string;
  type: ComponentType;
  unit: string;
  costPerUnit: number;
  shopifyOrderId: string | null;
}

function parseBody(raw: unknown): ComponentBody | null {
  if (!raw || typeof raw !== "object") return null;
  const b = raw as Record<string, unknown>;

  if (typeof b.name !== "string") return null;
  const name = b.name.trim();
  if (!name) return null;

  if (typeof b.unit !== "string") return null;
  const unit = b.unit.trim();
  if (!unit) return null;

  if (typeof b.type !== "string" || !COMPONENT_TYPES.includes(b.type as ComponentType))
    return null;
  const type = b.type as ComponentType;

  if (
    typeof b.costPerUnit !== "number" ||
    !Number.isFinite(b.costPerUnit) ||
    b.costPerUnit < 0 ||
    b.costPerUnit >= MAX_COST_PER_UNIT
  )
    return null;

  let shopifyOrderId: string | null = null;
  if (b.shopifyOrderId !== undefined && b.shopifyOrderId !== null) {
    if (typeof b.shopifyOrderId !== "string" || !SHOPIFY_ORDER_ID_PATTERN.test(b.shopifyOrderId))
      return null;
    shopifyOrderId = b.shopifyOrderId;
  }

  return { name, type, unit, costPerUnit: b.costPerUnit, shopifyOrderId };
}

interface ComponentOrConflictRow {
  id: string;
  name: string;
  type: string;
  unit: string;
  cost_per_unit: number | null;
  inserted: boolean;
}

export async function POST(request: NextRequest) {
  const ctx = await blockContextFromRequest(request);
  if (!ctx.ok) return blockJson({ error: ctx.error }, ctx.status);

  const body = parseBody(await request.json().catch(() => null));
  if (!body) return blockJson({ error: "Invalid request body" }, 400);

  const supabase = createAdminClient();

  // create_component_or_conflict (scripts/026_packing_uniqueness.sql) does
  // the insert-or-detect-duplicate atomically in one statement, backed by a
  // UNIQUE index on components (user_id, lower(name)). This replaces a prior
  // SELECT-then-INSERT here that raced: two concurrent POSTs for the same
  // name could both pass the duplicate check before either had inserted,
  // and both create a component. The match inside the function is an exact
  // case-insensitive equality (lower(name) = lower(p_name)), not a pattern
  // match, so there's no ILIKE-wildcard-escaping concern for this lookup —
  // that class of bug (PostgREST's `*` alias for `%`, on top of the `%`/`_`
  // Postgres already treats specially) doesn't apply to a plain equality
  // comparison.
  const { data, error: rpcError } = await supabase
    .rpc("create_component_or_conflict", {
      p_user_id: ctx.userId,
      p_name: body.name,
      p_type: body.type,
      p_unit: body.unit,
      p_cost_per_unit: body.costPerUnit,
    })
    .single();

  if (rpcError || !data) {
    console.error("[block/component] create_component_or_conflict failed", rpcError);
    return blockJson({ error: "Could not create component" }, 500);
  }

  const row = data as unknown as ComponentOrConflictRow;

  if (!row.inserted) {
    // inserted === false means an existing row already owns this name for
    // this tenant (either it predates this call, or it won a concurrent
    // race) — map to the same 409 shape the block has always depended on.
    return blockJson(
      {
        error: `A component named "${row.name}" already exists`,
        existingComponentId: row.id,
      },
      409
    );
  }

  let state = null;
  if (body.shopifyOrderId) {
    try {
      state = await getPackingState(supabase, ctx.userId, body.shopifyOrderId);
    } catch (e) {
      console.error("[block/component] getPackingState failed", e);
      return blockJson(
        { error: "Component created, but could not reload order state" },
        500
      );
    }
  }

  return blockJson({
    component: {
      id: row.id,
      name: row.name,
      type: row.type,
      unit: row.unit,
      costPerUnit: row.cost_per_unit || 0,
    },
    state,
  });
}

export const OPTIONS = blockOptions;

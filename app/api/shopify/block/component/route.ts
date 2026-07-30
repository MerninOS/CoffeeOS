import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { blockContextFromRequest } from "@/lib/shopify-block/auth";
import { blockJson, blockOptions } from "@/lib/shopify-block/http";
import { getPackingState } from "@/lib/orders/packing-state";

// Kept in sync with packing/route.ts and packing-state/route.ts.
const SHOPIFY_ORDER_ID_PATTERN = /^\d{1,32}$/;

const COMPONENT_TYPES = ["ingredient", "labor", "packaging", "other"] as const;
type ComponentType = (typeof COMPONENT_TYPES)[number];

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
    b.costPerUnit < 0
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

// Escape ILIKE wildcards so a name like "50% blend" or "a_b" is matched
// literally rather than as a pattern.
function escapeIlike(value: string): string {
  return value.replace(/[%_\\]/g, (c) => `\\${c}`);
}

export async function POST(request: NextRequest) {
  const ctx = await blockContextFromRequest(request);
  if (!ctx.ok) return blockJson({ error: ctx.error }, ctx.status);

  const body = parseBody(await request.json().catch(() => null));
  if (!body) return blockJson({ error: "Invalid request body" }, 400);

  const supabase = createAdminClient();

  // Duplicate guard: case-insensitive exact match on name within this
  // tenant, so the block can surface "already exists" instead of creating a
  // twin component. Components have no unique constraint on name (they
  // predate this endpoint), so more than one row could already match — use
  // limit(1) rather than maybeSingle(), which throws on a multi-row result.
  const { data: existingRows, error: existingError } = await supabase
    .from("components")
    .select("id, name")
    .eq("user_id", ctx.userId)
    .ilike("name", escapeIlike(body.name))
    .limit(1);
  if (existingError) {
    console.error("[block/component] duplicate check failed", existingError);
    return blockJson({ error: "Could not check for an existing component" }, 500);
  }
  const existing = existingRows?.[0];
  if (existing) {
    return blockJson(
      {
        error: `A component named "${existing.name}" already exists`,
        existingComponentId: existing.id,
      },
      409
    );
  }

  const { data: created, error: insertError } = await supabase
    .from("components")
    .insert({
      user_id: ctx.userId,
      name: body.name,
      type: body.type,
      unit: body.unit,
      cost_per_unit: body.costPerUnit,
    })
    .select("id, name, type, unit, cost_per_unit")
    .single();
  if (insertError || !created) {
    console.error("[block/component] insert failed", insertError);
    return blockJson({ error: "Could not create component" }, 500);
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
      id: created.id,
      name: created.name,
      type: created.type,
      unit: created.unit,
      costPerUnit: created.cost_per_unit || 0,
    },
    state,
  });
}

export const OPTIONS = blockOptions;

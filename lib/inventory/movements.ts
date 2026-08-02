/**
 * How a `coffee_inventory_changes` row is written down for an operator.
 *
 * Pure functions rather than ternaries inline in the panel, so the unit tests
 * and the UI share ONE implementation — the same split `lib/orders/format.ts`
 * draws, and for the same reason: a test that re-declares the rule passes while
 * the component drifts.
 *
 * This table has been written since the feature shipped — on every create, every
 * manual adjustment, and every roast batch — and read by NOTHING in the
 * application. Rendering it is the substance of CoffeeOS#72 beyond the reskin.
 *
 * WHAT THIS MODULE REFUSES TO INVENT
 *
 * Two identifiers an operator would reasonably expect do not exist, and the
 * honest rendering is to omit them rather than synthesise something:
 *
 *  - `roasting_batches` HAS NO BATCH NUMBER. Its columns are `id` (a UUID),
 *    `coffee_name`, `lot_code` and `batch_date`. The design mock showed
 *    "Batch BR-0142"; that code is fabricated and must not be reproduced. A UUID
 *    is not shown to an operator either, so the source reads "Roast batch" and
 *    the row's own timestamp does the dating.
 *  - AN ORDER NUMBER may or may not be resolvable depending on what the caller
 *    joins. `orderNumber` is therefore an input, not an assumption: absent it,
 *    the source degrades to "Order".
 */

import { gramsToLbs } from "./units";

export type ChangeType =
  | "initial"
  | "manual_green_adjust"
  | "roast_deduct"
  | "roast_add"
  | "sale_deduct"
  | "manual_roasted_adjust"
  | "price_change";

export type ReferenceType = "roasting_batch" | "order" | "manual" | null;

/** A change row as `getLotMovements` selects it. */
export interface MovementRow {
  id: string;
  change_type: ChangeType;
  green_quantity_change_g: number | null;
  old_price_per_lb: number | null;
  new_price_per_lb: number | null;
  reference_type: ReferenceType;
  notes: string | null;
  created_at: string;
  /** Joined from `profiles`; null when the reader may not see that row. */
  actorName?: string | null;
  /** Supplied only when the caller could resolve one. */
  orderNumber?: string | null;
}

export interface Movement {
  id: string;
  /** `quantity` carries a pound delta; `price` carries a cost change. */
  kind: "quantity" | "price";
  label: string;
  source: string;
  actor: string;
  note: string | null;
  at: string;
  /** Signed pounds, `quantity` only. */
  deltaLbs?: number;
  oldPrice?: number | null;
  newPrice?: number | null;
}

const LABEL: Record<ChangeType, string> = {
  initial: "Received",
  manual_green_adjust: "Manual adjust",
  roast_deduct: "Roasted",
  roast_add: "Returned",
  sale_deduct: "Sold",
  manual_roasted_adjust: "Roasted adjust",
  price_change: "Cost change",
};

/**
 * The acting user, or a role when their profile is unreadable.
 *
 * `profiles_select` grants `auth.uid() = id OR owner_id = auth.uid() OR
 * owner_id = <your owner_id>`, and an OWNER's own profile row has a null
 * `owner_id` — so an employee reading a movement the owner made gets nothing
 * back. "Owner" is inferred rather than blank: the row exists, the actor is
 * simply not readable, and rendering an empty cell would look like missing data
 * (Criterion 14a).
 */
export function actorLabel(actorName: string | null | undefined): string {
  const trimmed = (actorName ?? "").trim();
  return trimmed === "" ? "Owner" : trimmed;
}

/** Where a change came from, never synthesising an identifier. */
export function sourceLabel(
  referenceType: ReferenceType,
  orderNumber?: string | null,
): string {
  if (referenceType === "roasting_batch") return "Roast batch";
  if (referenceType === "order") {
    const n = (orderNumber ?? "").trim();
    return n === "" ? "Order" : `Order ${n}`;
  }
  return "Manual";
}

/**
 * A signed pound delta, signed exactly once.
 *
 * `−8.0 lb`, `+50.0 lb`. The minus is U+2212, matching `lib/orders/format.ts`,
 * and the sign comes from the VALUE rather than being hard-coded — hard-coding
 * it is how `−$-5.00` reached production on /orders.
 */
export function deltaLabel(deltaLbs: number): string {
  const sign = deltaLbs < 0 ? "−" : "+";
  return `${sign}${Math.abs(deltaLbs).toFixed(1)} lb`;
}

export function toMovement(row: MovementRow): Movement {
  const base = {
    id: row.id,
    label: LABEL[row.change_type] ?? row.change_type,
    source: sourceLabel(row.reference_type, row.orderNumber),
    actor: actorLabel(row.actorName),
    note: row.notes && row.notes.trim() !== "" ? row.notes : null,
    at: row.created_at,
  };

  if (row.change_type === "price_change") {
    return {
      ...base,
      kind: "price",
      oldPrice: row.old_price_per_lb,
      newPrice: row.new_price_per_lb,
    };
  }

  return {
    ...base,
    kind: "quantity",
    deltaLbs: gramsToLbs(row.green_quantity_change_g ?? 0),
  };
}

export function toMovements(rows: MovementRow[]): Movement[] {
  return rows.map(toMovement);
}

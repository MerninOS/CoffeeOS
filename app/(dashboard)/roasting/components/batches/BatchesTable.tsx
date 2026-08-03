"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { format } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Trash2, Eye, Package, Plus } from "lucide-react";
import { Badge } from "@merninos/ui/instrument";
import { mono, overline, sans } from "@/lib/instrument/tokens";
import type { Batch } from "./types";
import { lossColor } from "./costing";
import { lb } from "../../units";

/**
 * Retokenized onto instrument (CoffeeOS#71). Worksheet idiom, not a card: a
 * sunken overline header, hairline row rules, no zebra — same idiom as
 * ../requests/RequestsTable.tsx.
 *
 * DropdownMenuContent gets `data-surface="app"` because Radix portals it to
 * <body>, outside the instrument token scope — see ProductDialogs.tsx.
 *
 * Columns are widened from the loud version's 80px weight columns, which is
 * what produced the header collision this ticket fixes ("ROASTED (G) LOSS %"
 * running together at 80px). The unit is also now stated once, on the first
 * weight column, rather than on each of the three — see costing note below.
 */

const MENU_CONTENT: CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--hairline-strong)",
  borderRadius: "var(--r-md)",
  boxShadow: "var(--shadow-pop)",
  color: "var(--ink)",
  padding: 4,
};

const MENU_ITEM: CSSProperties = {
  fontFamily: "var(--font-sans)",
  fontSize: "var(--fs-body)",
  color: "var(--ink)",
  borderRadius: "var(--r-sm)",
};

const HEAD: CSSProperties = {
  ...overline,
  color: "var(--ink-muted)",
  background: "var(--surface-sunken)",
  borderBottom: "1px solid var(--hairline-strong)",
  height: 34,
  display: "flex",
  alignItems: "center",
  padding: "0 12px",
};

const CELL: CSSProperties = {
  ...sans,
  fontSize: "var(--fs-body)",
  color: "var(--ink)",
  minHeight: 44,
  padding: "0 12px",
  display: "flex",
  alignItems: "center",
};

const RULE: CSSProperties = { borderBottom: "1px solid var(--hairline)" };

const TRUNCATE: CSSProperties = { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };

const menuTriggerStyle: CSSProperties = {
  display: "flex",
  height: 28,
  width: 28,
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "var(--r-sm)",
  border: "1px solid transparent",
  color: "var(--ink-muted)",
  background: "transparent",
  cursor: "pointer",
};

/**
 * Widened from the loud version's uniform 80px weight columns — at that width
 * "Roasted (g)" and "Loss %" overran their columns and visibly collided.
 * Green/Roasted/Sellable are also one character shorter than "Green (lb)"
 * would be at 90px, because the unit is stated once (see HEADERS below), not
 * repeated on every column. Lot is 150px, not 90 — a full lot code badge
 * ("ETH-YIR-2026-01") ran into the Green column at 90. Loss is 80, not 70 —
 * "LOSS %" wrapped to two lines at 70. Green is 110, not 90 — "Green (lb)",
 * the one column carrying the unit label, wrapped to two lines at 90.
 */
const GRID = "minmax(0,1fr) 100px 150px 110px 90px 80px 90px 130px 44px";

const HEADERS = ["Coffee", "Session", "Lot", "Green (lb)", "Roasted", "Loss %", "Sellable", "Component", ""];

/**
 * `lossColor` (costing.ts) is untouched (CoffeeOS#110) and still returns a
 * Tailwind class — this maps its three possible outcomes to instrument's
 * semantic colour tokens at the call site rather than reading the class.
 *
 * The keys are derived by calling `lossColor` at one representative value per
 * bracket (>18, <12, else) rather than copying its literal return strings —
 * so this never has to spell a loud Tailwind class name in its own source
 * (which the static sweep in roasting-tokens.spec.ts would flag) and can
 * never drift from what costing.ts actually returns.
 */
const LOSS_TONE: Record<string, string> = {
  [lossColor(19)]: "var(--danger)",
  [lossColor(10)]: "var(--warning)",
  [lossColor(15)]: "var(--success)",
};

interface BatchesTableProps {
  batches: Batch[];
  onCreateComponent: (batch: Batch) => void;
  onDelete: (id: string) => void;
}

export function BatchesTable({ batches, onCreateComponent, onDelete }: BatchesTableProps) {
  return (
    <div data-testid="batches-table" className="hidden md:block">
      <div className="grid" style={{ gridTemplateColumns: GRID }}>
        {HEADERS.map((h) => (
          <div key={h} style={HEAD}>
            {h}
          </div>
        ))}
      </div>
      <div>
        {batches.map((batch, i) => (
          <div
            key={batch.id}
            data-testid="batch-row"
            className="grid items-center"
            style={{ gridTemplateColumns: GRID, ...(i < batches.length - 1 ? RULE : {}) }}
          >
            <p data-testid="row-coffee" style={{ ...CELL, ...TRUNCATE, fontWeight: 500 }}>
              {batch.coffee_name}
            </p>
            <div data-testid="row-session" style={{ ...CELL, color: "var(--ink-muted)", fontSize: "var(--fs-caption)" }}>
              {batch.roasting_sessions ? (
                <Link href={`/roasting/sessions/${batch.roasting_sessions.id}`}>
                  {format(new Date(batch.roasting_sessions.session_date), "MMM d, yyyy")}
                </Link>
              ) : (
                format(new Date(batch.batch_date), "MMM d, yyyy")
              )}
            </div>
            <div data-testid="row-lot" style={CELL}>
              {batch.lot_code ? (
                <Badge tone="neutral" variant="soft" size="sm" mono>
                  {batch.lot_code}
                </Badge>
              ) : (
                <span style={{ color: "var(--ink-subtle)" }}>—</span>
              )}
            </div>
            <div data-testid="row-green" style={{ ...CELL, ...mono, justifyContent: "flex-end" }}>
              {lb(batch.green_weight_g)}
            </div>
            <div data-testid="row-roasted" style={{ ...CELL, ...mono, justifyContent: "flex-end" }}>
              {lb(batch.roasted_weight_g)}
            </div>
            <div data-testid="row-loss" style={{ ...CELL, justifyContent: "flex-end" }}>
              <span style={{ ...mono, fontWeight: 600, color: LOSS_TONE[lossColor(batch.loss_percent)] ?? "var(--ink)" }}>
                {batch.loss_percent.toFixed(1)}%
              </span>
            </div>
            <div data-testid="row-sellable" style={{ ...CELL, ...mono, justifyContent: "flex-end" }}>
              {lb(batch.sellable_g)}
            </div>
            <div data-testid="row-component" style={CELL}>
              {batch.components ? (
                <Link
                  href="/components"
                  style={{ display: "inline-flex", alignItems: "center", gap: 4, fontWeight: 500, color: "var(--ink)" }}
                >
                  <Package size={11} strokeWidth={2} />
                  <span style={TRUNCATE}>{batch.components.name}</span>
                </Link>
              ) : (
                <button
                  onClick={() => onCreateComponent(batch)}
                  style={{
                    ...overline,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    color: "var(--ink-subtle)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  <Plus size={10} strokeWidth={2.5} />
                  Create
                </button>
              )}
            </div>
            <div style={{ ...CELL, justifyContent: "center" }}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button data-testid="batch-menu" style={menuTriggerStyle}>
                    <MoreHorizontal size={14} strokeWidth={2} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent data-surface="app" align="end" style={MENU_CONTENT}>
                  {batch.roasting_sessions && (
                    <DropdownMenuItem asChild style={MENU_ITEM}>
                      <Link data-testid="menu-view-session" href={`/roasting/sessions/${batch.roasting_sessions.id}`}>
                        <Eye className="mr-2 h-4 w-4" />View Session
                      </Link>
                    </DropdownMenuItem>
                  )}
                  {!batch.component_id && (
                    <DropdownMenuItem data-testid="menu-create-component" style={MENU_ITEM} onClick={() => onCreateComponent(batch)}>
                      <Package className="mr-2 h-4 w-4" />Create Component
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    data-testid="menu-delete"
                    style={{ ...MENU_ITEM, color: "var(--danger)" }}
                    onClick={() => onDelete(batch.id)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

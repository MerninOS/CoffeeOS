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
 * Mobile (`md:hidden`) stacked-row rendering, retokenized onto instrument
 * (CoffeeOS#71) — kept as its own file rather than merged with
 * BatchesTable.tsx, matching the ../requests split.
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

const menuTriggerStyle: CSSProperties = {
  display: "flex",
  height: 28,
  width: 28,
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "var(--r-sm)",
  border: "1px solid var(--hairline)",
  color: "var(--ink-muted)",
  background: "transparent",
  cursor: "pointer",
};

/**
 * See BatchesTable.tsx for why these keys are derived by calling `lossColor`
 * rather than copying its literal Tailwind return strings.
 */
const LOSS_TONE: Record<string, string> = {
  [lossColor(19)]: "var(--danger)",
  [lossColor(10)]: "var(--warning)",
  [lossColor(15)]: "var(--success)",
};

interface BatchCardProps {
  batches: Batch[];
  onCreateComponent: (batch: Batch) => void;
  onDelete: (id: string) => void;
}

export function BatchCard({ batches, onCreateComponent, onDelete }: BatchCardProps) {
  return (
    <div className="md:hidden">
      {batches.map((batch, i) => (
        <div
          key={batch.id}
          data-testid="batch-card"
          style={{ padding: 12, ...(i > 0 ? { borderTop: "1px solid var(--hairline)" } : {}) }}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p
                data-testid="row-coffee"
                style={{ ...sans, fontWeight: 500, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
              >
                {batch.coffee_name}
              </p>
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                {batch.roasting_sessions ? (
                  <Link
                    data-testid="row-session"
                    href={`/roasting/sessions/${batch.roasting_sessions.id}`}
                    style={{ fontSize: "var(--fs-caption)", color: "var(--ink-muted)" }}
                  >
                    {format(new Date(batch.roasting_sessions.session_date), "MMM d, yyyy")}
                  </Link>
                ) : (
                  <span data-testid="row-session" style={{ fontSize: "var(--fs-caption)", color: "var(--ink-muted)" }}>
                    {format(new Date(batch.batch_date), "MMM d, yyyy")}
                  </span>
                )}
                {batch.lot_code && (
                  <span data-testid="row-lot">
                    <Badge tone="neutral" variant="soft" size="sm" mono>
                      {batch.lot_code}
                    </Badge>
                  </span>
                )}
              </div>
            </div>
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

          <div className="mt-2 grid grid-cols-4 gap-1">
            {[
              { label: "Green", value: lb(batch.green_weight_g), testId: "row-green" },
              { label: "Roasted", value: lb(batch.roasted_weight_g), testId: "row-roasted" },
              {
                label: "Loss",
                value: (
                  <span style={{ fontWeight: 600, color: LOSS_TONE[lossColor(batch.loss_percent)] ?? "var(--ink)" }}>
                    {batch.loss_percent.toFixed(1)}%
                  </span>
                ),
                testId: "row-loss",
              },
              { label: "Sellable", value: lb(batch.sellable_g), testId: "row-sellable" },
            ].map((stat) => (
              <div key={stat.label} data-testid={stat.testId}>
                <span style={{ ...overline, display: "block" }}>{stat.label}</span>
                <span style={{ ...mono, fontWeight: 500, color: "var(--ink)" }}>{stat.value}</span>
              </div>
            ))}
          </div>

          {batch.components ? (
            <div data-testid="row-component" className="mt-2">
              <Link
                href="/components"
                style={{ display: "inline-flex", alignItems: "center", gap: 4, fontWeight: 500, color: "var(--ink)", fontSize: "var(--fs-caption)" }}
              >
                <Package size={10} strokeWidth={2} />
                {batch.components.name}
              </Link>
            </div>
          ) : (
            <button
              data-testid="row-component"
              onClick={() => onCreateComponent(batch)}
              className="mt-2 flex w-full items-center justify-center gap-1"
              style={{
                ...overline,
                padding: "6px 0",
                borderRadius: "var(--r-sm)",
                border: "1px dashed var(--hairline-strong)",
                color: "var(--ink-muted)",
                background: "none",
                cursor: "pointer",
              }}
            >
              <Plus size={10} strokeWidth={2.5} />
              Create Component
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

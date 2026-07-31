"use client";

import type { CSSProperties } from "react";
import { cogsLabel } from "@/lib/orders/format";
import { IconButton } from "@merninos/ui/instrument";
import { X } from "lucide-react";
import { mono, overline, sans, money } from "../../components/tokens";
import type { Order, ProductRow } from "./types";

/**
 * The cost of one order, as a single ruled ledger.
 *
 * THE ARGUMENT: line items, order components and custom costs were three
 * separate bordered panels with a fourth — Cost Summary — reconciling them ~500px
 * further down. An operator asking "why is this margin what it is" had to hold
 * four boxes in their head and trust that the total at the bottom matched. Here
 * every row lands on the SAME six column tracks, so revenue and cost are read
 * against the same rulers and the total is the last line of the thing it totals.
 *
 * Hand-built rather than the kit's `DataTable`, for the same reason /orders'
 * table is: DataTable has no row grouping and no inline add row, and both are
 * load-bearing here.
 *
 * Every track is `minmax(0, …)`. A bare `68px` track grows to an inline input's
 * min-content and silently drags the whole table's alignment with it — found
 * while building the design mock, and the reason criterion 17 asserts geometry
 * at 1600 as well as the two widths the baselines cover.
 *
 * DESIGN-SYSTEM RULE: every value here is read as `var(--token)` in an inline
 * style. This repo's Tailwind theme is the LOUD Mernin' palette, so `bg-cream`
 * or `text-espresso` would silently render the other design system inside the
 * Instrument shell. Tailwind appears only where a breakpoint is needed.
 */

const GRID =
  "minmax(0,1fr) minmax(0,68px) minmax(0,84px) minmax(0,92px) minmax(0,116px) minmax(0,100px) 30px";

const HEAD: CSSProperties = {
  ...overline,
  color: "var(--ink-subtle)",
  padding: "0 12px",
  height: 32,
  display: "flex",
  alignItems: "center",
  whiteSpace: "nowrap",
  minWidth: 0,
  background: "var(--surface-sunken)",
  borderBottom: "1px solid var(--hairline-strong)",
};

const CELL: CSSProperties = {
  padding: "0 12px",
  minHeight: 40,
  minWidth: 0,
  display: "flex",
  alignItems: "center",
  fontSize: "var(--fs-body)",
};

const R: CSSProperties = { justifyContent: "flex-end" };
const RULE: CSSProperties = { borderBottom: "1px solid var(--hairline)" };

/** A ruled band inside the worksheet — deliberately not a nested card. */
export function GroupRow({ label, note }: { label: string; note?: string }) {
  return (
    <div
      style={{
        gridColumn: "1 / -1",
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "0 12px",
        height: 30,
        background: "var(--surface-sunken)",
        borderTop: "1px solid var(--hairline-strong)",
        borderBottom: "1px solid var(--hairline)",
      }}
    >
      <span style={{ ...overline, color: "var(--ink-muted)" }}>{label}</span>
      {note && (
        <span style={{ ...sans, fontSize: "var(--fs-caption)", color: "var(--ink-subtle)" }}>
          {note}
        </span>
      )}
    </div>
  );
}

/**
 * Three states, three different problems, three different fixes.
 *
 * A product costed entirely from zero-cost components really is $0.00 — the
 * operator did that work, and saying "not set" tells them to redo it
 * (CoffeeOS#68). A line item resolving to no product at all is a different
 * failure again, and not repairable by costing anything (CoffeeOS#78).
 *
 * Reads the lookup, never `order_line_items.title`: the line item carries the
 * product's name AT THE TIME OF SALE, and sending an operator to fix a name
 * that no longer exists on /products is the confusion #78 documents.
 */
export function CostCell({ row }: { row: ProductRow }) {
  if (!row.linked) {
    return (
      <span style={{ ...mono, fontSize: "var(--fs-caption)", color: "var(--danger)" }}>
        no product
      </span>
    );
  }
  if (!row.hasRecipe) {
    return (
      <span style={{ ...mono, fontSize: "var(--fs-caption)", color: "var(--danger)" }}>
        not set
      </span>
    );
  }
  return <span style={mono}>{money(row.unitCost)}</span>;
}

export function Worksheet({
  order,
  rows,
  cogs,
  costKnown,
  profit,
  margin,
  blockedBy,
  shipping,
  addComponentRow,
  addCostRow,
  onRemoveComponent,
  onRemoveCost,
}: {
  order: Order;
  rows: ProductRow[];
  cogs: number;
  costKnown: boolean;
  profit: number;
  margin: number;
  blockedBy: string | null;
  shipping: number;
  addComponentRow: React.ReactNode;
  addCostRow: React.ReactNode;
  onRemoveComponent: (id: string) => void;
  onRemoveCost: (id: string) => void;
}) {
  const dash: CSSProperties = { ...mono, color: "var(--ink-subtle)" };

  return (
    <div
      style={{
        border: "1px solid var(--hairline)",
        borderRadius: "var(--r-md)",
        overflow: "hidden",
        background: "var(--surface)",
      }}
    >
      {/* `worksheet` is a test contract: order-detail-layout.spec.ts measures
          these grid tracks at three widths. Baselines only shoot 1280 and 375,
          and /orders shipped a defect that lived above 1400 where no baseline
          looks — so geometry is asserted, not pixels. */}
      <div data-testid="worksheet" style={{ display: "grid", gridTemplateColumns: GRID }}>
        <div style={HEAD}>Item</div>
        <div style={{ ...HEAD, ...R }}>Qty</div>
        <div style={{ ...HEAD, ...R }}>Price</div>
        <div style={{ ...HEAD, ...R }}>Revenue</div>
        <div style={{ ...HEAD, ...R }}>Unit cost</div>
        <div style={{ ...HEAD, ...R }}>Cost</div>
        <div style={HEAD} />

        {/* ── Line items ── */}
        <GroupRow label="Line items" />
        {rows.length === 0 && (
          <div
            style={{
              gridColumn: "1 / -1",
              ...RULE,
              ...sans,
              color: "var(--ink-subtle)",
              padding: "10px 12px",
            }}
          >
            None. Shopify sent no line items for this order.
          </div>
        )}
        {rows.map((row) => (
          <div key={row.id} style={{ display: "contents" }}>
            <div
              style={{
                ...CELL,
                ...RULE,
                flexDirection: "column",
                alignItems: "flex-start",
                justifyContent: "center",
                gap: 1,
                padding: "8px 12px",
              }}
            >
              <span style={{ color: "var(--ink)" }}>{row.title}</span>
              <span
                style={{ ...mono, fontSize: "var(--fs-overline)", color: "var(--ink-subtle)" }}
              >
                {row.sku || "no sku"}
                {row.variantTitle ? ` · ${row.variantTitle}` : ""}
              </span>
            </div>
            <div style={{ ...CELL, ...R, ...RULE, ...mono, color: "var(--ink-muted)" }}>
              {row.qty}
            </div>
            <div style={{ ...CELL, ...R, ...RULE, ...mono }}>{money(row.price)}</div>
            <div style={{ ...CELL, ...R, ...RULE, ...mono }}>{money(row.price * row.qty)}</div>
            <div style={{ ...CELL, ...R, ...RULE }}>
              <CostCell row={row} />
            </div>
            <div style={{ ...CELL, ...R, ...RULE }}>
              {row.linked && row.hasRecipe ? (
                <span style={mono}>{money(row.unitCost * row.qty)}</span>
              ) : (
                <span style={dash}>—</span>
              )}
            </div>
            <div style={{ ...CELL, ...RULE }} />
          </div>
        ))}

        {/* ── Order components ── */}
        <GroupRow label="Order components" note="packaging and per-order materials" />
        {order.order_components.length === 0 && (
          <div
            style={{
              gridColumn: "1 / -1",
              ...RULE,
              ...sans,
              color: "var(--ink-subtle)",
              padding: "10px 12px",
            }}
          >
            None yet.
          </div>
        )}
        {order.order_components.map((oc) => (
          <div key={oc.id} style={{ display: "contents" }}>
            <div style={{ ...CELL, ...RULE }}>{oc.components?.name || "Unknown"}</div>
            <div style={{ ...CELL, ...R, ...RULE, ...mono, color: "var(--ink-muted)" }}>
              {oc.quantity}
            </div>
            <div style={{ ...CELL, ...RULE }} />
            <div style={{ ...CELL, ...RULE }} />
            <div style={{ ...CELL, ...R, ...RULE, ...mono, color: "var(--ink-muted)" }}>
              {money(oc.components?.cost_per_unit || 0)}
            </div>
            <div style={{ ...CELL, ...R, ...RULE, ...mono }}>
              {money((oc.components?.cost_per_unit || 0) * oc.quantity)}
            </div>
            <div style={{ ...CELL, ...RULE, padding: "0 4px" }}>
              <IconButton
                size="sm"
                icon={<X size={14} strokeWidth={1.5} />}
                aria-label={`Remove ${oc.components?.name || "component"}`}
                onClick={() => onRemoveComponent(oc.id)}
              />
            </div>
          </div>
        ))}
        <div style={{ gridColumn: "1 / -1", ...RULE }}>{addComponentRow}</div>

        {/* ── Custom costs ── */}
        <GroupRow label="Custom costs" note="one-off charges against this order" />
        {order.order_custom_costs.length === 0 && (
          <div
            style={{
              gridColumn: "1 / -1",
              ...RULE,
              ...sans,
              color: "var(--ink-subtle)",
              padding: "10px 12px",
            }}
          >
            None yet.
          </div>
        )}
        {order.order_custom_costs.map((cc) => (
          <div key={cc.id} style={{ display: "contents" }}>
            <div style={{ ...CELL, ...RULE }}>{cc.description}</div>
            <div style={{ ...CELL, ...RULE }} />
            <div style={{ ...CELL, ...RULE }} />
            <div style={{ ...CELL, ...RULE }} />
            <div style={{ ...CELL, ...RULE }} />
            <div style={{ ...CELL, ...R, ...RULE, ...mono }}>{money(cc.amount)}</div>
            <div style={{ ...CELL, ...RULE, padding: "0 4px" }}>
              <IconButton
                size="sm"
                icon={<X size={14} strokeWidth={1.5} />}
                aria-label={`Remove ${cc.description}`}
                onClick={() => onRemoveCost(cc.id)}
              />
            </div>
          </div>
        ))}
        <div style={{ gridColumn: "1 / -1", ...RULE }}>{addCostRow}</div>

        {/* ── Totals ──
            Revenue reconciles down the Revenue column and cost down the Cost
            column, so the two are legible against each other. The old page
            stated these twice — once under Order Items, once in a Cost Summary
            panel far below — with no way to see that they agreed. */}
        <div
          style={{
            gridColumn: "1 / -1",
            height: 8,
            background: "var(--surface-sunken)",
            borderTop: "1px solid var(--hairline-strong)",
          }}
        />

        {(
          [
            ["Subtotal", order.subtotal_price],
            ["Shipping", shipping],
            ["Tax", order.total_tax],
          ] as const
        ).map(([label, value]) => (
          <div key={label} style={{ display: "contents" }}>
            <div
              style={{
                ...CELL,
                minHeight: 28,
                gridColumn: "1 / 4",
                justifyContent: "flex-end",
                ...sans,
                color: "var(--ink-muted)",
              }}
            >
              {label}
            </div>
            <div style={{ ...CELL, ...R, minHeight: 28, ...mono, color: "var(--ink-muted)" }}>
              {money(value || 0)}
            </div>
            <div style={{ gridColumn: "5 / -1" }} />
          </div>
        ))}

        <div
          style={{
            ...CELL,
            gridColumn: "1 / 4",
            justifyContent: "flex-end",
            ...overline,
            color: "var(--ink-muted)",
            borderTop: "1px solid var(--hairline)",
          }}
        >
          Revenue
        </div>
        <div
          style={{
            ...CELL,
            ...R,
            ...mono,
            fontSize: "var(--fs-data)",
            borderTop: "1px solid var(--hairline)",
          }}
        >
          {money(order.total_price)}
        </div>
        <div
          style={{
            ...CELL,
            ...R,
            ...overline,
            color: "var(--ink-muted)",
            borderTop: "1px solid var(--hairline)",
          }}
        >
          COGS
        </div>
        {/* `cogsLabel` owns the not-set-vs-partial rule and the sign. Red here
            means INCOMPLETE, never merely present — a costed COGS is equally
            known and renders in ink. Do not re-derive this (criterion 12d). */}
        <div style={{ ...CELL, ...R, borderTop: "1px solid var(--hairline)" }}>
          <span
            data-testid="detail-cogs"
            style={{
              ...mono,
              fontSize: costKnown ? "var(--fs-data)" : "var(--fs-caption)",
              color: costKnown ? "var(--ink)" : "var(--danger)",
            }}
          >
            {cogsLabel(cogs, costKnown)}
          </span>
        </div>
        <div style={{ borderTop: "1px solid var(--hairline)" }} />

        <div style={{ gridColumn: "1 / -1", borderTop: "2px solid var(--ink)" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: 14,
              flexWrap: "wrap",
              padding: "0 12px",
              minHeight: 52,
            }}
          >
            <span style={{ ...overline, color: "var(--ink)", marginRight: "auto" }}>
              Net profit
            </span>
            {costKnown ? (
              <>
                <span
                  data-testid="detail-profit"
                  style={{ ...mono, fontSize: "var(--fs-data-lg)", color: "var(--ink)" }}
                >
                  {money(profit)}
                </span>
                <span
                  style={{
                    ...mono,
                    fontSize: "var(--fs-data)",
                    color: "var(--ink-muted)",
                    minWidth: 66,
                    textAlign: "right",
                  }}
                >
                  {margin.toFixed(1)}%
                </span>
              </>
            ) : (
              /* Withheld, MUTED — not red. Red warns about a figure that exists
                 and is incomplete; there is no figure here. Matches /orders. */
              <span style={{ ...mono, fontSize: "var(--fs-data-lg)", color: "var(--ink-subtle)" }}>
                —
              </span>
            )}
          </div>
          {blockedBy && (
            <div
              style={{
                ...sans,
                color: "var(--danger)",
                padding: "0 12px 12px",
                lineHeight: 1.4,
              }}
            >
              {blockedBy}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

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

/**
 * The seven tracks, applied ONLY at >=900px.
 *
 * They total ~490px of fixed width before the 1fr item column, which does not
 * fit a phone: at 375px the headers collided ("REVENUEUNIT COST"), the Qty track
 * collapsed to nothing and printed its value on top of the wrapping item name.
 * The geometry test only asserted 1280/1440/1600 — chosen because /orders shipped
 * a defect above 1400 — so nothing was watching below the desktop range.
 *
 * Below the breakpoint the grid becomes ONE column and each row stacks, with
 * every figure carrying its own label. Same approach as OrdersWorksheetTable,
 * and the same reason: one rendering serving both layouts, rather than a
 * duplicate mobile tree that doubles every testid.
 */
const GRID =
  "minmax(0,1fr) minmax(0,68px) minmax(0,84px) minmax(0,92px) minmax(0,116px) minmax(0,100px) 30px";

/**
 * Layout only — Tailwind is allowed here precisely because it is a breakpoint.
 *
 * Written as LITERAL strings, never composed from a variable: Tailwind's JIT
 * scans source text, so `${PREFIX}flex` produces a class that is never
 * generated and silently does nothing. Same reason OrdersWorksheetTable spells
 * out every `min-[1180px]:` occurrence.
 */
const ROW = "ws-row gap-x-3";
const HEAD_CELL = "ws-headcell";

/**
 * Visual only — NO display/alignment. Those live in HEAD_CELL, because an inline
 * style beats a class: with `display: "flex"` here, the `hidden` in HEAD_CELL
 * did nothing and the column headers rendered on top of the stacked rows.
 */
const HEAD: CSSProperties = {
  ...overline,
  color: "var(--ink-subtle)",
  padding: "0 12px",
  height: 32,
  whiteSpace: "nowrap",
  minWidth: 0,
  background: "var(--surface-sunken)",
  borderBottom: "1px solid var(--hairline-strong)",
};

const CELL: CSSProperties = {
  padding: "0 12px",
  minHeight: 40,
  minWidth: 0,
  fontSize: "var(--fs-body)",
};

const R: CSSProperties = { justifyContent: "flex-end" };
const RULE: CSSProperties = { borderBottom: "1px solid var(--hairline)" };

/**
 * A figure that names itself when stacked.
 *
 * Below 900px the column headers are hidden, so an unlabelled "$16.42" says
 * nothing. Showing the label inline — and hiding it again at the breakpoint —
 * is what makes one rendering serve both layouts without a duplicate mobile
 * tree that would double every testid.
 */
function Figure({
  label,
  align = "right",
  children,
  style,
}: {
  label: string;
  align?: "left" | "right";
  children: React.ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div
      className="ws-figure flex items-center justify-between gap-3"
      style={{ ...CELL, ...RULE, ...(align === "right" ? R : null), ...style }}
    >
      <span style={{ ...overline, color: "var(--ink-subtle)" }} className="ws-figure-label">
        {label}
      </span>
      <span>{children}</span>
    </div>
  );
}

/** A ruled band inside the worksheet — deliberately not a nested card. */
export function GroupRow({ label, note }: { label: string; note?: string }) {
  return (
    <div
      className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5"
      style={{
        gridColumn: "1 / -1",
        padding: "6px 12px",
        minHeight: 30,
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
  discount,
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
  /** Order-level discount, surfaced so Subtotal+Shipping+Tax−Discount == Revenue. */
  discount: number;
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
      <div
        data-testid="worksheet"
        className="ws-grid"
        style={{ ["--ws-grid" as string]: GRID }}
      >
        <div style={HEAD} className={HEAD_CELL}>Item</div>
        <div style={{ ...HEAD, ...R }} className={HEAD_CELL}>Qty</div>
        <div style={{ ...HEAD, ...R }} className={HEAD_CELL}>Price</div>
        <div style={{ ...HEAD, ...R }} className={HEAD_CELL}>Revenue</div>
        <div style={{ ...HEAD, ...R }} className={HEAD_CELL}>Unit cost</div>
        <div style={{ ...HEAD, ...R }} className={HEAD_CELL}>Cost</div>
        <div style={HEAD} className={HEAD_CELL} />

        {/* ── Line items ── */}
        <GroupRow label="Line items" />
        {rows.length === 0 && (
          <div
          className="flex items-center justify-end"
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
          <div key={row.id} className={ROW} style={{ borderBottom: "1px solid var(--hairline)" }}>
            <div
              className="flex flex-col items-start justify-center gap-px"
              style={{ ...CELL, ...RULE, padding: "8px 12px" }}
            >
              <span style={{ color: "var(--ink)" }}>{row.title}</span>
              <span
                style={{ ...mono, fontSize: "var(--fs-overline)", color: "var(--ink-subtle)" }}
              >
                {row.sku || "no sku"}
                {row.variantTitle ? ` · ${row.variantTitle}` : ""}
              </span>
            </div>
            <Figure label="Qty" style={{ ...mono, color: "var(--ink-muted)" }}>
              {row.qty}
            </Figure>
            <Figure label="Price" style={mono}>{money(row.price)}</Figure>
            <Figure label="Revenue" style={mono}>{money(row.price * row.qty)}</Figure>
            <Figure label="Unit cost">
              <CostCell row={row} />
            </Figure>
            <Figure label="Cost">
              {row.linked && row.hasRecipe ? (
                <span style={mono}>{money(row.unitCost * row.qty)}</span>
              ) : (
                <span style={dash}>—</span>
              )}
            </Figure>
            <div className="ws-headcell" style={{ ...CELL, ...RULE }} />
          </div>
        ))}

        {/* ── Order components ── */}
        <GroupRow label="Order components" note="packaging and per-order materials" />
        {order.order_components.length === 0 && (
          <div
          className="flex items-center justify-end"
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
          <div key={oc.id} className={ROW} style={{ borderBottom: "1px solid var(--hairline)" }}>
            <div style={{ ...CELL, ...RULE }} className="flex items-center">{oc.components?.name || "Unknown"}</div>
            <Figure label="Qty" style={{ ...mono, color: "var(--ink-muted)" }}>
              {oc.quantity}
            </Figure>
            <div className={HEAD_CELL} style={CELL} />
            <div className={HEAD_CELL} style={CELL} />
            <Figure label="Unit cost" style={{ ...mono, color: "var(--ink-muted)" }}>
              {money(oc.components?.cost_per_unit || 0)}
            </Figure>
            <Figure label="Cost" style={mono}>
              {money((oc.components?.cost_per_unit || 0) * oc.quantity)}
            </Figure>
            <div className="flex items-center" style={{ ...CELL, ...RULE, padding: "0 4px" }}>
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
          className="flex items-center justify-end"
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
          <div key={cc.id} className={ROW} style={{ borderBottom: "1px solid var(--hairline)" }}>
            <div style={{ ...CELL, ...RULE }} className="flex items-center">{cc.description}</div>
            <div className={HEAD_CELL} style={CELL} />
            <div className={HEAD_CELL} style={CELL} />
            <div className={HEAD_CELL} style={CELL} />
            <div className={HEAD_CELL} style={CELL} />
            <Figure label="Cost" style={mono}>{money(cc.amount)}</Figure>
            <div className="flex items-center" style={{ ...CELL, ...RULE, padding: "0 4px" }}>
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

        {/* ── Processing fee ──
            Its own group, not a custom-cost row: those are operator-entered
            and removable, this is synced from Shopify and is neither. It must
            be VISIBLE here because the Cost column reconciles to the COGS
            figure below, which now includes it (lib/orders/cogs.ts). */}
        <GroupRow label="Processing fee" note="synced from Shopify — not editable" />
        <div className={ROW} style={{ borderBottom: "1px solid var(--hairline)" }}>
          <div style={{ ...CELL, ...RULE }} className="flex items-center">
            {order.processing_fee_source === "estimated"
              ? "Shopify Payments (estimated at plan rate)"
              : "Shopify Payments"}
          </div>
          <div className={HEAD_CELL} style={CELL} />
          <div className={HEAD_CELL} style={CELL} />
          <div className={HEAD_CELL} style={CELL} />
          <div className={HEAD_CELL} style={CELL} />
          <Figure label="Cost" style={mono}>
            {order.total_processing_fee == null ? (
              <span
                data-testid="detail-processing-fee"
                data-state="unknown"
                style={{ color: "var(--ink-subtle)" }}
                title="Fee unknown — the next sync of this order fetches it from Shopify."
              >
                not synced
              </span>
            ) : (
              <span
                data-testid="detail-processing-fee"
                data-state={order.processing_fee_source === "estimated" ? "estimated" : "actual"}
                title={
                  order.processing_fee_source === "estimated"
                    ? "Estimated at the plan rate (2.9% + 30¢) — Shopify reported no fee data for this order."
                    : undefined
                }
              >
                {order.processing_fee_source === "estimated" ? "~" : ""}
                {money(order.total_processing_fee)}
              </span>
            )}
          </Figure>
          <div style={{ ...CELL, ...RULE }} />
        </div>

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
            // Only when there is one — an always-present "$0.00 Discount" row
            // is noise, and its absence is meaningful.
            ...(discount !== 0 ? ([["Discount", -discount]] as const) : []),
          ] as const
        ).map(([label, value]) => (
          <div key={label} className="ws-row-2 gap-x-3">
            <div
              className="ws-span-label flex items-center justify-end"
              style={{ ...CELL, minHeight: 28, ...sans, color: "var(--ink-muted)" }}
            >
              {label}
            </div>
            <div
              className="flex items-center justify-end"
              style={{ ...CELL, minHeight: 28, ...mono, color: "var(--ink-muted)" }}
            >
              {money(value || 0)}
            </div>
            <div className="ws-span-tail" />
          </div>
        ))}

        {/* The span is a CLASS, not an inline style. An inline `grid-column:
            1 / 4` forces the grid to create three tracks at EVERY width, so the
            stacked layout silently kept a three-column skeleton and the totals
            rendered on top of each other. */}
        <div className="ws-row-2 gap-x-3">
        <div
          className="ws-span-label flex items-center justify-end"
          style={{
            ...CELL,
            ...overline,
            color: "var(--ink-muted)",
            borderTop: "1px solid var(--hairline)",
          }}
        >
          Revenue
        </div>
        <div
          className="flex items-center justify-end"
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
          className="flex items-center justify-end"
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
        <div className="flex items-center justify-end" style={{ ...CELL, ...R, borderTop: "1px solid var(--hairline)" }}>
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
        </div>
        <div className="ws-headcell" style={{ borderTop: "1px solid var(--hairline)" }} />

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

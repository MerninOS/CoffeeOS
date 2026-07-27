"use client";

import React from "react";
import Link from "next/link";
import { format } from "date-fns";
import { ChevronRight, Truck, ExternalLink } from "lucide-react";
import { Badge, type BadgeProps } from "@merninos/ui/instrument";
import { needsCogs } from "@/lib/orders/cogs";
import { ExpandedOrder, type OrderExpandedContentProps } from "./ExpandedOrder";
import { mono, overline, money } from "./tokens";
import type { Order } from "./types";

/**
 * The orders worksheet — ONE rendering, edge to edge, 40px ruled rows, sunken
 * header, no zebra.
 *
 * The `md:hidden` duplicate mobile card list is gone (spec Criterion 11). What
 * replaces it is this same markup restacking: the row is a flex column of three
 * groups, and each group becomes `display: contents` above the breakpoint so its
 * children turn into direct children of the row's grid. One DOM, one set of
 * `data-testid`s, two layouts — which is why `order-row` and `row-cogs` are now
 * visible on mobile too, where they used to be present-but-hidden.
 *
 * THE BREAKPOINT IS 1180px, NOT the design system's `--bp-compact` (900px).
 * That was measured, not reasoned: the nav rail is a fixed 236px, so a 1024px
 * window leaves 740px of canvas while the eight money/identity columns need
 * ~712px before Status gets anything at all. At 1024 the status track collapsed
 * to nothing and the badges spilled across the rows beneath them. 1180 is the
 * width at which Status still gets ~180px — enough for two badges on one line.
 * Below it the stacked block is what renders, which is a perfectly good layout
 * at 900px, just not a table one.
 *
 * `ready_to_ship` moved INTO the status cell rather than keeping its own column,
 * for the same reason: it is a status, its old column spent 76px to render "—"
 * on every uncosted row, and those 76px are what Status needed.
 *
 * Built by hand rather than with <DataTable> because DataTable has no row
 * expansion, and the expanded COGS editor is the entire point of this page.
 *
 * TAILWIND IS LAYOUT ONLY here — grid templates, spans, and the breakpoint at
 * which padding changes. Every colour, border, radius and type value is read as
 * `var(--token)` through an inline style: the Tailwind theme in this repo is the
 * loud Mernin' palette and would silently render the wrong design system.
 */

type OrdersWorksheetTableProps = Omit<OrderExpandedContentProps, "order"> & {
  filteredOrders: Order[];
  expandedOrders: Set<string>;
  toggleOrderExpanded: (orderId: string) => void;
  getOrderCogs: (order: Order) => number;
};

/**
 * Loud-palette status colours mapped onto instrument's semantic tones — the same
 * mechanical colour → meaning map the dashboard conversion used, so this stays a
 * re-skin rather than a re-interpretation.
 *   matcha → success   sun → warning   tomato → danger   sky → info   fog → neutral
 */
const FINANCIAL_TONE: Record<string, NonNullable<BadgeProps["tone"]>> = {
  paid: "success",
  pending: "warning",
  refunded: "danger",
  partially_refunded: "danger",
};

const FULFILLMENT_TONE: Record<string, NonNullable<BadgeProps["tone"]>> = {
  fulfilled: "success",
  unfulfilled: "warning",
  partially_fulfilled: "info",
};

/**
 * Shopify leaves `fulfillment_status` null for an unfulfilled order, so this is
 * reached with null against real data — it once threw "Cannot read properties of
 * null" and took the whole page down. The fallback is preserved verbatim.
 */
function StatusBadge({
  status,
  type,
}: {
  status: string | null;
  type: "financial" | "fulfillment";
}) {
  const label = status ?? (type === "fulfillment" ? "unfulfilled" : "unknown");
  const map = type === "financial" ? FINANCIAL_TONE : FULFILLMENT_TONE;
  return <Badge tone={map[label.toLowerCase()] ?? "neutral"}>{label.replace(/_/g, " ")}</Badge>;
}

/** Desktop track widths. Below --bp-compact the row is a flex column instead and
 *  this is inert. */
const GRID = "32px 96px 124px minmax(0,1fr) 108px 108px 108px 92px 44px";

/** A worksheet cell. Padding and the 40px row height are Tailwind because they
 *  change at the breakpoint; everything visual is inline. */
const CELL = "flex items-center px-3 min-[1180px]:h-10";
const CELL_R = `${CELL} min-[1180px]:justify-end`;
/** The chevron gutter is 32px wide — CELL's 12px of side padding would leave no
 *  room for a 15px glyph, so it gets its own. */
const CELL_GUTTER = "flex items-center pl-2 min-[1180px]:h-10";

/** Figure cells carry their own label, shown only in the stacked layout — that is
 *  what makes one rendering serve both without duplicating the values. */
function Figure({
  label,
  children,
  testId,
}: {
  label: string;
  children: React.ReactNode;
  testId?: string;
}) {
  return (
    <div className={`${CELL_R} flex-col items-start gap-0.5 min-[1180px]:flex-row min-[1180px]:items-center min-[1180px]:gap-0`}>
      <span style={overline} className="min-[1180px]:hidden">
        {label}
      </span>
      <span data-testid={testId}>{children}</span>
    </div>
  );
}

export function OrdersWorksheetTable({
  filteredOrders,
  expandedOrders,
  toggleOrderExpanded,
  getOrderCogs,
  ...expandedProps
}: OrdersWorksheetTableProps) {
  const { productCogsMap } = expandedProps;

  const head: React.CSSProperties = {
    ...overline,
    background: "var(--surface-sunken)",
    borderBottom: "1px solid var(--hairline-strong)",
  };

  return (
    <div
      style={{
        border: "1px solid var(--hairline)",
        borderRadius: "var(--r-md)",
        background: "var(--surface)",
      }}
    >
      {/* Column labels. Hidden in the stacked layout, where each figure carries
          its own label instead. Sticky under the app shell's top bar. */}
      <div
        className="hidden min-[1180px]:grid sticky"
        style={{
          gridTemplateColumns: GRID,
          top: "var(--topbar-h)",
          zIndex: 2,
          borderRadius: "var(--r-md) var(--r-md) 0 0",
          overflow: "hidden",
        }}
      >
        <div className={CELL_GUTTER} style={{ ...head, height: 34 }} />
        <div className={CELL} style={{ ...head, height: 34 }}>Order</div>
        <div className={CELL} style={{ ...head, height: 34 }}>Date</div>
        <div className={CELL} style={{ ...head, height: 34 }}>Status</div>
        <div className={CELL_R} style={{ ...head, height: 34 }}>Revenue</div>
        <div className={CELL_R} style={{ ...head, height: 34 }}>COGS</div>
        <div className={CELL_R} style={{ ...head, height: 34 }}>Profit</div>
        <div className={CELL_R} style={{ ...head, height: 34 }}>Margin</div>
        <div className={CELL} style={{ ...head, height: 34 }} />
      </div>

      {filteredOrders.map((order, i) => {
        const revenue = order.total_price || 0;
        const cogs = getOrderCogs(order);
        const profit = revenue - cogs;
        const margin = revenue > 0 ? ((revenue - cogs) / revenue) * 100 : 0;
        const isExpanded = expandedOrders.has(order.id);

        // The whole point of the page: nothing in this order resolves to a
        // product COGS, so its margin is revenue-only and reads as better than
        // it is. Red marks it — this is the live register, not decoration.
        const missing = needsCogs(order, productCogsMap);
        const last = i === filteredOrders.length - 1;

        return (
          <React.Fragment key={order.id}>
            <div
              data-testid="order-row"
              onClick={() => toggleOrderExpanded(order.id)}
              className="flex flex-col gap-2 py-3 min-[1180px]:grid min-[1180px]:gap-0 min-[1180px]:py-0 min-[1180px]:items-center"
              style={{
                gridTemplateColumns: GRID,
                cursor: "pointer",
                fontFamily: "var(--font-sans)",
                fontSize: "var(--fs-body)",
                color: "var(--ink)",
                background: isExpanded ? "var(--surface-hover)" : "transparent",
                borderBottom:
                  !last || isExpanded ? "1px solid var(--hairline)" : "none",
              }}
            >
              {/* Identity. `contents` above the breakpoint flattens these three
                  into the row's own grid tracks. */}
              <div className="flex items-center min-[1180px]:contents">
                <div className={CELL_GUTTER} style={{ color: "var(--ink-subtle)" }}>
                  <ChevronRight
                    size={15}
                    strokeWidth={1.5}
                    style={{
                      transform: isExpanded ? "rotate(90deg)" : "none",
                      transition: "transform var(--motion)",
                    }}
                  />
                </div>
                <div className={CELL} style={mono}>{order.order_name}</div>
                <div
                  className={CELL}
                  style={{ ...mono, fontSize: "var(--fs-caption)", color: "var(--ink-muted)" }}
                >
                  {order.created_at_shopify
                    ? format(new Date(order.created_at_shopify), "MMM d, yyyy")
                    : "—"}
                </div>
                <Link
                  href={`/orders/${order.id}`}
                  onClick={(e) => e.stopPropagation()}
                  aria-label={`Open ${order.order_name}`}
                  // Stacked, this sits at the top right of the block. Flattened
                  // into the grid it must be the LAST track, not the fourth —
                  // `order` is what re-sequences an auto-placed grid item.
                  className={`${CELL} ml-auto min-[1180px]:ml-0 min-[1180px]:order-last`}
                  style={{ color: "var(--ink-subtle)" }}
                >
                  <ExternalLink size={14} strokeWidth={1.5} />
                </Link>
              </div>

              {/* Status, including ready-to-ship — it is a status, and its own
                  column spent 76px rendering "—" on nearly every row. */}
              <div className={`${CELL} gap-1.5 flex-wrap`}>
                <StatusBadge status={order.financial_status} type="financial" />
                <StatusBadge status={order.fulfillment_status} type="fulfillment" />
                {order.ready_to_ship && (
                  <Badge tone="success">
                    <Truck size={10} strokeWidth={2} style={{ marginRight: 4 }} />
                    Ready
                  </Badge>
                )}
              </div>

              {/* The four figures. 2×2 stacked, 4-up on a wide phone/tablet, one
                  line above the breakpoint. */}
              <div className="grid grid-cols-2 gap-y-2 sm:grid-cols-4 min-[1180px]:contents">
                <Figure label="Revenue" testId="row-revenue">
                  <span style={mono}>{money(revenue)}</span>
                </Figure>
                <Figure label="COGS" testId="row-cogs">
                  {/*
                    `not set` replaces the figure ONLY when there is genuinely
                    nothing costed. The mock showed it whenever product COGS was
                    missing, but an order can have components and custom costs
                    while its products are uncosted — printing "not set" over a
                    real $22.00 would be a lie, and `row-cogs` is the element
                    orders-capabilities.spec.ts asserts an exact dollar delta
                    against. So: no cost at all → "not set"; some cost but no
                    product COGS → the figure, in danger.
                  */}
                  <span style={{ ...mono, color: missing ? "var(--danger)" : "var(--ink)" }}>
                    {missing && cogs === 0 ? "not set" : money(cogs)}
                  </span>
                </Figure>
                <Figure label="Profit">
                  <span style={mono}>{money(profit)}</span>
                </Figure>
                <Figure label="Margin">
                  <span style={{ ...mono, color: missing ? "var(--danger)" : "var(--ink)" }}>
                    {margin.toFixed(1)}%
                  </span>
                </Figure>
              </div>
            </div>

            {isExpanded && (
              <ExpandedOrder order={order} {...expandedProps} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

"use client";

import Link from "next/link";
import Image from "next/image";
import { Badge, IconButton } from "@merninos/ui/instrument";
import { Trash2 } from "lucide-react";
import { mono, overline, money } from "@/lib/instrument/tokens";
import { calcMargin } from "./margin";
import type { Product } from "./types";

/**
 * The /products worksheet — ONE rendering, both viewports (CoffeeOS#69
 * Criterion 21). Replaces ProductsTable + ProductsMobileList, which were a
 * complete duplicate of each other.
 *
 * WHY THIS IS HAND-ROLLED RATHER THAN instrument's `DataTable`
 *
 * The first version of this file DID use DataTable, on the reasoning that
 * — unlike /orders — this table needs no row expansion. That was true and
 * still missed the point: DataTable has no responsive mode. It wraps itself in
 * `overflow-x: auto`, so at 375px every money column sat off-screen and the
 * figures that are the entire reason for the screen were reachable only by
 * horizontal scrolling. Verified by screenshot, not assumed.
 *
 * That is precisely the failure `/orders` recorded when it declined DataTable:
 * "desktop-only baselines are how a completely broken mobile layout shipped."
 * So this follows OrdersWorksheetTable's pattern instead — ONE DOM, two
 * layouts. Below the breakpoint a row is a stack of labelled figures; above it,
 * the same nodes flatten into grid tracks. No `md:hidden` duplicate.
 *
 * Instrument rules, none of them cosmetic:
 *  - values are `var(--token)` in inline styles, never Tailwind. The Tailwind
 *    theme here is the LOUD palette and would silently render the other design
 *    system inside the instrument shell. TAILWIND IS LAYOUT ONLY in this file —
 *    grid templates, spans, and the breakpoint at which the row reflows.
 *  - 40px rows, 34px sunken header, hairline rules, NO zebra.
 *  - `--brand` never fills a control.
 *
 * STILL ON THE OLD SEMANTICS, DELIBERATELY. `total_cogs` is whatever page.tsx
 * computed — still `productCogs[id] || averageVariantCogs` — so `—` continues
 * to mean "no recipe", "$0 recipe" and "no price" indistinguishably, and
 * disagreeing variants are still averaged into one plausible number. On the
 * seeded fixture that shows up as Sumatra reading $20.47, the mean of its two
 * variants' $11.30 and $29.64, a figure no invoice will ever use. Stage C swaps
 * the source to lib/products/costing.ts, which is when this column can say
 * `not set` (Criteria 1-4). Changing a number and a pixel in one commit is what
 * the staging exists to prevent.
 */

/** Product | Variants | Min price | Unit COGS | Margin | actions */
const GRID = "minmax(0,1fr) 88px 108px 116px 104px 44px";

/**
 * 900px, not /orders' 1180px: this table carries five columns to its eight, and
 * 900 is also `--bp-compact`, where AppShell swaps the 236px nav rail for a
 * drawer — so above the breakpoint the row always has the full canvas.
 */
const ROW = "flex flex-col min-[900px]:grid";
const CELL = "flex items-center px-3 py-1.5 min-[900px]:py-0 min-[900px]:h-10";
const CELL_R = `${CELL} justify-between min-[900px]:justify-end`;

const initials = (title: string) =>
  title
    .replace(/[^A-Za-z ]/g, "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("");

/** A figure that carries its own label, shown only when the row is stacked. */
function Figure({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={CELL_R}>
      <span style={overline} className="min-[900px]:hidden">
        {label}
      </span>
      {children}
    </div>
  );
}

export function ProductsWorksheetTable({
  products,
  onDelete,
}: {
  products: Product[];
  onDelete: (id: string) => void;
}) {
  const figure: React.CSSProperties = { ...mono, fontSize: "var(--fs-data)" };

  return (
    <div
      style={{
        border: "1px solid var(--hairline)",
        borderRadius: "var(--r-md)",
        overflow: "hidden",
        background: "var(--surface)",
      }}
    >
      {/* Header exists only where the row is a grid — a stacked row labels
          itself, so a header above it would say everything twice. */}
      <div
        className="hidden min-[900px]:grid"
        style={{
          gridTemplateColumns: GRID,
          ...overline,
          color: "var(--ink-muted)",
          background: "var(--surface-sunken)",
          borderBottom: "1px solid var(--hairline-strong)",
        }}
      >
        <div className="flex items-center px-3 h-[34px]">Product</div>
        <div className="flex items-center justify-end px-3 h-[34px]">Variants</div>
        <div className="flex items-center justify-end px-3 h-[34px]">Min price</div>
        <div className="flex items-center justify-end px-3 h-[34px]">Unit COGS</div>
        <div className="flex items-center justify-end px-3 h-[34px]">Margin</div>
        <div className="h-[34px]" />
      </div>

      {products.map((p, i) => {
        const margin = p.average_margin ?? calcMargin(p.price, p.total_cogs);
        const tone = margin === null ? null : margin >= 30 ? "success" : margin >= 15 ? "warning" : "danger";
        return (
          <div
            key={p.id}
            // py-2 only while stacked. Above the breakpoint the row must be
            // exactly 40px — the design system's row metric — and the cells'
            // own `h-10` provides it, so extra row padding would break it.
            className={`${ROW} py-2 min-[900px]:py-0`}
            style={{
              gridTemplateColumns: GRID,
              fontFamily: "var(--font-sans)",
              fontSize: "var(--fs-body)",
              color: "var(--ink)",
              borderBottom: i < products.length - 1 ? "1px solid var(--hairline)" : "none",
            }}
          >
            <div className={`${CELL} min-w-0`}>
              <Link
                href={`/products/${p.id}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  minWidth: 0,
                  textDecoration: "none",
                  color: "var(--ink)",
                }}
              >
                {p.image_url ? (
                  <Image
                    src={p.image_url}
                    alt={p.title}
                    width={26}
                    height={26}
                    style={{
                      flex: "0 0 26px",
                      borderRadius: "var(--r-sm)",
                      border: "1px solid var(--hairline)",
                      objectFit: "cover",
                    }}
                  />
                ) : (
                  // An EMPTY bordered square reads as an unchecked checkbox at
                  // this size — it did, in the first render of this table.
                  <span
                    aria-hidden="true"
                    style={{
                      width: 26,
                      height: 26,
                      flex: "0 0 26px",
                      borderRadius: "var(--r-sm)",
                      background: "var(--surface-sunken)",
                      border: "1px solid var(--hairline)",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      ...mono,
                      fontSize: 9,
                      color: "var(--ink-subtle)",
                    }}
                  >
                    {initials(p.title)}
                  </span>
                )}
                <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.3, minWidth: 0 }}>
                  <span
                    style={{
                      fontWeight: 500,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {p.title}
                  </span>
                  <span style={{ ...mono, fontSize: "var(--fs-overline)", color: "var(--ink-subtle)" }}>
                    {p.sku || "—"}
                  </span>
                </span>
              </Link>
            </div>

            <Figure label="Variants">
              <span style={figure}>{p.variants?.length ?? 0}</span>
            </Figure>

            <Figure label="Min price">
              <span style={figure}>
                {p.min_selling_price != null ? money(p.min_selling_price) : "—"}
              </span>
            </Figure>

            <Figure label="Unit COGS">
              <span style={figure} data-testid="row-cogs">
                {p.total_cogs ? money(p.total_cogs) : "—"}
              </span>
            </Figure>

            <Figure label="Margin">
              {margin === null ? (
                <span style={{ ...figure, color: "var(--ink-subtle)" }}>—</span>
              ) : (
                <Badge tone={tone!} variant="soft" mono>
                  {margin.toFixed(1)}%
                </Badge>
              )}
            </Figure>

            <div className={`${CELL} justify-end min-[900px]:justify-center`}>
              <IconButton
                size="sm"
                icon={<Trash2 size={14} strokeWidth={2} />}
                aria-label={`Delete ${p.title}`}
                onClick={() => onDelete(p.id)}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

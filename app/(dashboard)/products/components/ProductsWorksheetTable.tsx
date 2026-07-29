"use client";

import Link from "next/link";
import Image from "next/image";
import { Badge, IconButton } from "@merninos/ui/instrument";
import { Trash2 } from "lucide-react";
import { mono, overline, money } from "@/lib/instrument/tokens";
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
 * THE THREE-STATE CONTRACT (Criteria 1-4). page.tsx resolves costing through
 * lib/products/costing.ts, the same module /orders uses, so this column means:
 *
 *   has_recipe && cogs > 0   ->  the figure, in --ink
 *   has_recipe && cogs === 0 ->  $0.00 in --ink. A product costed entirely from
 *                                zero-cost components IS costed; testing
 *                                `cogs > 0` would tell the operator forever to
 *                                add components they already added
 *   !has_recipe              ->  `not set` in --danger — not knowable, which is
 *                                a different statement from "zero"
 *
 * Margin is withheld as `—` in --ink-subtle rather than reddened: it is wholly
 * derived from the missing number, so a figure would be invented, not uncertain.
 */

/** Product | Cost basis | Variants | Min price | Unit COGS | Margin | actions */
const GRID = "minmax(0,1fr) 148px 80px 104px 112px 100px 44px";

/**
 * 1000px, not /orders' 1180px: this table carries six columns to its eight.
 * (An earlier revision said 900 and cited `--bp-compact`; the classes below are
 * the truth, and the cost-basis column is what pushed it up.)
 */
const ROW = "flex flex-col min-[1000px]:grid";
const CELL = "flex items-center px-3 py-1.5 min-[1000px]:py-0 min-[1000px]:h-10";
const CELL_R = `${CELL} justify-between min-[1000px]:justify-end`;

/**
 * `both` is the only tone that is not neutral: a product carrying BOTH a
 * product-level and a variant-level recipe has one of them silently ignored by
 * /orders costing, which is a thing the operator should be told about. The
 * other three are statements of fact, not warnings.
 *
 * Badge drops unknown props, so the test id goes on a wrapping span — the same
 * trap that ate three seams already in this ticket.
 */
const BASIS_LABEL: Record<string, string> = {
  product: "Product recipe",
  variant: "Per variant",
  both: "Both — conflict",
  none: "None",
};

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
      <span style={overline} className="min-[1000px]:hidden">
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
        className="hidden min-[1000px]:grid"
        style={{
          gridTemplateColumns: GRID,
          ...overline,
          color: "var(--ink-muted)",
          background: "var(--surface-sunken)",
          borderBottom: "1px solid var(--hairline-strong)",
        }}
      >
        <div className="flex items-center px-3 h-[34px]">Product</div>
        <div className="flex items-center px-3 h-[34px]">Cost basis</div>
        <div className="flex items-center justify-end px-3 h-[34px]">Variants</div>
        <div className="flex items-center justify-end px-3 h-[34px]">Min price</div>
        <div className="flex items-center justify-end px-3 h-[34px]">Unit COGS</div>
        <div className="flex items-center justify-end px-3 h-[34px]">Margin</div>
        <div className="h-[34px]" />
      </div>

      {products.map((p, i) => {
        // page.tsx now derives this from the SAME price this row displays and
        // the classifier's cost, so the Margin and Min price columns can no
        // longer disagree — they used to, whenever a variant was priced below
        // `products.price`.
        const margin = p.average_margin ?? null;
        const tone = margin === null ? null : margin >= 30 ? "success" : margin >= 15 ? "warning" : "danger";
        return (
          <div
            key={p.id}
            // py-2 only while stacked. Above the breakpoint the row must be
            // exactly 40px — the design system's row metric — and the cells'
            // own `h-10` provides it, so extra row padding would break it.
            className={`${ROW} py-2 min-[1000px]:py-0`}
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

            <div className={CELL_R}>
              <span style={overline} className="min-[1000px]:hidden">
                Cost basis
              </span>
              {p.cost_basis === "none" ? (
                <span style={{ ...figure, color: "var(--danger)" }} data-testid="row-basis">
                  not set
                </span>
              ) : (
                <span data-testid="row-basis">
                  <Badge tone={p.cost_basis === "both" ? "warning" : "neutral"} variant="soft">
                    {BASIS_LABEL[p.cost_basis ?? "none"]}
                  </Badge>
                </span>
              )}
            </div>

            <Figure label="Variants">
              <span style={figure}>{p.variants?.length ?? 0}</span>
            </Figure>

            <Figure label="Min price">
              <span style={figure}>
                {p.min_selling_price != null ? money(p.min_selling_price) : "—"}
              </span>
            </Figure>

            {/* THE VOCABULARY, matching /orders exactly:
                  --ink        a real figure
                  --danger     `not set` — the cost is not knowable
                A product costed at exactly $0 shows $0.00 in --ink, because it
                HAS a recipe. `null` here means unknowable and nothing else. */}
            <Figure label="Unit COGS">
              {p.has_recipe ? (
                <span style={figure} data-testid="row-cogs">
                  {money(p.total_cogs ?? 0)}
                </span>
              ) : (
                <span style={{ ...figure, color: "var(--danger)" }} data-testid="row-cogs">
                  not set
                </span>
              )}
            </Figure>

            {/* Withheld, never reddened. Profit and margin are wholly derived
                from the number that is missing, so a figure here would not be
                "uncertain", it would be invented. Red says "be careful"; an em
                dash says "we do not know", which is the true statement. */}
            <Figure label="Margin">
              {margin === null ? (
                <span style={{ ...figure, color: "var(--ink-subtle)" }} data-testid="row-margin">
                  —
                </span>
              ) : (
                <Badge tone={tone!} variant="soft" mono>
                  {margin.toFixed(1)}%
                </Badge>
              )}
            </Figure>

            <div className={`${CELL} justify-end min-[1000px]:justify-center`}>
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

"use client";

import { Badge, IconButton } from "@merninos/ui/instrument";
import { Edit, Scale, Trash2 } from "lucide-react";
import { mono, overline, sans, money } from "@/lib/instrument/tokens";
import { gramsToLbs } from "@/lib/inventory/units";
import { lotValue, stockState } from "@/lib/inventory/valuation";
import { Depletion } from "./Depletion";
import type { CoffeeInventory } from "./types";

/**
 * The green inventory worksheet — ONE rendering, both viewports.
 *
 * Replaces the desktop table AND the `md:hidden` card list, which were a
 * complete duplicate of each other down to a second totals block. Keeping both
 * is what let spec Criterion 12's totals bug survive: the fix had to be made
 * twice, so it was made zero times.
 *
 * HAND-ROLLED RATHER THAN instrument's `DataTable`, for the reason
 * `ProductsWorksheetTable` records: DataTable has no responsive mode. It wraps
 * itself in `overflow-x: auto`, so on a narrow screen the money columns — the
 * entire point of the screen — sit off-screen behind a horizontal scroll. This
 * table carries nine tracks to /products' seven, so it would be worse here.
 * Below the breakpoint a row becomes a stack of labelled figures; above it the
 * same nodes flatten into grid tracks. No duplicate DOM.
 *
 * Instrument rules, none cosmetic:
 *  - every value is `var(--token)` in an inline style, never a Tailwind class.
 *    This repo's Tailwind theme is the LOUD palette and would silently render
 *    the other design system inside the instrument shell. TAILWIND IS LAYOUT
 *    ONLY here — grid templates, spans, and the reflow breakpoint.
 *  - 40px rows, 34px sunken header, hairline rules, NO zebra.
 *  - `--brand` never fills a control; row actions are ink.
 *
 * THE FIGURE FORMATS ARE UNCHANGED from the loud version ("35.0 lbs",
 * "$979.44"). The Stage 1 capability tests assert those exact strings, and a
 * restyle should not need to edit the tests that prove it preserved behaviour.
 */

/**
 * 1180px, matching /orders rather than /products' 1000: nine tracks, and the
 * lot code and purchase date are both mono, which does not compress.
 */
const GRID = "minmax(0,1fr) 132px 116px 116px 76px 116px 104px 104px 84px";
const ROW = "flex flex-col min-[1180px]:grid";
const CELL = "flex items-center px-3 py-1.5 min-[1180px]:py-0 min-[1180px]:h-10";
const CELL_R = `${CELL} justify-between min-[1180px]:justify-end`;

/** A figure carrying its own label, shown only where the row is stacked. */
function Figure({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    // No test id here on purpose. This wrapper also holds the stacked-mode
    // label, and Playwright's toHaveText reads textContent INCLUDING nodes
    // hidden by CSS — an id here resolves to "Value$250.00". Ids go on the
    // figure span itself.
    <div className={CELL_R}>
      <span style={overline} className="min-[1180px]:hidden">
        {label}
      </span>
      {children}
    </div>
  );
}

/**
 * Out and low are stated; ok is silent.
 *
 * A badge on every row would make the lots needing attention no easier to find
 * than the ones that do not. `--warning` and neutral, never `--brand`: red is
 * the live register, and low stock is a standing condition rather than
 * something happening now.
 */
function StockBadge({ greenLbs }: { greenLbs: number }) {
  const state = stockState(greenLbs);
  if (state === "out") return <Badge tone="neutral">Out</Badge>;
  if (state === "low") return <Badge tone="warning">Low</Badge>;
  return null;
}

export function InventoryWorksheetTable({
  rows,
  totalGreenLbs,
  totalRoastedLbs,
  totalValue,
  onAdjust,
  onEdit,
  onDelete,
}: {
  rows: CoffeeInventory[];
  totalGreenLbs: number;
  totalRoastedLbs: number;
  totalValue: number;
  onAdjust: (coffee: CoffeeInventory) => void;
  onEdit: (coffee: CoffeeInventory) => void;
  onDelete: (id: string) => void;
}) {
  const figure: React.CSSProperties = {
    ...mono,
    fontSize: "var(--fs-data)",
    whiteSpace: "nowrap",
  };
  const caption: React.CSSProperties = {
    ...mono,
    fontSize: "var(--fs-caption)",
    color: "var(--ink-muted)",
    whiteSpace: "nowrap",
  };
  const dash = <span style={{ color: "var(--ink-subtle)" }}>—</span>;

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
        className="hidden min-[1180px]:grid"
        style={{
          gridTemplateColumns: GRID,
          ...overline,
          color: "var(--ink-muted)",
          whiteSpace: "nowrap",
          background: "var(--surface-sunken)",
          borderBottom: "1px solid var(--hairline-strong)",
        }}
      >
        <div className="flex items-center px-3 h-[34px]">Coffee</div>
        <div className="flex items-center px-3 h-[34px]">Lot</div>
        <div className="flex items-center px-3 h-[34px]">Supplier</div>
        <div className="flex items-center px-3 h-[34px]">Purchased</div>
        <div className="flex items-center justify-end px-3 h-[34px]">$ / lb</div>
        <div className="flex items-center justify-end px-3 h-[34px]">Green lb</div>
        <div className="flex items-center justify-end px-3 h-[34px]">Roasted lb</div>
        <div className="flex items-center justify-end px-3 h-[34px]">Value</div>
        <div className="h-[34px]" />
      </div>

      {rows.map((coffee) => {
        const greenLbs = gramsToLbs(coffee.current_green_quantity_g);
        const roastedLbs = gramsToLbs(coffee.roasted_stock_g || 0);
        return (
          <div
            key={coffee.id}
            data-testid="lot-row"
            data-lot-name={coffee.name}
            className={`${ROW} group`}
            style={{
              gridTemplateColumns: GRID,
              borderBottom: "1px solid var(--hairline)",
            }}
          >
            <div className={`${CELL} gap-2`}>
              <div className="flex flex-col min-w-0">
                <span
                  style={{
                    ...sans,
                    fontSize: "var(--fs-body)",
                    fontWeight: "var(--fw-medium)" as unknown as number,
                    color: "var(--ink)",
                  }}
                  className="truncate"
                >
                  {coffee.name}
                </span>
                <span style={overline}>{coffee.origin}</span>
              </div>
              <StockBadge greenLbs={greenLbs} />
            </div>

            {/* Newly surfaced: lot code and purchase date are selected today
                and rendered nowhere. `—` in --ink-subtle rather than an empty
                cell, which reads as a styling bug instead of a missing value
                (Criterion 8). */}
            <Figure label="Lot">
              <span style={caption}>{coffee.lot_code || dash}</span>
            </Figure>
            <Figure label="Supplier">
              <span
                style={{
                  ...sans,
                  fontSize: "var(--fs-body)",
                  color: "var(--ink-muted)",
                }}
                className="truncate"
              >
                {coffee.supplier || dash}
              </span>
            </Figure>
            <Figure label="Purchased">
              <span style={caption}>{coffee.purchase_date || dash}</span>
            </Figure>

            <Figure label="$ / lb">
              <span style={figure}>{money(coffee.price_per_lb)}</span>
            </Figure>
            <Figure label="Green lb">
              <Depletion
                greenLbs={greenLbs}
                initialLbs={gramsToLbs(coffee.initial_quantity_g)}
              />
            </Figure>
            <Figure label="Roasted lb">
              <span
                data-testid="lot-roasted"
                style={{
                  ...figure,
                  color: roastedLbs === 0 ? "var(--ink-subtle)" : "var(--ink)",
                }}
              >
                {roastedLbs.toFixed(1)} lbs
              </span>
            </Figure>
            <Figure label="Value">
              <span data-testid="lot-value" style={figure}>
                {money(lotValue(coffee))}
              </span>
            </Figure>

            {/* Revealed on hover where the row is a grid, always present where
                it is stacked — a touch device never fires hover and the actions
                would otherwise be unreachable. */}
            <div
              className={`${CELL} justify-end gap-1 min-[1180px]:opacity-0 min-[1180px]:group-hover:opacity-100 min-[1180px]:group-focus-within:opacity-100 transition-opacity`}
            >
              <IconButton
                size="sm"
                icon={<Scale size={15} strokeWidth={1.5} />}
                aria-label={`Adjust quantity for ${coffee.name}`}
                title="Adjust quantity"
                onClick={() => onAdjust(coffee)}
              />
              <IconButton
                size="sm"
                icon={<Edit size={15} strokeWidth={1.5} />}
                aria-label={`Edit ${coffee.name}`}
                title="Edit"
                onClick={() => onEdit(coffee)}
              />
              <IconButton
                size="sm"
                icon={<Trash2 size={15} strokeWidth={1.5} />}
                aria-label={`Delete ${coffee.name}`}
                title="Delete"
                onClick={() => onDelete(coffee.id)}
              />
            </div>
          </div>
        );
      })}

      {/* Totals over the ROWS PASSED IN — this is Criterion 12. The footer now
          totals what is on screen while the stat strip continues to describe the
          whole catalogue. Previously both read the catalogue and the footer sat
          under a filtered body, so a search left them disagreeing. */}
      <div
        className={ROW}
        style={{
          gridTemplateColumns: GRID,
          borderTop: "2px solid var(--ink)",
          background: "var(--surface-sunken)",
        }}
      >
        <div className={`${CELL} min-[1180px]:col-span-5 min-[1180px]:justify-end`}>
          <span style={overline}>Totals</span>
        </div>
        <Figure label="Green lb">
          <span data-testid="total-green" style={{ ...figure, fontWeight: 500 }}>
            {totalGreenLbs.toFixed(1)} lbs
          </span>
        </Figure>
        <Figure label="Roasted lb">
          <span data-testid="total-roasted" style={{ ...figure, fontWeight: 500 }}>
            {totalRoastedLbs.toFixed(1)} lbs
          </span>
        </Figure>
        <Figure label="Value">
          <span data-testid="total-value" style={{ ...figure, fontWeight: 500 }}>
            {money(totalValue)}
          </span>
        </Figure>
        <div className={CELL} />
      </div>
    </div>
  );
}

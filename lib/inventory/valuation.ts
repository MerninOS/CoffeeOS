/**
 * What a green coffee lot is worth, and whether it needs attention.
 *
 * Pure functions rather than expressions inline in the page, so the unit tests
 * and the UI share ONE implementation. A test that re-declares the rule passes
 * while the component drifts — the same failure `lib/orders/format.ts` was
 * extracted to prevent.
 *
 * Nothing here is COGS. Inventory price reaches product cost through *roasting*
 * (`price_per_lb` → a batch's `green_cost_per_g` → `components.cost_per_unit` →
 * a recipe), not through this page; `/inventory` only ever values stock on hand.
 * CoffeeOS#72 asked whether costing arithmetic lived in the client file, and
 * this module is the whole answer: unit conversion and stock valuation, nothing
 * that any other screen bills from.
 */

import { gramsToLbs } from "./units";

/**
 * The threshold below which a lot reads as low, in pounds.
 *
 * Was a bare `5` inline in the row renderer, compared with `greenLbs < 5 &&
 * greenLbs > 0`. Named here so the page can state the rule on screen next to
 * the filter that applies it, and so the boundary is testable rather than
 * re-typed. It is deliberately ONE GLOBAL NUMBER: a real par level per coffee
 * needs a new column, which CoffeeOS#72 explicitly does not add.
 */
export const LOW_STOCK_LB = 5;

/** A row carrying the three fields valuation needs. */
export interface ValuableLot {
  current_green_quantity_g: number;
  roasted_stock_g: number | null;
  price_per_lb: number;
}

export type StockState = "out" | "low" | "ok";

/**
 * The page's one judgement about a lot, from its GREEN pounds only.
 *
 * Roasted stock is deliberately not considered. A lot with 0 lb green and 8 lb
 * roasted is out of *green* — there is nothing left to roast — and calling it
 * stocked because roasted product exists would tell the operator the opposite
 * of what they need before a roast.
 *
 * The boundary is `< LOW_STOCK_LB`, so exactly 5.0 lb is `ok`. That matches the
 * behaviour being preserved (`greenLbs < 5`); moving it to `<=` would silently
 * reclassify every lot sitting on the threshold.
 */
export function stockState(greenLbs: number): StockState {
  if (greenLbs <= 0) return "out";
  if (greenLbs < LOW_STOCK_LB) return "low";
  return "ok";
}

/** Green pounds on hand for a lot. */
export function greenLbsOf(lot: ValuableLot): number {
  return gramsToLbs(lot.current_green_quantity_g);
}

/** Roasted pounds on hand. `roasted_stock_g` is nullable in the schema. */
export function roastedLbsOf(lot: ValuableLot): number {
  return gramsToLbs(lot.roasted_stock_g || 0);
}

/**
 * What the green in this lot cost, at its own purchase price.
 *
 * Roasted stock is excluded on purpose — its cost basis is the roast batch, not
 * this lot's `price_per_lb`, and adding the two would double-count coffee that
 * has already been deducted from green. The page labels this figure "green
 * coffee at cost" for that reason.
 */
export function lotValue(lot: ValuableLot): number {
  return greenLbsOf(lot) * lot.price_per_lb;
}

export interface InventoryTotals {
  greenLbs: number;
  roastedLbs: number;
  value: number;
}

/**
 * Totals over WHATEVER LIST IT IS GIVEN.
 *
 * The caller decides the scope, and that is the point. The page today computes
 * its totals over the whole catalogue and renders them inside the table whose
 * body maps the FILTERED list (`inventory-client.tsx`: totals from `inventory`,
 * rows from `filteredInventory`), so searching for one supplier leaves a footer
 * totalling every lot on screen-loads it isn't showing. Passing the list in
 * makes that a call site's choice rather than a hidden coupling: the stat strip
 * passes the catalogue, the footer passes the visible rows.
 *
 * Sums UNROUNDED per-lot figures and leaves formatting to the caller. Rounding
 * each lot first and then summing would make the total disagree with its own
 * rows by up to half a display unit each.
 */
export function totals(lots: ValuableLot[]): InventoryTotals {
  return lots.reduce<InventoryTotals>(
    (acc, lot) => ({
      greenLbs: acc.greenLbs + greenLbsOf(lot),
      roastedLbs: acc.roastedLbs + roastedLbsOf(lot),
      value: acc.value + lotValue(lot),
    }),
    { greenLbs: 0, roastedLbs: 0, value: 0 },
  );
}

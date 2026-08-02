import { test, expect } from '@playwright/test'
import { LBS_TO_GRAMS, gramsToLbs, lbsToGrams } from '../../lib/inventory/units'
import {
  LOW_STOCK_LB,
  greenLbsOf,
  roastedLbsOf,
  lotValue,
  stockState,
  totals,
  type ValuableLot,
} from '../../lib/inventory/valuation'

/**
 * Green inventory units and valuation, with no browser and no server — see
 * playwright.unit.config.ts.
 *
 * These exist so the figures on `/inventory` are provable without driving the
 * page. The e2e capability specs assert that a mutation MOVES a figure; these
 * assert the figure is right in the first place, including the cases a seeded
 * fixture rarely contains (a zero-price lot, a null roasted stock, a lot sitting
 * exactly on the low threshold).
 */

const lot = (overrides: Partial<ValuableLot> = {}): ValuableLot => ({
  current_green_quantity_g: 0,
  roasted_stock_g: 0,
  price_per_lb: 0,
  ...overrides,
})

/** Pounds → a lot holding exactly that much green. */
const lotOfLbs = (lbs: number, pricePerLb = 0): ValuableLot =>
  lot({ current_green_quantity_g: lbsToGrams(lbs), price_per_lb: pricePerLb })

test.describe('units', () => {
  test('converts both directions round-trip', () => {
    expect(gramsToLbs(LBS_TO_GRAMS)).toBeCloseTo(1, 10)
    expect(lbsToGrams(1)).toBeCloseTo(LBS_TO_GRAMS, 10)
    expect(gramsToLbs(lbsToGrams(37.4))).toBeCloseTo(37.4, 10)
  })

  test('gramsToLbs returns a NUMBER, not a formatted string', () => {
    // The /roasting copies return a pre-.toFixed(2) string, which cannot be
    // summed — a caller wanting a total either re-implements the division or
    // silently concatenates. This asserts the shape, not just the value.
    const result = gramsToLbs(4535.92)
    expect(typeof result).toBe('number')
    expect(result).toBeCloseTo(10, 6)
  })
})

test.describe('stockState', () => {
  test('classifies the boundary exactly', () => {
    // The rule being preserved is `greenLbs < 5 && greenLbs > 0`, so 5.0 is ok
    // and 0 is out. An off-by-one here silently re-flags every lot sitting on
    // the threshold, which is the whole population the rule exists to catch.
    expect(stockState(0)).toBe('out')
    expect(stockState(0.1)).toBe('low')
    expect(stockState(LOW_STOCK_LB - 0.1)).toBe('low')
    expect(stockState(LOW_STOCK_LB)).toBe('ok')
    expect(stockState(LOW_STOCK_LB + 0.1)).toBe('ok')
  })

  test('treats a negative quantity as out rather than low', () => {
    // Not reachable through the UI (adjustInventoryQuantity refuses to go
    // below zero) but reachable by a direct write. `< LOW_STOCK_LB` alone would
    // call a negative lot "low", i.e. report stock that does not exist.
    expect(stockState(-1)).toBe('out')
  })

  test('ignores roasted stock', () => {
    // A lot with no green and plenty roasted is out of GREEN — there is nothing
    // left to roast. Counting roasted here would tell the operator the opposite
    // of what they need before a roast.
    const roastedOnly = lot({ current_green_quantity_g: 0, roasted_stock_g: lbsToGrams(8) })
    expect(stockState(greenLbsOf(roastedOnly))).toBe('out')
    expect(roastedLbsOf(roastedOnly)).toBeCloseTo(8, 6)
  })
})

test.describe('lotValue', () => {
  test('values green at the lot price', () => {
    expect(lotValue(lotOfLbs(10, 6.85))).toBeCloseTo(68.5, 6)
  })

  test('a zero-stock lot is worth $0.00, not omitted', () => {
    // It still renders a row and still counts toward "lots tracked"; a value of
    // zero is a fact about it, not a reason to drop it.
    expect(lotValue(lotOfLbs(0, 8.9))).toBe(0)
  })

  test('a zero-price lot is worth $0.00 and is still counted', () => {
    // price_per_lb is NOT NULL in the schema but nothing enforces a positive
    // value, so a lot entered before its price is known reads 0. Distinguishing
    // "free" from "unpriced" would need a nullable column; this asserts the
    // figure is at least not invented.
    expect(lotValue(lotOfLbs(50, 0))).toBe(0)
  })

  test('excludes roasted stock from value', () => {
    // Roasted coffee's cost basis is the roast batch, not this lot's
    // price_per_lb, and it has already been deducted from green — adding it
    // would double-count.
    const withRoasted = lot({
      current_green_quantity_g: lbsToGrams(10),
      roasted_stock_g: lbsToGrams(40),
      price_per_lb: 5,
    })
    expect(lotValue(withRoasted)).toBeCloseTo(50, 6)
  })
})

test.describe('totals', () => {
  const catalogue: ValuableLot[] = [
    lot({ current_green_quantity_g: lbsToGrams(35), roasted_stock_g: lbsToGrams(9), price_per_lb: 6.8 }),
    lot({ current_green_quantity_g: lbsToGrams(26.9), roasted_stock_g: null, price_per_lb: 5.95 }),
    lot({ current_green_quantity_g: 0, roasted_stock_g: lbsToGrams(2), price_per_lb: 8.9 }),
  ]

  test('sums green, roasted and value across the list', () => {
    const t = totals(catalogue)
    expect(t.greenLbs).toBeCloseTo(61.9, 6)
    expect(t.roastedLbs).toBeCloseTo(11, 6)
    expect(t.value).toBeCloseTo(35 * 6.8 + 26.9 * 5.95, 6)
  })

  test('tolerates a null roasted_stock_g', () => {
    // Nullable in the schema; `null + number` is a silent NaN that would poison
    // the whole roasted total, not just one row.
    const t = totals([lot({ roasted_stock_g: null })])
    expect(Number.isNaN(t.roastedLbs)).toBe(false)
    expect(t.roastedLbs).toBe(0)
  })

  test('an empty list totals zero rather than NaN', () => {
    expect(totals([])).toEqual({ greenLbs: 0, roastedLbs: 0, value: 0 })
  })

  test('sums UNROUNDED figures, and that is observably different', () => {
    // Three lots that each round down at one decimal. Rounding per lot and then
    // summing loses ~0.12 lb — small, but it makes the footer disagree with the
    // rows it is a total of, which is exactly the class of defect this page
    // already has elsewhere. This asserts the two strategies differ, so the test
    // cannot pass if someone reintroduces round-then-sum.
    const lots = [lotOfLbs(1.04), lotOfLbs(1.04), lotOfLbs(1.04)]
    const roundedThenSummed = lots
      .map((l) => Number(greenLbsOf(l).toFixed(1)))
      .reduce((a, b) => a + b, 0)

    expect(totals(lots).greenLbs).toBeCloseTo(3.12, 6)
    expect(roundedThenSummed).toBeCloseTo(3.0, 6)
    expect(totals(lots).greenLbs).not.toBeCloseTo(roundedThenSummed, 2)
  })

  test('totals only what it is given', () => {
    // The caller chooses the scope: the stat strip passes the catalogue, the
    // footer passes the visible rows. This is what lets the page stop showing
    // catalogue totals over a filtered table.
    const visible = catalogue.slice(0, 1)
    expect(totals(visible).greenLbs).toBeCloseTo(35, 6)
    expect(totals(catalogue).greenLbs).toBeCloseTo(61.9, 6)
  })
})

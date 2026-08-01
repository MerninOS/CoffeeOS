import { test, expect } from '@playwright/test'
import { fmtCost, isUncosted, COST_NOT_SET } from '../../lib/components/format'

/**
 * The cost presentation rules for /components (CoffeeOS#73). No browser and no
 * server — see playwright.unit.config.ts.
 *
 * These assert EXACT strings rather than a shape. A loose assertion ("shorter
 * than toFixed(8)") would pass for any number of wrong rules, and the rule is
 * the point: this figure multiplies through product_components into every
 * product's cost and through order_components into every order's margin.
 */

test.describe('isUncosted', () => {
  // The schema decides this, not the renderer: cost_per_unit is
  // `numeric NOT NULL DEFAULT 0`, so 0 is the only reachable "missing" state.
  test('0 is uncosted', () => {
    expect(isUncosted({ cost_per_unit: 0 })).toBe(true)
  })

  test('the smallest real cost in the database is NOT uncosted', () => {
    // 0.0028 is the live minimum. If a future rule ever treated "very small" as
    // missing, this is the row it would wrongly flag.
    expect(isUncosted({ cost_per_unit: 0.0028 })).toBe(false)
  })

  test('a sub-four-decimal cost is NOT uncosted', () => {
    // The case fmtCost's extension exists for. Uncosted must be decided by the
    // VALUE, never by whether the formatted string looks like zero.
    expect(isUncosted({ cost_per_unit: 0.00004 })).toBe(false)
    expect(fmtCost(0.00004)).not.toBe('$0.0000')
  })
})

test.describe('fmtCost', () => {
  // Every value here except the last two is real data from the components table.
  const cases: Array<[number, string, string]> = [
    [27.55, '$27.55', 'live maximum — two decimals at or above a dollar'],
    [22, '$22.00', 'a whole-dollar labor rate still shows cents'],
    [6.5, '$6.50', 'green coffee per lb'],
    [1, '$1.00', 'exactly a dollar takes the two-decimal branch'],
    [0.42, '$0.4200', 'below a dollar — four decimals'],
    [0.0412, '$0.0412', 'oat milk per oz'],
    [0.032, '$0.0320', 'a trailing zero is kept so the column stays aligned'],
    [0.0028, '$0.0028', 'live minimum, and it survives four decimals'],
    [0.00004, '$0.000040', 'four would render $0.0000 — extends to six'],
    [0.0000004, '$0.00000040', 'six would still be zero — extends to eight'],
  ]

  for (const [value, expected, why] of cases) {
    test(`${value} -> ${expected} (${why})`, () => {
      expect(fmtCost(value)).toBe(expected)
    })
  }

  test('a formatted real cost always parses back to a non-zero number', () => {
    // The property the extension exists to guarantee. A rendering that reads as
    // zero for a component that costs something is indistinguishable from the
    // uncosted state, which is the bug this whole screen is about.
    for (const v of [0.0028, 0.00004, 0.0000004, 0.0412, 27.55]) {
      const parsed = Number(fmtCost(v).replace('$', ''))
      expect(parsed, `fmtCost(${v}) rendered as an apparent zero`).not.toBe(0)
    }
  })

  test('below 1e-8 it gives up rather than looping', () => {
    // Beyond the column's own precision. Documented so the eight-decimal cap is
    // a decision and not an accident: such a value cannot be represented, and
    // the alternative is an unbounded loop.
    expect(fmtCost(0.000000001)).toBe('$0.00000000')
  })

  test('a literal zero renders honestly, for a caller that chose to show it', () => {
    // Callers check isUncosted first; this is the fallback, not the uncosted
    // rendering. COST_NOT_SET is what the table shows instead.
    expect(fmtCost(0)).toBe('$0.00')
    expect(COST_NOT_SET).toBe('not set')
  })
})

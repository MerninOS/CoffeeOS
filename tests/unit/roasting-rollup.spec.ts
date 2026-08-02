import { test, expect } from '@playwright/test'
import { rollUpSessions } from '../../app/(dashboard)/roasting/rollup'
import { lb, lbs, G_PER_LB } from '../../app/(dashboard)/roasting/units'

/**
 * The roasting rollup and unit formatting, as pure functions.
 *
 * These are unit tests rather than e2e because the cases that matter most are
 * unreachable from the demo fixture: every seeded session has roasted weight, so
 * the divide-by-zero that renders "$Infinity" cannot be produced by clicking
 * around. A guard you cannot reach is a guard you cannot trust.
 *
 * Expected values are written out rather than computed from the functions under
 * test — importing the implementation to build the expectation would make these
 * agree with whatever the code happens to do, which is not an assertion.
 */

const s = (cost: number | null, green: number, roasted: number) => ({
  session_toll_cost: cost,
  total_green_weight_g: green,
  total_roasted_weight_g: roasted,
})

test.describe('rollUpSessions', () => {
  test('sums cost and weight across sessions', () => {
    const r = rollUpSessions([s(100, 10000, 8000), s(50, 5000, 4000)])
    expect(r.totalCost).toBe(150)
    expect(r.totalGreenG).toBe(15000)
    expect(r.totalRoastedG).toBe(12000)
  })

  test('cost per roasted lb divides cost by pounds', () => {
    // 4535.92 g is exactly 10 lb, so $50 is exactly $5.00/lb.
    const r = rollUpSessions([s(50, 5000, 4535.92)])
    expect(r.costPerRoastedLb).toBeCloseTo(5, 5)
  })

  test('zero roasted weight yields null, never Infinity', () => {
    const r = rollUpSessions([s(100, 10000, 0)])
    expect(r.costPerRoastedLb).toBeNull()
  })

  test('no sessions yields null, never NaN', () => {
    const r = rollUpSessions([])
    expect(r.costPerRoastedLb).toBeNull()
    expect(r.avgLossPercent).toBeNull()
    expect(r.totalCost).toBe(0)
  })

  test('sessions with a null cost are excluded, not coerced to zero', () => {
    // Coercing to 0 would put the unpriced session's roasted weight in the
    // denominator with no cost in the numerator, so cost/lb would fall the more
    // unpriced sessions existed — the metric would improve by losing data.
    const r = rollUpSessions([s(100, 5000, 4535.92), s(null, 5000, 4535.92)])
    expect(r.totalCost).toBe(100)
    expect(r.totalRoastedG).toBe(4535.92)
    expect(r.costPerRoastedLb).toBeCloseTo(10, 5)
  })

  test('average loss is derived from totals, not averaged per session', () => {
    // Losses are 200g of 1000g (20%) and 800g of 8000g (10%). Averaging those
    // per session gives 15%. Weighting by mass gives 1000/9000 = 11.11%, which
    // is the actual yield loss of the two sessions together — the small batch
    // should not count as much as the one six times its size.
    const r = rollUpSessions([s(1, 1000, 800), s(1, 8000, 7200)])
    expect(r.avgLossPercent).toBeCloseTo(11.111111, 4)
    expect(r.avgLossPercent).not.toBeCloseTo(15, 1)
  })

  test('zero green weight yields a null loss rather than NaN', () => {
    const r = rollUpSessions([s(10, 0, 0)])
    expect(r.avgLossPercent).toBeNull()
  })
})

test.describe('units', () => {
  test('grams convert to pounds at one decimal', () => {
    expect(G_PER_LB).toBe(453.592)
    expect(lb(453.592)).toBe('1.0')
    expect(lb(4535.92)).toBe('10.0')
    expect(lb(0)).toBe('0.0')
  })

  test('lbs attaches the unit', () => {
    expect(lbs(4535.92)).toBe('10.0 lb')
  })

  test('rounds rather than truncates', () => {
    // 0.96 lb must read 1.0, not 0.9 — a truncating implementation would show
    // 0.9 and quietly understate every weight on the surface.
    expect(lb(435)).toBe('1.0')
  })
})

import { test, expect } from '@playwright/test'
import {
  sessionCost,
  lossPercent,
  lossTone,
  LOSS_BAND,
  type SessionCostInput,
} from '../../app/(dashboard)/roasting/session-cost'

/**
 * The three billing modes, and the guarantee that the basis string describes
 * the figure it will be rendered beneath.
 *
 * Unit tests because the modes cannot be exercised from the demo fixture — it
 * seeds exactly one session, on toll roasting. Co-roasting and power usage have
 * never been rendered by any test, and power usage in particular produces
 * figures two orders of magnitude smaller than the others, which is precisely
 * the case an operator would read as a bug without the basis beside it.
 */

const base: SessionCostInput = {
  cost_mode: 'toll_roasting',
  setup_minutes: 20,
  cleanup_minutes: 15,
  billing_granularity_minutes: 15,
  rate_per_hour: 85,
  rate_per_lb: null,
  machine_energy_kwh_per_hour: null,
  kwh_rate: null,
  batches: [
    { roast_minutes: 14, green_weight_g: 5400 },
    { roast_minutes: 15, green_weight_g: 5200 },
  ],
}

test.describe('sessionCost — toll roasting', () => {
  test('matches the figure the page rendered before this module existed', () => {
    // The seeded session. 20 + (14+15) + 15 = 64 minutes, rounded up to 75 on
    // 15-minute billing, at $85/h. This exact value ($106.25) is what
    // /roasting?tab=sessions displays today, so the extraction is provably
    // behaviour-preserving.
    const r = sessionCost(base)
    expect(r.cost).toBeCloseTo(106.25, 5)
    expect(r.billableMinutes).toBe(75)
  })

  test('the basis describes the same arithmetic as the cost', () => {
    const r = sessionCost(base)
    expect(r.basis).toBe('1.3 h × $85.00')
    // The whole point of returning both together: the hours in the string are
    // the hours the money was computed from.
    expect(r.cost).toBeCloseTo((r.billableMinutes / 60) * 85, 5)
  })

  test('rounds billable minutes UP to the granularity, never down', () => {
    // 61 minutes on 15-minute billing is 75, not 60. Rounding down would
    // under-bill every session by up to a full granularity step.
    const r = sessionCost({
      ...base,
      setup_minutes: 0,
      cleanup_minutes: 0,
      batches: [{ roast_minutes: 61, green_weight_g: 0 }],
    })
    expect(r.billableMinutes).toBe(75)
  })

  test('a zero granularity does not produce Infinity', () => {
    const r = sessionCost({ ...base, billing_granularity_minutes: 0 })
    expect(Number.isFinite(r.cost)).toBe(true)
    expect(Number.isFinite(r.billableMinutes)).toBe(true)
  })
})

test.describe('sessionCost — co-roasting', () => {
  test('bills green pounds, not time', () => {
    // 10600 g = 23.37 lb at $1.10 = $25.70. Time is irrelevant to this mode,
    // so the basis must not mention hours.
    const r = sessionCost({ ...base, cost_mode: 'co_roasting', rate_per_lb: 1.1 })
    expect(r.cost).toBeCloseTo((10600 / 453.592) * 1.1, 5)
    expect(r.basis).toBe('23.4 lb × $1.10')
    expect(r.basis).not.toContain('h ×')
  })

  test('a null rate costs nothing rather than NaN', () => {
    const r = sessionCost({ ...base, cost_mode: 'co_roasting', rate_per_lb: null })
    expect(r.cost).toBe(0)
    expect(Number.isNaN(r.cost)).toBe(false)
  })
})

test.describe('sessionCost — power usage', () => {
  test('bills kWh at a three-decimal rate', () => {
    // 75 min = 1.25 h at 6.5 kWh/h = 8.125 kWh at $0.135 = $1.10. Two decimals
    // on the rate would render $0.14 and misstate the tariff by 4%.
    const r = sessionCost({
      ...base,
      cost_mode: 'power_usage',
      machine_energy_kwh_per_hour: 6.5,
      kwh_rate: 0.135,
    })
    expect(r.cost).toBeCloseTo(1.25 * 6.5 * 0.135, 5)
    expect(r.basis).toBe('8.1 kWh × $0.135')
  })

  test('produces a figure far smaller than the other modes — which is why the basis matters', () => {
    const power = sessionCost({
      ...base,
      cost_mode: 'power_usage',
      machine_energy_kwh_per_hour: 6.5,
      kwh_rate: 0.135,
    })
    const toll = sessionCost(base)
    // ~$1.10 against ~$106.25. Without the basis beside them these two read as
    // a data error rather than two billing models.
    expect(power.cost).toBeLessThan(toll.cost / 50)
    expect(power.modeLabel).not.toBe(toll.modeLabel)
  })
})

test.describe('lossPercent', () => {
  test('is derived from green, not roasted', () => {
    expect(lossPercent(10000, 8000)).toBeCloseTo(20, 5)
  })

  test('is null when there is nothing to divide by', () => {
    // NOT 0 — a session with no green has an unknown loss, and 0% would assert
    // a perfect yield that never happened.
    expect(lossPercent(0, 0)).toBeNull()
    expect(lossPercent(10000, 0)).toBeNull()
  })
})

test.describe('lossTone', () => {
  test('reports under, in and over against the band', () => {
    expect(LOSS_BAND).toEqual([12, 18])
    expect(lossTone(10)).toBe('under')
    expect(lossTone(15)).toBe('in')
    expect(lossTone(22)).toBe('over')
  })

  test('the band edges are inclusive', () => {
    // 12 and 18 are IN spec. An exclusive edge would flag a roast that hit its
    // target exactly, which is the one result that should never look wrong.
    expect(lossTone(12)).toBe('in')
    expect(lossTone(18)).toBe('in')
  })

  test('accepts a custom band, for when the setting becomes settable', () => {
    // roasting_settings.weight_loss_target exists but cannot currently be saved
    // (filed separately). The signature is ready for it.
    expect(lossTone(11, [10, 14])).toBe('in')
    expect(lossTone(9, [10, 14])).toBe('under')
  })
})

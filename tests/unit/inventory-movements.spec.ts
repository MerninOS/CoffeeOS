import { test, expect } from '@playwright/test'
import { lbsToGrams } from '../../lib/inventory/units'
import {
  actorLabel,
  deltaLabel,
  sourceLabel,
  toMovement,
  toMovements,
  type MovementRow,
} from '../../lib/inventory/movements'

/**
 * How a change row is written down for an operator (CoffeeOS#72 Criteria 14,
 * 14a, 15, 23). No browser, no server — see playwright.unit.config.ts.
 *
 * Most of these assert what the module REFUSES to do. The movement panel's whole
 * claim is that it explains where the coffee went, so a fabricated identifier is
 * worse there than a missing one.
 */

const row = (over: Partial<MovementRow> = {}): MovementRow => ({
  id: 'r1',
  change_type: 'manual_green_adjust',
  green_quantity_change_g: 0,
  old_price_per_lb: null,
  new_price_per_lb: null,
  reference_type: 'manual',
  notes: null,
  created_at: '2026-07-29T09:14:00Z',
  ...over,
})

test.describe('sourceLabel', () => {
  test('a roast batch is named WITHOUT a code, because none exists', () => {
    // roasting_batches has id (a UUID), coffee_name, lot_code, batch_date — no
    // batch number. The design mock showed "Batch BR-0142"; that is fabricated.
    // A UUID is not shown to an operator either.
    const label = sourceLabel('roasting_batch')
    expect(label).toBe('Roast batch')
    expect(label).not.toMatch(/BR-/)
    expect(label).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}/i)
  })

  test('an order is named only when a number was actually resolved', () => {
    expect(sourceLabel('order', '#4821')).toBe('Order #4821')
    expect(sourceLabel('order', null)).toBe('Order')
    expect(sourceLabel('order', '   ')).toBe('Order')
  })

  test('manual and null both read Manual', () => {
    expect(sourceLabel('manual')).toBe('Manual')
    expect(sourceLabel(null)).toBe('Manual')
  })
})

test.describe('actorLabel', () => {
  test('falls back to the role when the profile is unreadable', () => {
    // profiles_select does not grant an employee access to the OWNER's own row
    // (its owner_id is null), so this is every owner-made movement seen by an
    // employee — not an edge case.
    expect(actorLabel(null)).toBe('Owner')
    expect(actorLabel(undefined)).toBe('Owner')
    expect(actorLabel('  ')).toBe('Owner')
  })

  test('never renders empty, "null", or a UUID', () => {
    for (const input of [null, undefined, '']) {
      const out = actorLabel(input)
      expect(out).not.toBe('')
      expect(out).not.toMatch(/null|undefined/i)
      expect(out).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}/i)
    }
  })

  test('uses the real name when it is readable', () => {
    expect(actorLabel('Jess R.')).toBe('Jess R.')
  })
})

test.describe('deltaLabel', () => {
  test('signs exactly once', () => {
    // The literals matter. A handler that hard-codes the sign instead of taking
    // it from the value produces `−-8.0 lb` — the same double-negation that
    // reached production on /orders as `−$-5.00`.
    expect(deltaLabel(-8)).toBe('−8.0 lb')
    expect(deltaLabel(50)).toBe('+50.0 lb')
    expect(deltaLabel(-8)).not.toContain('--')
    expect(deltaLabel(-8)).not.toContain('−-')
  })

  test('zero reads as a positive rather than a bare figure', () => {
    expect(deltaLabel(0)).toBe('+0.0 lb')
  })
})

test.describe('toMovement', () => {
  test('converts grams to a signed pound delta', () => {
    const m = toMovement(
      row({ change_type: 'roast_deduct', green_quantity_change_g: -lbsToGrams(8) }),
    )
    expect(m.kind).toBe('quantity')
    expect(m.deltaLbs).toBeCloseTo(-8, 6)
    expect(deltaLabel(m.deltaLbs!)).toBe('−8.0 lb')
    expect(m.label).toBe('Roasted')
  })

  test('a price change carries prices and NO pound delta', () => {
    // Criterion 23: it renders in the same list but must not be counted toward
    // any quantity total, so it deliberately has no deltaLbs at all.
    const m = toMovement(
      row({
        change_type: 'price_change',
        old_price_per_lb: 6.8,
        new_price_per_lb: 7.25,
        green_quantity_change_g: 0,
      }),
    )
    expect(m.kind).toBe('price')
    expect(m.deltaLbs).toBeUndefined()
    expect(m.oldPrice).toBe(6.8)
    expect(m.newPrice).toBe(7.25)
    expect(m.label).toBe('Cost change')
  })

  test('a null gram delta is 0, not NaN', () => {
    // The column is nullable, and `null / 453.592` is 0 but `undefined / x` is
    // NaN — which would render "NaN lb" in the one panel that is supposed to
    // account for every pound.
    const m = toMovement(row({ green_quantity_change_g: null }))
    expect(Number.isNaN(m.deltaLbs!)).toBe(false)
    expect(m.deltaLbs).toBe(0)
  })

  test('blank notes become null rather than an empty line', () => {
    expect(toMovement(row({ notes: '   ' })).note).toBeNull()
    expect(toMovement(row({ notes: 'Moisture loss' })).note).toBe('Moisture loss')
  })

  test('every change type gets a human label', () => {
    const types = [
      'initial',
      'manual_green_adjust',
      'roast_deduct',
      'roast_add',
      'sale_deduct',
      'manual_roasted_adjust',
      'price_change',
    ] as const
    for (const t of types) {
      const label = toMovement(row({ change_type: t })).label
      expect(label, `${t} must not render its raw enum`).not.toBe(t)
      expect(label).not.toContain('_')
    }
  })
})

test.describe('toMovements', () => {
  test('preserves order and maps every row', () => {
    const out = toMovements([
      row({ id: 'a', green_quantity_change_g: -lbsToGrams(3) }),
      row({ id: 'b', change_type: 'initial', green_quantity_change_g: lbsToGrams(50) }),
    ])
    expect(out.map((m) => m.id)).toEqual(['a', 'b'])
    expect(deltaLabel(out[1].deltaLbs!)).toBe('+50.0 lb')
  })
})

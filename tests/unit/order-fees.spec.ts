import { test, expect } from '@playwright/test'
import {
  computeProcessingFee,
  formatProcessingFee,
  FEE_TITLE,
  type FeeOrder,
} from '../../lib/orders/fees'

/**
 * The fee rule decides what every synced order records as its processing
 * cost, so each branch here is load-bearing. Fixture shapes mirror real
 * Admin-API responses captured from live orders #1312–#1314 (2026-08-08).
 */

const order = (overrides: Partial<FeeOrder> = {}): FeeOrder => ({
  displayFinancialStatus: 'PAID',
  totalPriceSet: { shopMoney: { amount: '38.33', currencyCode: 'USD' } },
  transactions: [],
  ...overrides,
})

const fee = (amount: string, currencyCode = 'USD') => ({
  amount: { amount, currencyCode },
})

test.describe('actual fees', () => {
  test('auth + capture pair: fee lives on the SECOND transaction', () => {
    // The shape every card order arrives in. Reading only the first
    // transaction finds fees: [] and silently falls through to the estimate —
    // wrong source, and a wrong figure the moment a non-standard-rate
    // payment method appears (AC 1).
    const result = computeProcessingFee(
      order({
        transactions: [{ fees: [] }, { fees: [fee('1.41')] }],
      })
    )
    expect(result).toEqual({ fee: 1.41, source: 'actual' })
  })

  test('fees across multiple transactions are summed', () => {
    const result = computeProcessingFee(
      order({ transactions: [{ fees: [fee('1.00')] }, { fees: [fee('0.55')] }] })
    )
    expect(result).toEqual({ fee: 1.55, source: 'actual' })
  })

  test('single SALE transaction with one fee row', () => {
    // Live order #1313: $64.00, fee $2.16.
    const result = computeProcessingFee(
      order({
        totalPriceSet: { shopMoney: { amount: '64.0', currencyCode: 'USD' } },
        transactions: [{ fees: [fee('2.16')] }],
      })
    )
    expect(result).toEqual({ fee: 2.16, source: 'actual' })
  })
})

test.describe('estimate fallback', () => {
  test('paid order with no fee rows estimates at rate + flat, rounded', () => {
    // 38.33 × 0.029 + 0.30 = 1.41157 → 1.41 (AC 2). Matches what Shopify
    // actually charged #1314, which is the point of the constants.
    const result = computeProcessingFee(order({ transactions: [] }))
    expect(result).toEqual({ fee: 1.41, source: 'estimated' })
  })

  test('missing transactions field behaves as no fee rows', () => {
    const result = computeProcessingFee(order({ transactions: undefined }))
    expect(result).toEqual({ fee: 1.41, source: 'estimated' })
  })

  test('$0 order stores a true zero, never the 30¢ flat fee', () => {
    // AC 3: production has $0 giveaway orders. No money moved, no fee —
    // and it is a KNOWN zero ('actual'), not an estimate.
    const result = computeProcessingFee(
      order({
        totalPriceSet: { shopMoney: { amount: '0.00', currencyCode: 'USD' } },
        transactions: [],
      })
    )
    expect(result).toEqual({ fee: 0, source: 'actual' })
  })
})

test.describe('not knowable yet', () => {
  test('unpaid order returns null so a later re-sync can fill it', () => {
    // A stored 0 would read as "known to be free" forever; null is what lets
    // the unpaid→paid transition update the row.
    const result = computeProcessingFee(
      order({ displayFinancialStatus: 'PENDING', transactions: [] })
    )
    expect(result).toBeNull()
  })

  test('unparseable fee amount degrades to null, never throws', () => {
    const result = computeProcessingFee(
      order({ transactions: [{ fees: [fee('not-a-number')] }] })
    )
    expect(result).toBeNull()
  })

  test('fee currency disagreeing with the order currency is unknown', () => {
    // Summing EUR fee cents into a USD figure would corrupt the column with
    // a number that looks plausible. Null is honest.
    const result = computeProcessingFee(
      order({ transactions: [{ fees: [fee('1.41', 'EUR')] }] })
    )
    expect(result).toBeNull()
  })

  test('unparseable order total is unknown even with fee rows present', () => {
    const result = computeProcessingFee(
      order({
        totalPriceSet: { shopMoney: { amount: '', currencyCode: 'USD' } },
        transactions: [{ fees: [fee('1.41')] }],
      })
    )
    expect(result).toBeNull()
  })
})

/**
 * The DISPLAY rule, which both /orders and /orders/[id] render.
 *
 * These exist because a mutation proved the components were unreachable from
 * this suite: deleting the `~` prefix from the detail worksheet left all 236
 * tests green, since only the credentialed e2e suite was watching. The
 * formatter is now the single implementation, and these are the fast tests
 * that fail when it changes.
 */
test.describe('formatProcessingFee', () => {
  test('an actual fee is plain — no tilde, and no excuse in the tooltip', () => {
    const result = formatProcessingFee({
      total_processing_fee: 1.41,
      processing_fee_source: 'actual',
    })
    expect(result).toEqual({ state: 'actual', text: '$1.41' })
    expect(FEE_TITLE[result.state]).toBeUndefined()
  })

  test('an estimated fee carries the ~ that separates inferred from reported', () => {
    // AC 7. The tilde is the ONLY on-screen difference between a figure
    // Shopify reported and one this code derived — losing it silently
    // upgrades every estimate to a fact.
    const result = formatProcessingFee({
      total_processing_fee: 1.41,
      processing_fee_source: 'estimated',
    })
    expect(result).toEqual({ state: 'estimated', text: '~$1.41' })
    expect(FEE_TITLE[result.state]).toContain('Estimated')
  })

  test('a null fee reads as not synced, never as $0.00', () => {
    const result = formatProcessingFee({ total_processing_fee: null })
    expect(result).toEqual({ state: 'unknown', text: 'not synced' })
    expect(FEE_TITLE[result.state]).toContain('unknown')
  })

  test('a missing fee field is unknown, not a crash and not zero', () => {
    expect(formatProcessingFee({})).toEqual({ state: 'unknown', text: 'not synced' })
  })

  test('a genuine $0 fee is a FIGURE, not the unknown sentinel', () => {
    // The $0-giveaway case. `fee == null` must not catch 0, or every free
    // order reads as un-synced forever and AC 3 is undone at the last step.
    const result = formatProcessingFee({
      total_processing_fee: 0,
      processing_fee_source: 'actual',
    })
    expect(result).toEqual({ state: 'actual', text: '$0.00' })
  })

  test('an unrecognised source is treated as actual, never dropped', () => {
    // Defensive: the column is check-constrained, but a future value must
    // still render its figure rather than vanish behind a sentinel.
    const result = formatProcessingFee({
      total_processing_fee: 2.5,
      processing_fee_source: 'something-new',
    })
    expect(result).toEqual({ state: 'actual', text: '$2.50' })
  })

  test('fees are fixed to two decimals, not left as float noise', () => {
    expect(formatProcessingFee({ total_processing_fee: 1.4 }).text).toBe('$1.40')
    expect(formatProcessingFee({ total_processing_fee: 12 }).text).toBe('$12.00')
  })
})

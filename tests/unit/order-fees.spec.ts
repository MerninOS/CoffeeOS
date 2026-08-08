import { test, expect } from '@playwright/test'
import { computeProcessingFee, type FeeOrder } from '../../lib/orders/fees'

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

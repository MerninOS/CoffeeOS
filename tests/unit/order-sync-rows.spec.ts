import { test, expect } from '@playwright/test'
import { buildLineItemRows, buildOrderFields } from '../../lib/orders/sync'
import type { ShopifyOrder } from '../../lib/shopify'

const money = (amount: string) => ({ shopMoney: { amount, currencyCode: 'USD' } })

const order: ShopifyOrder = {
  id: 'gid://shopify/Order/111',
  name: '#1001',
  createdAt: '2026-07-01T00:00:00Z',
  displayFinancialStatus: 'PAID',
  displayFulfillmentStatus: 'UNFULFILLED',
  totalPriceSet: money('25.00'),
  subtotalPriceSet: money('20.00'),
  totalShippingPriceSet: money('5.00'),
  totalTaxSet: money('0.00'),
  // The live shape: auth carries no fees, capture carries the real one.
  transactions: [
    { fees: [] },
    { fees: [{ amount: { amount: '1.03', currencyCode: 'USD' } }] },
  ],
  lineItems: {
    edges: [
      {
        node: {
          id: 'gid://shopify/LineItem/1',
          title: 'Mexico Veracruz',
          quantity: 2,
          sku: 'MEX-12',
          product: { id: 'gid://shopify/Product/900' },
          originalUnitPriceSet: money('10.00'),
          discountedUnitPriceSet: money('10.00'),
        },
      },
      {
        node: {
          id: 'gid://shopify/LineItem/2',
          title: 'Deleted product item',
          quantity: 1,
          sku: null,
          product: null,
          originalUnitPriceSet: money('5.00'),
          discountedUnitPriceSet: money('5.00'),
        },
      },
    ],
  },
}

test('maps line items and links known shopify products', () => {
  const rows = buildLineItemRows(order, new Map([['900', 'local-uuid-900']]))
  expect(rows).toHaveLength(2)
  expect(rows[0]).toMatchObject({
    shopify_line_item_id: '1',
    shopify_product_id: '900',
    product_id: 'local-uuid-900',
    title: 'Mexico Veracruz',
    quantity: 2,
    price: 10,
    total_price: 20,
    shopify_variant_id: null,
    variant_title: null,
  })
})

test('leaves product_id null for unknown or missing products', () => {
  const rows = buildLineItemRows(order, new Map())
  expect(rows[0].product_id).toBeNull()
  expect(rows[1].product_id).toBeNull()
  expect(rows[1].shopify_product_id).toBeNull()
})

test('uses the discounted unit price, not the original, for price and total_price', () => {
  const discountedOrder: ShopifyOrder = {
    ...order,
    lineItems: {
      edges: [
        {
          node: {
            id: 'gid://shopify/LineItem/3',
            title: 'Discounted Ethiopia',
            quantity: 2,
            sku: 'ETH-9',
            product: { id: 'gid://shopify/Product/901' },
            originalUnitPriceSet: money('10.00'),
            discountedUnitPriceSet: money('7.50'),
          },
        },
      ],
    },
  }

  const rows = buildLineItemRows(discountedOrder, new Map())
  expect(rows[0].price).toBe(7.5)
  expect(rows[0].total_price).toBe(15)
})

test.describe('buildOrderFields processing fee', () => {
  test('paid order with transaction fees writes the actual figure', () => {
    const fields = buildOrderFields(order)
    expect(fields.total_processing_fee).toBe(1.03)
    expect(fields.processing_fee_source).toBe('actual')
  })

  test('paid order with no fee rows writes the estimate', () => {
    const fields = buildOrderFields({ ...order, transactions: [] })
    // 25.00 × 0.029 + 0.30 = 1.025 → 1.03
    expect(fields.total_processing_fee).toBe(1.03)
    expect(fields.processing_fee_source).toBe('estimated')
  })

  test('unknowable fee OMITS the keys so an update cannot clobber a stored figure', () => {
    // Not `undefined`-valued keys: supabase-js serialises those away, but the
    // contract worth pinning is that the keys are absent, so a re-sync of an
    // unpaid order (or one with a malformed fee payload) leaves whatever the
    // row already holds untouched.
    const fields = buildOrderFields({
      ...order,
      displayFinancialStatus: 'PENDING',
      transactions: [],
    })
    expect('total_processing_fee' in fields).toBe(false)
    expect('processing_fee_source' in fields).toBe(false)
  })

  test('the base row shape is unchanged by the fee addition', () => {
    const fields = buildOrderFields(order)
    expect(fields).toMatchObject({
      shopify_order_number: '#1001',
      order_name: '#1001',
      financial_status: 'PAID',
      subtotal_price: 20,
      total_tax: 0,
      total_price: 25,
      total_shipping: 5,
      currency: 'USD',
    })
  })
})

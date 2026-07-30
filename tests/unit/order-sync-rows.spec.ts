import { test, expect } from '@playwright/test'
import { buildLineItemRows } from '../../lib/orders/sync'
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

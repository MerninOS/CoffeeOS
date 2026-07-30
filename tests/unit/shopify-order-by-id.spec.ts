import { test, expect } from '@playwright/test'
import { fetchShopifyOrderById } from '../../lib/shopify'

const ORDER_NODE = {
  id: 'gid://shopify/Order/123456',
  name: '#1042',
  createdAt: '2026-07-01T00:00:00Z',
  displayFinancialStatus: 'PAID',
  displayFulfillmentStatus: 'UNFULFILLED',
  totalPriceSet: { shopMoney: { amount: '42.00', currencyCode: 'USD' } },
  subtotalPriceSet: { shopMoney: { amount: '36.00', currencyCode: 'USD' } },
  totalShippingPriceSet: { shopMoney: { amount: '6.00', currencyCode: 'USD' } },
  totalTaxSet: { shopMoney: { amount: '0.00', currencyCode: 'USD' } },
  lineItems: { edges: [] },
}

function mockFetchOnce(body: unknown) {
  const original = globalThis.fetch
  globalThis.fetch = (async () =>
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })) as typeof fetch
  return () => {
    globalThis.fetch = original
  }
}

function mockFetchOnceCapturing(body: unknown) {
  const original = globalThis.fetch
  let capturedUrl: string | undefined
  let capturedInit: RequestInit | undefined
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    capturedUrl = url
    capturedInit = init
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }) as typeof fetch
  return {
    restore: () => {
      globalThis.fetch = original
    },
    getCaptured: () => ({ url: capturedUrl, init: capturedInit }),
  }
}

test('returns the order when Shopify finds the node', async () => {
  const restore = mockFetchOnce({ data: { order: ORDER_NODE } })
  try {
    const order = await fetchShopifyOrderById('my-store.myshopify.com', 'token', '123456')
    expect(order?.name).toBe('#1042')
    expect(order?.totalShippingPriceSet.shopMoney.amount).toBe('6.00')
  } finally {
    restore()
  }
})

test('returns null when the node does not exist or is not an Order', async () => {
  const restore = mockFetchOnce({ data: { order: null } })
  try {
    const order = await fetchShopifyOrderById('my-store.myshopify.com', 'token', '999')
    expect(order).toBeNull()
  } finally {
    restore()
  }
})

test('throws on GraphQL errors', async () => {
  const restore = mockFetchOnce({ errors: [{ message: 'boom' }] })
  try {
    await expect(
      fetchShopifyOrderById('my-store.myshopify.com', 'token', '123456')
    ).rejects.toThrow()
  } finally {
    restore()
  }
})

test('posts a well-formed request: correct GID and API version', async () => {
  const { restore, getCaptured } = mockFetchOnceCapturing({ data: { order: ORDER_NODE } })
  try {
    await fetchShopifyOrderById('my-store.myshopify.com', 'token', '123456')
    const { url, init } = getCaptured()
    expect(url).toContain('/admin/api/2024-10/graphql.json')
    expect(init?.body).toBeTruthy()
    const parsedBody = JSON.parse(init!.body as string)
    expect(parsedBody.variables.id).toBe('gid://shopify/Order/123456')
  } finally {
    restore()
  }
})

test('throws a diagnosable error on a non-200 response', async () => {
  const original = globalThis.fetch
  globalThis.fetch = (async () =>
    new Response('<html>Bad Gateway</html>', {
      status: 502,
      headers: { 'content-type': 'text/html' },
    })) as typeof fetch
  try {
    await expect(
      fetchShopifyOrderById('my-store.myshopify.com', 'token', '123456')
    ).rejects.toThrow(/502/)
  } finally {
    globalThis.fetch = original
  }
})

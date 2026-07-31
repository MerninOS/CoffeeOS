import { test, expect } from '@playwright/test'
import { loadProductLookup, type LookupQueryClient } from '../../lib/products/load-lookup'

/**
 * The tenancy scope on the product lookup, pinned.
 *
 * This test exists for one deletion. `.eq("user_id", ownerId)` on the products
 * query is the only thing keeping the lookup inside one owner's catalogue, and
 * removing it breaks nothing visible: the page renders, the costs look
 * plausible, TypeScript is satisfied, and every other test passes. Three owners
 * share the production database, so the failure is a cross-tenant cost silently
 * resolving a line item.
 *
 * Until this file existed, that line was protected by a comment.
 *
 * The fake records the filters applied rather than the rows returned — the
 * question is not "what came back" but "what did we ask for".
 */

interface Applied {
  table: string
  eq: Array<[string, unknown]>
  in: Array<[string, unknown[]]>
}

function fakeClient(opts: {
  products?: unknown
  variants?: unknown
  productsError?: string
  variantsError?: string
} = {}) {
  const applied: Applied[] = []

  const client: LookupQueryClient = {
    from(table: string) {
      const call: Applied = { table, eq: [], in: [] }
      applied.push(call)

      const isProducts = table === 'products'
      const error = isProducts
        ? (opts.productsError ? { message: opts.productsError } : null)
        : (opts.variantsError ? { message: opts.variantsError } : null)
      const data = isProducts ? (opts.products ?? []) : (opts.variants ?? [])
      const result = Promise.resolve({ data, error })

      return {
        select() {
          return {
            eq(column: string, value: unknown) {
              call.eq.push([column, value])
              return result
            },
            in(column: string, values: unknown[]) {
              call.in.push([column, values])
              return result
            },
          }
        },
      }
    },
  }

  return { client, applied }
}

const OWNER = 'owner-a'

test('scopes the products query to the owner', async () => {
  const { client, applied } = fakeClient()
  await loadProductLookup(client, OWNER)

  const products = applied.find((c) => c.table === 'products')
  expect(products, 'the products table was queried').toBeTruthy()
  expect(
    products!.eq,
    'the products query must filter on user_id — without it the lookup spans every tenant',
  ).toContainEqual(['user_id', OWNER])
})

test('scopes variants by the owner-filtered product ids, not by a bare fetch', async () => {
  const { client, applied } = fakeClient({
    products: [{ id: 'p1', title: 'A', product_components: [] }, { id: 'p2', title: 'B', product_components: [] }],
  })
  await loadProductLookup(client, OWNER)

  const variants = applied.find((c) => c.table === 'product_variants')
  expect(variants, 'the variants table was queried').toBeTruthy()
  expect(
    variants!.in,
    'variants inherit tenancy through the product ids above',
  ).toContainEqual(['product_id', ['p1', 'p2']])
})

test('throws when the products query fails, rather than returning an empty lookup', async () => {
  const { client } = fakeClient({ productsError: 'connection reset' })
  await expect(loadProductLookup(client, OWNER)).rejects.toThrow(/Could not load product costs/)
})

test('throws when the variants query fails', async () => {
  const { client } = fakeClient({ variantsError: 'timeout' })
  await expect(loadProductLookup(client, OWNER)).rejects.toThrow(/Could not load variant costs/)
})

/**
 * The degraded path this refuses to take. An empty lookup is not a neutral
 * fallback: every line item resolves to nothing, so `classifyOrder` returns
 * `unlinked` for every order and the UI states as fact that the product was
 * deleted. That is why the two tests above assert a throw and not a default.
 */
test('a successful load with no products yields an empty lookup, which is different from an error', async () => {
  const { client } = fakeClient({ products: [] })
  await expect(loadProductLookup(client, OWNER)).resolves.toEqual({})
})

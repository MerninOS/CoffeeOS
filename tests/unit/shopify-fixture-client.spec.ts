import { test, expect } from '@playwright/test'
import { VARIANTS_PAGE_SIZE } from '../../lib/shopify'
import * as client from '../../lib/shopify-client'

/**
 * The fixture seam in lib/shopify-client.ts, and the guard that keeps it out of
 * production.
 *
 * These run with no browser and no server — see playwright.unit.config.ts.
 *
 * usingFixtures() reads process.env on every call rather than at module load, so
 * a single static import is enough: each test just sets the env around its call.
 * The only module-level cache is the parsed JSON, which does not vary by env.
 */

async function withEnv<T>(
  env: Record<string, string | undefined>,
  run: () => Promise<T>
): Promise<T> {
  const previous: Record<string, string | undefined> = {}
  for (const key of Object.keys(env)) {
    previous[key] = process.env[key]
    if (env[key] === undefined) delete process.env[key]
    else process.env[key] = env[key]
  }
  try {
    return await run()
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
}

test('the fixture flag alone does not divert a production build', async () => {
  // No fixture data must come back. The live path is reached instead and fails
  // on an unresolvable host — and failing to reach Shopify is the CORRECT
  // outcome. A resolved promise carrying fixture products would mean one stray
  // environment variable can serve fake inventory to a real dashboard.
  //
  // .invalid is reserved by RFC 2606 and never resolves, so this fails fast and
  // reaches no real network peer.
  await withEnv({ SHOPIFY_FIXTURE_MODE: '1', NODE_ENV: 'production' }, async () => {
    await expect(
      client.fetchShopifyProducts('store.invalid', 'not-a-real-token')
    ).rejects.toThrow()
  })
})

test('fixture mode serves the committed catalogue without a network call', async () => {
  const page = await withEnv({ SHOPIFY_FIXTURE_MODE: '1', NODE_ENV: 'test' }, () =>
    client.fetchShopifyProducts('unused', 'unused', 50)
  )

  expect(page.edges.length).toBeGreaterThan(0)
  expect(page.pageInfo.hasNextPage).toBe(false)

  // The pairing with seed-demo-account.mjs: ids in the 10000000xx range exist in
  // the seed and must classify as changed, 90000000xx are absent and must
  // classify as new. If this drifts, the e2e suite silently tests nothing.
  const ids = page.edges.map((edge) => edge.node.id.split('/').pop())
  expect(ids).toContain('1000000005')
  expect(ids).toContain('9000000002')
})

test('a product past the variant page boundary reports more to fetch', async () => {
  const page = await withEnv({ SHOPIFY_FIXTURE_MODE: '1', NODE_ENV: 'test' }, () =>
    client.fetchShopifyProducts('unused', 'unused', 50)
  )
  const advent = page.edges
    .map((edge) => edge.node)
    .find((node) => node.variants.pageInfo.hasNextPage)

  // Without a product that crosses VARIANTS_PAGE_SIZE, nothing in the suite
  // exercises fetchRemainingProductVariants — the exact path whose absence let
  // variants 11+ be deleted on every sync.
  expect(advent, 'fixture must contain a product with more than one variant page').toBeTruthy()
  expect(advent!.variants.edges.length).toBe(VARIANTS_PAGE_SIZE)

  const rest = await withEnv({ SHOPIFY_FIXTURE_MODE: '1', NODE_ENV: 'test' }, () =>
    client.fetchRemainingProductVariants(
      'unused',
      'unused',
      advent!.id,
      advent!.variants.pageInfo.endCursor
    )
  )

  expect(rest.length).toBe(20)

  // The two pages must not overlap; an off-by-one in the cursor would duplicate
  // a variant and the upsert would quietly collapse it.
  const firstPageIds = new Set(advent!.variants.edges.map((edge) => edge.node.id))
  expect(rest.every((variant) => !firstPageIds.has(variant.id))).toBe(true)
  expect(new Set([...firstPageIds, ...rest.map((v) => v.id)]).size).toBe(120)
})

test('a product that vanished mid-sync yields no variants rather than throwing', async () => {
  const rest = await withEnv({ SHOPIFY_FIXTURE_MODE: '1', NODE_ENV: 'test' }, () =>
    client.fetchRemainingProductVariants(
      'unused',
      'unused',
      'gid://shopify/Product/does-not-exist',
      '100'
    )
  )

  expect(rest).toEqual([])
})

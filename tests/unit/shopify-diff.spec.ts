import { test, expect } from '@playwright/test'
import {
  diffProduct,
  exclusionsToRecord,
  type ExistingProduct,
  type ExistingVariant,
  type SyncStatus,
} from '../../lib/products/shopify-diff'
import type { ShopifyProduct, ShopifyVariant } from '../../lib/shopify'

/**
 * The classifier behind the sync review dialog. No browser, no server, no
 * database — see playwright.unit.config.ts.
 *
 * This file carries the per-field and normalisation coverage deliberately: the
 * e2e fixture cannot express it without distorting the demo seed, whose products
 * exist to serve the costing tests. What e2e proves is the flow; what this
 * proves is the decision.
 *
 * Every "changed" assertion checks the DIFF CONTENTS, never just the status.
 * Asserting `status === 'changed'` alone passes even when the diff names the
 * wrong field, which is precisely the bug a reviewer would never catch by eye.
 */

const shopifyVariant = (
  overrides: Partial<ShopifyVariant> & Pick<ShopifyVariant, 'id'>
): ShopifyVariant => ({
  title: 'Default Title',
  price: '18.00',
  sku: 'BASE-SKU',
  inventoryQuantity: 10,
  ...overrides,
})

const shopifyProduct = (overrides: Partial<ShopifyProduct> = {}): ShopifyProduct => ({
  id: 'gid://shopify/Product/1000000001',
  title: 'Yirgacheffe Light Roast 12oz',
  handle: 'yirgacheffe-light-roast-12oz',
  description: 'Floral and citrus-forward single origin.',
  vendor: "Mernin' Coffee Roasters",
  productType: 'Coffee',
  updatedAt: '2026-07-01T12:00:00Z',
  images: { edges: [] },
  variants: { edges: [], pageInfo: { hasNextPage: false, endCursor: '0' } },
  ...overrides,
})

/**
 * A stored row that is diff-identical to the product/variant above.
 *
 * Note sku and price come from the FIRST VARIANT, not from any product-level
 * Shopify field — that is how syncShopifyProducts derives them. A fixture that
 * got this wrong would make the unchanged test impossible to satisfy and every
 * other test misleading.
 */
const existingProduct = (overrides: Partial<ExistingProduct> = {}): ExistingProduct => ({
  id: 'local-uuid-1',
  shopify_id: '1000000001',
  title: 'Yirgacheffe Light Roast 12oz',
  description: 'Floral and citrus-forward single origin.',
  sku: 'BASE-SKU',
  price: 18,
  image_url: null,
  shopify_handle: 'yirgacheffe-light-roast-12oz',
  ...overrides,
})

const existingVariant = (overrides: Partial<ExistingVariant> = {}): ExistingVariant => ({
  shopify_variant_id: 'gid://shopify/ProductVariant/10000000011',
  title: 'Default Title',
  sku: 'BASE-SKU',
  price: 18,
  ...overrides,
})

const incomingVariants = [shopifyVariant({ id: 'gid://shopify/ProductVariant/10000000011' })]

/** The identical pair the whole file is calibrated against. */
const identical = () => ({
  incoming: shopifyProduct(),
  incomingVariants,
  existing: existingProduct(),
  existingVariants: [existingVariant()],
})

// ── AC2 and AC4: new and unchanged ──────────────────────────────────────────

test('a product with no stored row is new', () => {
  const candidate = diffProduct({ ...identical(), existing: null, existingVariants: [] })

  expect(candidate.status).toBe('new')
  expect(candidate.diffs).toEqual([])
  expect(candidate.variantDiffs).toEqual([])
  // The numeric tail, matching what the sync stores — not the full GID.
  expect(candidate.shopifyId).toBe('1000000001')
})

test('an identical product is unchanged', () => {
  const candidate = diffProduct(identical())

  expect(candidate.status).toBe('unchanged')
  expect(candidate.diffs).toEqual([])
  expect(candidate.variantDiffs).toEqual([])
})

/**
 * The guard that keeps the new test honest.
 *
 * If the caller's lookup silently returned nothing, EVERY product would classify
 * as new and the test above would pass for entirely the wrong reason. It runs
 * off the same fixture pair as the unchanged test, so a broken pairing fails
 * that one immediately. This asserts the calibration explicitly.
 */
test('the fixture pair really is diff-identical, or every other case is meaningless', () => {
  const { incoming, existing } = identical()

  expect(existing.shopify_id).toBe(incoming.id.split('/').pop())
  expect(diffProduct(identical()).status).toBe('unchanged')
})

// ── AC3: changed, one case per compared field ───────────────────────────────

const fieldCases: Array<{
  field: string
  incoming: Partial<ShopifyProduct>
  variants?: ShopifyVariant[]
  existing?: Partial<ExistingProduct>
  expect: { current: string | null; incoming: string | null }
}> = [
  {
    field: 'title',
    incoming: { title: 'Yirgacheffe Light Roast 12oz (2026 Harvest)' },
    expect: {
      current: 'Yirgacheffe Light Roast 12oz',
      incoming: 'Yirgacheffe Light Roast 12oz (2026 Harvest)',
    },
  },
  {
    field: 'description',
    incoming: { description: 'Now with more citrus.' },
    expect: {
      current: 'Floral and citrus-forward single origin.',
      incoming: 'Now with more citrus.',
    },
  },
  {
    field: 'shopify_handle',
    incoming: { handle: 'yirgacheffe-light-roast-12oz-2026' },
    expect: {
      current: 'yirgacheffe-light-roast-12oz',
      incoming: 'yirgacheffe-light-roast-12oz-2026',
    },
  },
  {
    field: 'image_url',
    incoming: {
      images: { edges: [{ node: { url: 'https://cdn.example/yirg.jpg', altText: null } }] },
    },
    expect: { current: null, incoming: 'https://cdn.example/yirg.jpg' },
  },
  {
    field: 'sku',
    // sku is derived from the first variant, so this is where it must change.
    variants: [
      shopifyVariant({ id: 'gid://shopify/ProductVariant/10000000011', sku: 'ETH-12-LIGHT' }),
    ],
    incoming: {},
    expect: { current: 'BASE-SKU', incoming: 'ETH-12-LIGHT' },
  },
  {
    field: 'price',
    variants: [
      shopifyVariant({ id: 'gid://shopify/ProductVariant/10000000011', price: '21.50' }),
    ],
    incoming: {},
    expect: { current: '18.00', incoming: '21.50' },
  },
]

for (const testCase of fieldCases) {
  test(`a changed ${testCase.field} is reported as a ${testCase.field} diff`, () => {
    const base = identical()
    const candidate = diffProduct({
      ...base,
      incoming: shopifyProduct(testCase.incoming),
      incomingVariants: testCase.variants ?? base.incomingVariants,
      existing: existingProduct(testCase.existing),
    })

    expect(candidate.status).toBe('changed')

    // Named field, exact values. Asserting only the status would pass even if
    // the diff pointed at the wrong field entirely.
    const diff = candidate.diffs.find((entry) => entry.field === testCase.field)
    expect(diff, `expected a ${testCase.field} diff, got ${JSON.stringify(candidate.diffs)}`)
      .toBeTruthy()
    expect(diff!.current).toBe(testCase.expect.current)
    expect(diff!.incoming).toBe(testCase.expect.incoming)
  })
}

test('a changed sku on the first variant does not silently drag other fields with it', () => {
  const base = identical()
  const candidate = diffProduct({
    ...base,
    incomingVariants: [
      shopifyVariant({ id: 'gid://shopify/ProductVariant/10000000011', sku: 'ETH-12-LIGHT' }),
    ],
  })

  // sku moved at BOTH levels — the product row derives it from this variant —
  // but nothing else may have.
  expect(candidate.diffs.map((diff) => diff.field)).toEqual(['sku'])
})

// ── AC3: variant-level changes ──────────────────────────────────────────────

test('a variant Shopify no longer returns is reported as removed', () => {
  const candidate = diffProduct({
    ...identical(),
    existingVariants: [
      existingVariant(),
      existingVariant({ shopify_variant_id: 'gid://shopify/ProductVariant/10000000012' }),
    ],
  })

  expect(candidate.status).toBe('changed')
  expect(candidate.variantDiffs).toEqual([
    {
      shopifyVariantId: 'gid://shopify/ProductVariant/10000000012',
      kind: 'removed',
      diffs: [],
    },
  ])
})

test('a variant Shopify has newly returned is reported as added', () => {
  const candidate = diffProduct({
    ...identical(),
    incomingVariants: [
      ...incomingVariants,
      shopifyVariant({ id: 'gid://shopify/ProductVariant/10000000012', title: '2lb' }),
    ],
  })

  expect(candidate.status).toBe('changed')
  expect(candidate.variantDiffs).toEqual([
    { shopifyVariantId: 'gid://shopify/ProductVariant/10000000012', kind: 'added', diffs: [] },
  ])
})

test('a renamed variant is reported as changed, naming the title', () => {
  const candidate = diffProduct({
    ...identical(),
    incomingVariants: [
      shopifyVariant({ id: 'gid://shopify/ProductVariant/10000000011', title: '12oz Whole Bean' }),
    ],
  })

  expect(candidate.status).toBe('changed')
  expect(candidate.variantDiffs).toEqual([
    {
      shopifyVariantId: 'gid://shopify/ProductVariant/10000000011',
      kind: 'changed',
      diffs: [{ field: 'title', current: 'Default Title', incoming: '12oz Whole Bean' }],
    },
  ])
})

test('a re-SKUd variant is reported as changed, naming the sku', () => {
  const candidate = diffProduct({
    ...identical(),
    incomingVariants: [
      shopifyVariant({ id: 'gid://shopify/ProductVariant/10000000011', sku: 'ETH-12-LIGHT' }),
    ],
    // Product-level sku moved with it (it is derived from this variant), so the
    // stored row is set to match — isolating the VARIANT-level diff.
    existing: existingProduct({ sku: 'ETH-12-LIGHT' }),
  })

  // The sync writes variant sku on every row. A variant other than the first
  // could change sku with no diff at all before this was compared.
  expect(candidate.variantDiffs).toEqual([
    {
      shopifyVariantId: 'gid://shopify/ProductVariant/10000000011',
      kind: 'changed',
      diffs: [{ field: 'sku', current: 'BASE-SKU', incoming: 'ETH-12-LIGHT' }],
    },
  ])
})

test('a re-SKUd SECOND variant is still caught', () => {
  const second = 'gid://shopify/ProductVariant/10000000012'
  const candidate = diffProduct({
    ...identical(),
    incomingVariants: [
      shopifyVariant({ id: 'gid://shopify/ProductVariant/10000000011' }),
      shopifyVariant({ id: second, title: '2lb', sku: 'ETH-2LB-V2' }),
    ],
    existingVariants: [
      existingVariant(),
      existingVariant({ shopify_variant_id: second, title: '2lb', sku: 'ETH-2LB' }),
    ],
  })

  // The case that was invisible: nothing about the product row moves, so
  // without a variant-level sku comparison this classified UNCHANGED.
  expect(candidate.status).toBe('changed')
  expect(candidate.diffs).toEqual([])
  expect(candidate.variantDiffs).toEqual([
    {
      shopifyVariantId: second,
      kind: 'changed',
      diffs: [{ field: 'sku', current: 'ETH-2LB', incoming: 'ETH-2LB-V2' }],
    },
  ])
})

test('a repriced variant is reported as changed, naming the price', () => {
  const candidate = diffProduct({
    ...identical(),
    incomingVariants: [
      shopifyVariant({ id: 'gid://shopify/ProductVariant/10000000011', price: '19.99' }),
    ],
  })

  const variantDiff = candidate.variantDiffs[0]
  expect(variantDiff.kind).toBe('changed')
  expect(variantDiff.diffs).toEqual([
    { field: 'price', current: '18.00', incoming: '19.99' },
  ])
})

test('a hand-made variant with no Shopify id is never reported as removed', () => {
  const candidate = diffProduct({
    ...identical(),
    existingVariants: [existingVariant(), existingVariant({ shopify_variant_id: null })],
  })

  // The sync's reap only deletes rows it can match by id, so calling this
  // "removed" would promise a deletion that never happens.
  expect(candidate.status).toBe('unchanged')
  expect(candidate.variantDiffs).toEqual([])
})

// ── Normalisation: the traps that would mark the whole catalogue changed ────

test('19.0 from Shopify and 19.00 from Postgres are the same price', () => {
  const candidate = diffProduct({
    ...identical(),
    incomingVariants: [
      shopifyVariant({ id: 'gid://shopify/ProductVariant/10000000011', price: '18.0' }),
    ],
    existing: existingProduct({ price: '18.00' }),
    existingVariants: [existingVariant({ price: '18.00' })],
  })

  expect(candidate.status).toBe('unchanged')
  expect(candidate.diffs).toEqual([])
  expect(candidate.variantDiffs).toEqual([])
})

test('a price stored as a number and sent as a string are the same price', () => {
  const candidate = diffProduct({
    ...identical(),
    existing: existingProduct({ price: 18 }),
    existingVariants: [existingVariant({ price: 18 })],
  })

  expect(candidate.status).toBe('unchanged')
})

test('an empty description and a null description are the same description', () => {
  const candidate = diffProduct({
    ...identical(),
    incoming: shopifyProduct({ description: '' }),
    existing: existingProduct({ description: null }),
  })

  // The sync writes `description || null`, so "" becomes NULL in the column.
  // Reporting these as different would flag every product without a description
  // on every single preview.
  expect(candidate.status).toBe('unchanged')
})

test('whitespace-only text is empty, not a change', () => {
  const candidate = diffProduct({
    ...identical(),
    incoming: shopifyProduct({ description: '   ' }),
    existing: existingProduct({ description: null }),
  })

  expect(candidate.status).toBe('unchanged')
})

test('a real description arriving where none was stored is still a change', () => {
  const candidate = diffProduct({
    ...identical(),
    incoming: shopifyProduct({ description: 'Floral and citrus-forward single origin.' }),
    existing: existingProduct({ description: null }),
  })

  // The mirror of the two tests above: normalisation must not swallow a genuine
  // null -> value transition, or the traps would be "fixed" by making the
  // classifier blind.
  expect(candidate.status).toBe('changed')
  expect(candidate.diffs).toEqual([
    {
      field: 'description',
      current: null,
      incoming: 'Floral and citrus-forward single origin.',
    },
  ])
})

// ── Exclusion is presentation, not classification ───────────────────────────

test('an excluded product still classifies on its own merits', () => {
  const candidate = diffProduct({
    ...identical(),
    existing: null,
    existingVariants: [],
    excluded: true,
  })

  // Exclusion decides which GROUP it renders in, never what it is. Folding it
  // into status is what would break AC7 — an ignored product must stay
  // reachable and re-importable, which needs its real classification intact.
  expect(candidate.status).toBe('new')
  expect(candidate.excluded).toBe(true)
})

// ── AC6a: which declines are remembered ─────────────────────────────────────

/**
 * The single most load-bearing rule in the feature, and the one whose absence
 * is unrecoverable: writing an exclusion for a CHANGED product leaves an in-use
 * catalogue item invisible to the sync that maintains it. Nothing tested this
 * directly before — the e2e only ever declines a NEW product, so deleting the
 * status filter entirely would have kept the suite green.
 */
const statuses = (entries: Record<string, SyncStatus>) =>
  new Map(Object.entries(entries)) as Map<string, SyncStatus>

test('a declined NEW product is remembered', () => {
  expect(exclusionsToRecord(['a'], statuses({ a: 'new' }))).toEqual(['a'])
})

test('a declined CHANGED product is NOT remembered — that means skip the update', () => {
  expect(exclusionsToRecord(['a'], statuses({ a: 'changed' }))).toEqual([])
})

test('a declined UNCHANGED product is NOT remembered', () => {
  expect(exclusionsToRecord(['a'], statuses({ a: 'unchanged' }))).toEqual([])
})

test('a mixed decline keeps only the new ones, in order', () => {
  const declined = ['keep1', 'skip-changed', 'keep2', 'skip-unchanged']
  expect(
    exclusionsToRecord(
      declined,
      statuses({
        keep1: 'new',
        'skip-changed': 'changed',
        keep2: 'new',
        'skip-unchanged': 'unchanged',
      })
    )
  ).toEqual(['keep1', 'keep2'])
})

test('an id the server never classified is not remembered', () => {
  // The client can post arbitrary ids. One the server's own re-diff never saw
  // has no status, and an unknown id must never become an exclusion.
  expect(exclusionsToRecord(['ghost'], statuses({ a: 'new' }))).toEqual([])
})

test('declining nothing writes nothing', () => {
  expect(exclusionsToRecord([], statuses({ a: 'new' }))).toEqual([])
})

test('a product with no variants at all does not throw', () => {
  const candidate = diffProduct({
    incoming: shopifyProduct(),
    incomingVariants: [],
    existing: existingProduct({ sku: null, price: null }),
    existingVariants: [],
  })

  expect(candidate.status).toBe('unchanged')
})

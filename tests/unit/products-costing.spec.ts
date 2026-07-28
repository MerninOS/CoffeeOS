import { test, expect } from '@playwright/test'
import {
  buildProductLookup,
  costBasis,
  backfillCostingMode,
  type CostableProduct,
  type CostableVariant,
} from '../../lib/products/costing'

/**
 * The product/variant precedence rule, which `/orders` and `/products` must both
 * consume rather than each implementing (CoffeeOS#69). These run with no browser
 * and no server — see playwright.unit.config.ts.
 *
 * The fixture below carries ALL FOUR cost bases on purpose. Spec Criteria 7 and 8
 * are vacuous against a fixture where every product has exactly one basis, so the
 * first test asserts the fixture itself.
 */

const comp = (cost: number) => ({ cost_per_unit: cost })

/** Supabase types a many-to-one relation as an ARRAY. Both shapes appear at
 *  runtime, so the fixture uses both to keep the normalisation honest. */
const row = (quantity: number, cost: number, asArray = false) => ({
  quantity,
  components: asArray ? [comp(cost)] : comp(cost),
})

const PRODUCT_ONLY: CostableProduct = {
  id: 'p-product-only',
  title: 'Colombia Huila Decaf',
  product_components: [row(1, 4.85), row(1, 2.17, true)],
}

const VARIANT_ONLY: CostableProduct = {
  id: 'p-variant-only',
  title: 'Ethiopia Yirgacheffe',
  product_components: [],
}

const BOTH: CostableProduct = {
  id: 'p-both',
  title: 'House Blend',
  product_components: [row(1, 6.05)],
}

const NEITHER: CostableProduct = {
  id: 'p-neither',
  title: 'Kenya Nyeri AA',
  product_components: [],
}

const FREE: CostableProduct = {
  id: 'p-free',
  title: 'Reserve Your Bottle!',
  product_components: [row(1, 0)],
}

const DISAGREE: CostableProduct = {
  id: 'p-disagree',
  title: 'Sumatra Mandheling',
  product_components: [],
}

const PARTIAL: CostableProduct = {
  id: 'p-partial',
  title: 'Costa Rica Tarrazu',
  product_components: [],
}

const PRODUCTS = [
  PRODUCT_ONLY, VARIANT_ONLY, BOTH, NEITHER, FREE, DISAGREE, PARTIAL,
]

const VARIANTS: CostableVariant[] = [
  // agrees with itself — one variant, costed
  { id: 'v-1', product_id: 'p-variant-only', product_variant_components: [row(1, 6.41)] },
  { id: 'v-2', product_id: 'p-variant-only', product_variant_components: [row(1, 6.41)] },
  // both bases: product-level must win
  { id: 'v-3', product_id: 'p-both', product_variant_components: [row(1, 13.466)] },
  // two variants at different costs
  { id: 'v-4', product_id: 'p-disagree', product_variant_components: [row(1, 6.41)] },
  { id: 'v-5', product_id: 'p-disagree', product_variant_components: [row(1, 13.46)] },
  // one costed, one with no rows at all
  { id: 'v-6', product_id: 'p-partial', product_variant_components: [row(1, 6.41)] },
  { id: 'v-7', product_id: 'p-partial', product_variant_components: [] },
]

test.describe('the fixture itself', () => {
  test('covers all four cost bases, or Criteria 7 and 8 assert nothing', () => {
    const seen = new Set(PRODUCTS.map((p) => costBasis(p, VARIANTS)))
    expect(seen).toEqual(new Set(['product', 'variant', 'both', 'none']))
  })
})

test.describe('costBasis — which rows exist', () => {
  test('product rows only', () => {
    expect(costBasis(PRODUCT_ONLY, VARIANTS)).toBe('product')
  })

  test('variant rows only', () => {
    expect(costBasis(VARIANT_ONLY, VARIANTS)).toBe('variant')
  })

  test('both', () => {
    expect(costBasis(BOTH, VARIANTS)).toBe('both')
  })

  test('neither', () => {
    expect(costBasis(NEITHER, VARIANTS)).toBe('none')
  })

  test('a variant carrying an EMPTY row set does not count as a variant basis', () => {
    // v-7 has product_variant_components: []. Storage-wise that is no recipe.
    // Were this counted, a product could report basis 'variant' while having
    // nothing to cost from.
    const onlyEmpty: CostableVariant[] = [
      { id: 'v-x', product_id: 'p-neither', product_variant_components: [] },
    ]
    expect(costBasis(NEITHER, onlyEmpty)).toBe('none')
  })
})

test.describe('backfillCostingMode — the 023 migration rule', () => {
  test("variant rows and no product rows -> 'variant'", () => {
    expect(backfillCostingMode('variant')).toBe('variant')
  })

  test("product rows -> 'product'", () => {
    expect(backfillCostingMode('product')).toBe('product')
  })

  test("both bases -> 'product', which is what buildProductLookup already bills", () => {
    // This is the case that makes the migration figure-preserving. If it
    // backfilled 'variant', every both-bases product would re-cost the moment
    // anything trusted the column.
    expect(backfillCostingMode('both')).toBe('product')
    const lookup = buildProductLookup([BOTH], VARIANTS)
    expect(lookup['p-both'].cogs).toBeCloseTo(6.05, 6)
  })

  test("no recipe at all -> 'product', so a first recipe is written at product level", () => {
    expect(backfillCostingMode('none')).toBe('product')
  })
})

test.describe('buildProductLookup — what is billed', () => {
  const lookup = buildProductLookup(PRODUCTS, VARIANTS)

  test('every owned product gets an entry, including uncosted ones', () => {
    // Absence means "this product row no longer exists"; present-with-0 means
    // "exists but has no recipe". Merging them breaks classifyOrder's ability to
    // tell a deleted product from an uncosted one.
    for (const p of PRODUCTS) expect(lookup[p.id]).toBeDefined()
    expect(lookup['p-neither']).toEqual({
      title: 'Kenya Nyeri AA',
      cogs: 0,
      hasRecipe: false,
    })
  })

  test('product level wins where both exist', () => {
    expect(lookup['p-both'].cogs).toBeCloseTo(6.05, 6)
    expect(lookup['p-both'].cogs).not.toBeCloseTo(13.466, 6)
    expect(lookup['p-both'].hasRecipe).toBe(true)
  })

  test('a variant-only product is costed from its agreed variant figure', () => {
    expect(lookup['p-variant-only'].cogs).toBeCloseTo(6.41, 6)
    expect(lookup['p-variant-only'].hasRecipe).toBe(true)
  })

  test('a product costed at exactly zero is COSTED, not uncosted', () => {
    // Criterion 2. A comp, a sample, a $0 deposit SKU. Testing `cogs > 0` would
    // tell the operator forever to add components they have already added.
    expect(lookup['p-free']).toEqual({
      title: 'Reserve Your Bottle!',
      cogs: 0,
      hasRecipe: true,
    })
  })

  test('variants that disagree make the product uncosted, never averaged', () => {
    // Criterion 3. The current /products list averages these into one
    // plausible-looking number; /orders drops the product from margin. This is
    // the disagreement CoffeeOS#69 exists to remove.
    expect(lookup['p-disagree'].hasRecipe).toBe(false)
    expect(lookup['p-disagree'].cogs).toBe(0)
    expect(lookup['p-disagree'].cogs).not.toBeCloseTo((6.41 + 13.46) / 2, 2)
  })

  test('one empty variant poisons the whole product', () => {
    // Criterion 3, second half. Three carefully costed variants and one empty
    // one is still unknowable: the cost depends on which variant sold, and
    // order_line_items.shopify_variant_id is null for 432 of 436 rows.
    expect(lookup['p-partial'].hasRecipe).toBe(false)
    expect(lookup['p-partial'].cogs).toBe(0)
  })

  test('the array-vs-object relation shape is normalised, not asserted', () => {
    // PRODUCT_ONLY mixes both shapes. 1×4.85 + 1×2.17 = 7.02 either way.
    expect(lookup['p-product-only'].cogs).toBeCloseTo(7.02, 6)
  })

  test('null and empty inputs do not throw', () => {
    expect(buildProductLookup(null, null)).toEqual({})
    expect(buildProductLookup([], [])).toEqual({})
    expect(buildProductLookup([NEITHER], null)['p-neither'].hasRecipe).toBe(false)
  })

  test('a missing title falls back rather than rendering "undefined"', () => {
    const untitled = buildProductLookup(
      [{ id: 'p-x', title: null, product_components: [] }],
      [],
    )
    expect(untitled['p-x'].title).toBe('Untitled product')
  })
})

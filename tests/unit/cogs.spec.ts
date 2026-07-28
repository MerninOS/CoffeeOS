import { test, expect } from '@playwright/test'
import {
  classifyOrder,
  aggregate,
  type ProductLookup,
} from '../../lib/orders/cogs'

/**
 * `classifyOrder` decides which orders are allowed to move the margin figure, so
 * every branch here is load-bearing. These run with no browser and no server —
 * see playwright.unit.config.ts.
 */

const PRODUCTS: ProductLookup = {
  'p-guji': { title: 'Ethiopia Guji Light Roast', cogs: 11.9621825, hasRecipe: true },
  'p-dayglow': { title: 'DayGlow Brazil Medium Roast', cogs: 0, hasRecipe: false },
  'p-goldilocks': { title: 'Goldilocks Chilled Espresso Concentrate', cogs: 0, hasRecipe: false },
  // Costed, and the cost is genuinely zero — a comp, a sample, a $0 deposit SKU.
  // One product on production is in exactly this state.
  'p-free': { title: 'Reserve Your Bottle!', cogs: 0, hasRecipe: true },
}

const item = (product_id: string | null, title = 'x', quantity = 1) => ({
  product_id,
  quantity,
  title,
})

test.describe('classifyOrder', () => {
  test('an order with no line items is unlinked, never costed', () => {
    // The vacuous-truth guard. "Every line item resolves to > 0" is TRUE for an
    // empty array, so without the early return this classifies `costed` and the
    // order enters the aggregate at 100% margin — the defect this work removes.
    // Three such orders exist in production.
    expect(classifyOrder({ order_line_items: [] }, PRODUCTS)).toEqual({
      status: 'unlinked',
      unresolvable: [],
    })
  })

  test('a null line item collection is unlinked, never costed', () => {
    expect(classifyOrder({ order_line_items: null }, PRODUCTS).status).toBe('unlinked')
    expect(classifyOrder({}, PRODUCTS).status).toBe('unlinked')
  })

  test('every line item resolving above zero is costed', () => {
    expect(
      classifyOrder({ order_line_items: [item('p-guji'), item('p-guji')] }, PRODUCTS)
    ).toEqual({ status: 'costed' })
  })

  test('a line item with no product_id is unlinked and reports its title', () => {
    const result = classifyOrder(
      { order_line_items: [item('p-guji'), item(null, 'Sunrise Blend')] },
      PRODUCTS
    )
    expect(result).toEqual({ status: 'unlinked', unresolvable: ['Sunrise Blend'] })
  })

  test('a product_id absent from the lookup is unlinked, not uncosted', () => {
    // A product row that no longer exists. Distinguishable from "exists but has
    // no recipe" ONLY because the lookup holds an entry for every owned product,
    // including a 0 for uncosted ones.
    const result = classifyOrder(
      { order_line_items: [item('p-deleted', 'Austin Blend')] },
      PRODUCTS
    )
    expect(result).toEqual({ status: 'unlinked', unresolvable: ['Austin Blend'] })
  })

  test('a linked product with no recipe is uncosted and names the blocker', () => {
    // Order #1304 on production: one costed item beside one with no recipe.
    const result = classifyOrder(
      { order_line_items: [item('p-guji'), item('p-dayglow')] },
      PRODUCTS
    )
    expect(result).toEqual({
      status: 'uncosted',
      blocking: [{ id: 'p-dayglow', title: 'DayGlow Brazil Medium Roast' }],
    })
  })

  test('unlinked outranks uncosted when an order has both', () => {
    // Such an order is unrepairable, so it must not be badged with a link
    // implying that costing a product will fix it.
    const result = classifyOrder(
      { order_line_items: [item('p-dayglow'), item(null, 'Cowboy Blend')] },
      PRODUCTS
    )
    expect(result.status).toBe('unlinked')
  })

  test('two items blocked by the same product report it once', () => {
    const result = classifyOrder(
      { order_line_items: [item('p-dayglow'), item('p-dayglow')] },
      PRODUCTS
    )
    expect(result).toEqual({
      status: 'uncosted',
      blocking: [{ id: 'p-dayglow', title: 'DayGlow Brazil Medium Roast' }],
    })
  })

  test('distinct blockers are all reported', () => {
    const result = classifyOrder(
      { order_line_items: [item('p-dayglow'), item('p-goldilocks')] },
      PRODUCTS
    )
    expect(result.status).toBe('uncosted')
    expect(
      result.status === 'uncosted' ? result.blocking.map((b) => b.id).sort() : []
    ).toEqual(['p-dayglow', 'p-goldilocks'])
  })

  test('a negative cost is treated as unknown, not as a discount', () => {
    const result = classifyOrder({ order_line_items: [item('p-neg')] }, {
      ...PRODUCTS,
      'p-neg': { title: 'Bad Data', cogs: -5, hasRecipe: true },
    })
    expect(result.status).toBe('uncosted')
  })

  test('a product costed at exactly zero is COSTED, not uncosted', () => {
    // The trap this guards: testing `cogs <= 0` conflates "cost unknown" with
    // "cost is zero". An operator who attaches zero-cost components has done the
    // work, and the old rule kept telling them to "add components" forever —
    // with no representable value meaning "this really is free" short of
    // inventing a cost, which corrupts the figure the page exists to protect.
    expect(classifyOrder({ order_line_items: [item('p-free')] }, PRODUCTS)).toEqual({
      status: 'costed',
    })
  })

  test('a zero-cost product contributes revenue and no cost to the aggregate', () => {
    const result = aggregate(
      [{ total_price: 25, order_line_items: [item('p-free')] }],
      PRODUCTS
    )
    expect(result.revenue).toBeCloseTo(25, 2)
    expect(result.cogs).toBeCloseTo(0, 2)
    expect(result.excludedUncosted).toBe(0)
  })
})

test.describe('aggregate', () => {
  const costed = {
    total_price: 100,
    order_line_items: [item('p-guji')],
  }
  const uncosted = {
    total_price: 43,
    order_line_items: [item('p-guji'), item('p-dayglow')],
  }
  const unlinked = {
    total_price: 900,
    order_line_items: [item(null, 'Sunrise Blend')],
  }

  test('only costed orders move revenue, cogs and margin', () => {
    const result = aggregate([costed, uncosted, unlinked], PRODUCTS)

    // Exact figures, not "not equal to the naive value" — a range assertion
    // passes for any wrong number. See orders-capabilities.spec.ts:59 for why
    // lenient assertions silently read a sentinel as 0 and pass.
    expect(result.revenue).toBeCloseTo(100, 2)
    expect(result.cogs).toBeCloseTo(11.9621825, 4)
    expect(result.profit).toBeCloseTo(88.0378175, 4)
    expect(result.margin).toBeCloseTo(88.0378175, 4)
  })

  test('the denominator covers every order, so the label can be honest', () => {
    const result = aggregate([costed, uncosted, unlinked], PRODUCTS)
    expect(result.totalRevenue).toBeCloseTo(1043, 2)
    expect(result.excludedUncosted).toBe(1)
    expect(result.excludedUnlinked).toBe(1)
  })

  test('a period with nothing excluded reports covered === total', () => {
    const result = aggregate([costed], PRODUCTS)
    expect(result.revenue).toBeCloseTo(result.totalRevenue, 2)
    expect(result.excludedUnlinked + result.excludedUncosted).toBe(0)
  })

  test('a period with nothing costed reports zero margin, not NaN', () => {
    const result = aggregate([unlinked], PRODUCTS)
    expect(result.revenue).toBe(0)
    expect(result.margin).toBe(0)
    expect(Number.isNaN(result.margin)).toBe(false)
    expect(result.totalRevenue).toBeCloseTo(900, 2)
  })

  test('an empty period does not divide by zero', () => {
    const result = aggregate([], PRODUCTS)
    expect(result.margin).toBe(0)
    expect(result.totalRevenue).toBe(0)
  })
})

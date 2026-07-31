import { test, expect } from '@playwright/test'
import { buildProductLookup } from '../../lib/products/costing'
import { classifyOrder, getOrderCogs, type ProductLookup } from '../../lib/orders/cogs'
import { cogsLabel, mayShowMargin } from '../../lib/orders/format'

/**
 * What /orders/[id] must compute, and what it must refuse to compute.
 *
 * The fixtures are not invented. ORDER_1312 mirrors the shape of the order
 * CoffeeOS#100 opens with, measured against production on 2026-07-30:
 *
 *   product-level recipe rows   0
 *   variant-level recipe        $16.4213  (1 variant, 5 component rows)
 *   order components            $5.3362
 *   custom costs                $5.8900
 *
 * Which reproduces both numbers in the issue exactly:
 *
 *   reading product recipes only   0 + 5.3362 + 5.8900 = $11.23   <- the bug
 *   reading variant recipes too   16.4213 + ...        = $27.65   <- the truth
 *
 * That the product has NO product-level rows is the whole point. A fixture with
 * recipes at both levels passes whether or not variant costs are read, which is
 * the defect itself — see the guard test below.
 */

const cost = (n: number) => ({ cost_per_unit: n })

/** #1312's product: variant-only recipe, nothing at product level. */
const PRODUCTS_1312 = [{ id: 'p-goldilocks', title: 'Goldilocks Chilled Espresso Concentrate', product_components: [] }]
const VARIANTS_1312 = [{
  id: 'v-1', product_id: 'p-goldilocks',
  product_variant_components: [
    { quantity: 1, components: cost(9.2013) },
    { quantity: 1, components: cost(3.11) },
    { quantity: 1, components: cost(2.05) },
    { quantity: 1, components: cost(1.4) },
    { quantity: 1, components: cost(0.66) },
  ],
}]

const ORDER_1312 = {
  total_price: 33.99,
  order_line_items: [{ product_id: 'p-goldilocks', quantity: 1, title: 'Goldilocks Chilled Espresso Concentrate' }],
  order_components: [{ quantity: 1, components: cost(5.3362) }],
  order_custom_costs: [{ amount: 5.89 }],
}

const money = (n: number) => Number(n.toFixed(2))

test.describe('the figures', () => {
  test('a variant-only recipe is costed — the defect CoffeeOS#100 fixes', () => {
    const lookup = buildProductLookup(PRODUCTS_1312, VARIANTS_1312)
    expect(lookup['p-goldilocks'].hasRecipe).toBe(true)
    expect(money(lookup['p-goldilocks'].cogs)).toBe(16.42)
    expect(money(getOrderCogs(ORDER_1312, lookup))).toBe(27.65)
  })

  /**
   * The guard that makes the test above mean something.
   *
   * Reading only product-level recipes reproduces the exact figure the broken
   * page displayed. If a future change regresses to product-only resolution,
   * the test above fails and this one documents what it will fail to.
   */
  test('reading product-level recipes alone reproduces the old wrong $11.23', () => {
    const productOnly = buildProductLookup(PRODUCTS_1312, [])
    expect(productOnly['p-goldilocks'].hasRecipe).toBe(false)
    expect(money(getOrderCogs(ORDER_1312, productOnly))).toBe(11.23)
  })

  test('order components and custom costs are both in the total', () => {
    const lookup = buildProductLookup(PRODUCTS_1312, VARIANTS_1312)
    const withoutExtras = { ...ORDER_1312, order_components: [], order_custom_costs: [] }
    expect(money(getOrderCogs(withoutExtras, lookup))).toBe(16.42)
  })
})

test.describe('the verdict', () => {
  test('#1312 is costed, so a margin may be shown', () => {
    const lookup = buildProductLookup(PRODUCTS_1312, VARIANTS_1312)
    const verdict = classifyOrder(ORDER_1312, lookup)
    expect(verdict.status).toBe('costed')
    expect(mayShowMargin(verdict.status)).toBe(true)
  })

  test('an item resolving to no product is unlinked, and no margin may be shown', () => {
    const lookup = buildProductLookup(PRODUCTS_1312, VARIANTS_1312)
    const order = {
      ...ORDER_1312,
      order_line_items: [
        ...ORDER_1312.order_line_items,
        { product_id: null, quantity: 1, title: 'Sunrise Blend (discontinued)' },
      ],
    }
    const verdict = classifyOrder(order, lookup)
    expect(verdict.status).toBe('unlinked')
    expect(mayShowMargin(verdict.status)).toBe(false)
  })

  test('unlinked outranks uncosted, so the copy never implies costing would fix it', () => {
    const lookup = buildProductLookup(
      [...PRODUCTS_1312, { id: 'p-norecipe', title: 'Guatemala Huehuetenango 12oz', product_components: [] }],
      VARIANTS_1312,
    )
    const order = {
      ...ORDER_1312,
      order_line_items: [
        { product_id: 'p-norecipe', quantity: 1, title: 'Guatemala Huehuetenango 12oz' },
        { product_id: null, quantity: 1, title: 'Sunrise Blend (discontinued)' },
      ],
    }
    expect(classifyOrder(order, lookup).status).toBe('unlinked')
  })

  /** Variants that disagree are not a cost — see buildProductLookup's rule. */
  test('a product whose variants disagree is uncosted, not averaged', () => {
    const lookup = buildProductLookup(
      [{ id: 'p-split', title: 'Split', product_components: [] }],
      [
        { id: 'v-a', product_id: 'p-split', product_variant_components: [{ quantity: 1, components: cost(4) }] },
        { id: 'v-b', product_id: 'p-split', product_variant_components: [{ quantity: 1, components: cost(9) }] },
      ],
    )
    expect(lookup['p-split'].hasRecipe).toBe(false)
    const order = { total_price: 20, order_line_items: [{ product_id: 'p-split', quantity: 1 }] }
    expect(classifyOrder(order, lookup).status).toBe('uncosted')
  })
})

test.describe('how COGS is written down', () => {
  /**
   * Criterion 9's two fixtures. They must differ in whether order-level cost
   * exists, INDEPENDENTLY of costability — a single uncostable-and-zero fixture
   * passes under either rule and tests nothing.
   *
   * Synthetic on purpose: measured 2026-07-30, zero production orders are
   * uncostable AND carry order-level cost, so a fixture lifted from real data
   * would only ever exercise the `not set` branch.
   */
  const emptyLookup: ProductLookup = {}

  test('uncostable WITH order-level cost shows the partial figure, not "not set"', () => {
    const order = {
      total_price: 43,
      order_line_items: [{ product_id: null, quantity: 1, title: 'Mystery item' }],
      order_components: [{ quantity: 2, components: cost(0.42) }],
      order_custom_costs: [{ amount: 11.3 }],
    }
    const verdict = classifyOrder(order, emptyLookup)
    const cogs = getOrderCogs(order, emptyLookup)
    expect(verdict.status).not.toBe('costed')
    expect(money(cogs)).toBe(12.14)
    expect(cogsLabel(cogs, mayShowMargin(verdict.status))).toBe('−$12.14')
  })

  test('uncostable with NO cost at all shows "not set"', () => {
    const order = {
      total_price: 31,
      order_line_items: [{ product_id: null, quantity: 1, title: 'Mystery item' }],
      order_components: [],
      order_custom_costs: [],
    }
    const verdict = classifyOrder(order, emptyLookup)
    expect(cogsLabel(getOrderCogs(order, emptyLookup), mayShowMargin(verdict.status))).toBe('not set')
  })

  /**
   * CoffeeOS#68. A product costed entirely from zero-cost components really is
   * $0.00 — the operator did the work. Calling that "not set" tells them to redo
   * it, and there is no other way to express a genuinely free item.
   */
  test('a costed order totalling $0.00 shows $0.00, never "not set"', () => {
    const lookup = buildProductLookup(
      [{ id: 'p-free', title: 'Promo insert', product_components: [{ quantity: 1, components: cost(0) }] }],
      [],
    )
    expect(lookup['p-free'].hasRecipe).toBe(true)
    const order = { total_price: 0, order_line_items: [{ product_id: 'p-free', quantity: 1 }] }
    const verdict = classifyOrder(order, lookup)
    expect(verdict.status).toBe('costed')
    expect(cogsLabel(getOrderCogs(order, lookup), mayShowMargin(verdict.status))).toBe('−$0.00')
  })
})

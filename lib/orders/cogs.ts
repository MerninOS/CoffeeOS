/**
 * The costing math for an order, extracted so the server-side range aggregate
 * and the per-row display cannot disagree.
 *
 * These were inline closures in orders-client.tsx (over `productCogsMap`).
 * Keeping ONE implementation is the reason the range aggregate is computed in
 * TypeScript rather than SQL: a Postgres version would put the same formula in
 * a second language with nothing to catch it drifting.
 *
 * The `|| 0` and `|| []` guards are deliberate — this data genuinely has nulls.
 * See CoffeeOS#59 (type drift) and the null `fulfillment_status` crash already
 * fixed on the orders page.
 */

/**
 * Products the owner actually has, carrying the title as well as the cost.
 *
 * Replaced a bare `Record<string, number>`, which could not support the
 * excluded-row badge: that badge has to NAME the product blocking an order, and
 * an id-to-cost map has no name in it. The title is the product's CURRENT title,
 * never `order_line_items.title` — the line item carries the historical name from
 * the order, and sending an operator to fix "Mexico Veracruz" when /products lists
 * "Mexico Veracruz Medium Roast" is the exact confusion CoffeeOS#78 documents.
 *
 * Absence from this lookup is meaningful: it is how a line item pointing at a
 * product row that no longer exists is told apart from one pointing at a product
 * that exists but has no recipe. The builder must therefore write an entry for
 * EVERY owned product, including a 0 for uncosted ones.
 */
export type ProductLookup = Record<
  string,
  {
    title: string
    cogs: number
    /**
     * Whether the product has ANY component rows — which is not the same
     * question as whether `cogs` is above zero.
     *
     * A product costed entirely from zero-cost components totals 0, and testing
     * `cogs <= 0` would call that uncosted forever: the operator has done the
     * work, and the UI would still tell them to "add components". There is no
     * other way to express "this really is free" — a comp, a sample, a $0
     * deposit SKU, a promo insert — so without this flag the only escape is
     * inventing a cost, which corrupts the very figure this page exists to make
     * trustworthy. One product on production is in exactly this state.
     */
    hasRecipe: boolean
  }
>

export interface CogsLineItem {
  product_id: string | null
  quantity: number
}

/** A line item as the classifier sees it — it needs the title to report an
 *  unresolvable item, which the pure-cost path never required. */
export interface ClassifiableLineItem extends CogsLineItem {
  title?: string | null
}

export interface ClassifiableOrder {
  order_line_items?: ClassifiableLineItem[] | null
}

/**
 * Why an order's margin cannot be trusted, and what would fix it.
 *
 * Carries the blocking entity rather than a bare enum: the row badge has to name
 * it, and re-deriving that in the component would give the row and the aggregate
 * two chances to disagree about why an order was dropped — the drift this module
 * was extracted to prevent.
 */
export type OrderCostability =
  | { status: 'costed' }
  | { status: 'unlinked'; unresolvable: string[] }
  | { status: 'uncosted'; blocking: { id: string; title: string }[] }

/**
 * Classify an order by whether its cost is knowable.
 *
 * The rule order IS the specification:
 *
 *   1. NO LINE ITEMS → unlinked. This guard is not defensive padding. The rule
 *      "every line item resolves to > 0" is VACUOUSLY TRUE for an empty array, so
 *      without it such an order classifies `costed`, enters the aggregate with
 *      full revenue and zero cost, and reports 100% margin — precisely the defect
 *      this module exists to remove, reintroduced by its own fix. Three such
 *      orders exist in production today (none on the account the spec measured,
 *      which is why it missed them).
 *
 *   2. Any line item with no `product_id`, or a `product_id` absent from the
 *      lookup, → unlinked. This OUTRANKS uncosted: an order with both problems is
 *      unrepairable, and must never be badged with a link implying that costing a
 *      product will fix it.
 *
 *   3. Every line item linked but any resolving to <= 0 → uncosted, naming the
 *      distinct products responsible.
 *
 *   4. Otherwise costed.
 */
export function classifyOrder(
  order: ClassifiableOrder,
  products: ProductLookup
): OrderCostability {
  const items = order.order_line_items || []

  // Rule 1 — see above. An order with nothing in it resolves to no product, so
  // `unlinked` is literally true; it also gets the branch that renders no link,
  // which is correct because there is no product to navigate to.
  if (items.length === 0) return { status: 'unlinked', unresolvable: [] }

  const unresolvable: string[] = []
  const blocking = new Map<string, { id: string; title: string }>()

  for (const item of items) {
    const product = item.product_id ? products[item.product_id] : undefined
    if (!product) {
        // `title` is DISPLAY-ONLY and is deliberately absent from the range
      // aggregate's narrower query shape, where this fills with placeholders
      // that `aggregate` then discards. Classification never reads it, so the
      // two shapes cannot disagree — do not "fix" the range query by selecting
      // titles it has no use for, on every row of an unpaginated result.
      unresolvable.push(item.title || 'Untitled item')
      continue
    }
    // Missing a recipe is what makes cost UNKNOWN. A recipe that totals zero is
    // a known cost that happens to be zero, and must not be treated the same —
    // see the `hasRecipe` note on ProductLookup.
    //
    // A NEGATIVE total is still untrustworthy: it cannot be a real cost, and
    // silently summing it would understate COGS.
    if (!product.hasRecipe || product.cogs < 0) {
      blocking.set(item.product_id!, { id: item.product_id!, title: product.title })
    }
  }

  // Rule 2 — precedence.
  if (unresolvable.length > 0) return { status: 'unlinked', unresolvable }
  if (blocking.size > 0) return { status: 'uncosted', blocking: [...blocking.values()] }
  return { status: 'costed' }
}

/**
 * Supabase types a nested relation as an ARRAY even when it is many-to-one, so
 * `components` arrives typed `{cost_per_unit}[]` while at runtime it is a single
 * object. The existing page casts it (`as {cost_per_unit: number} | null`) —
 * a cast that is simply untrue to the type.
 *
 * Accept both shapes and normalise instead, so this module is honest about what
 * it can actually receive and does not depend on a lie holding.
 */
export type CogsComponentRef =
  | { cost_per_unit: number | null }
  | { cost_per_unit: number | null }[]
  | null

export interface CogsOrderComponent {
  quantity: number
  components: CogsComponentRef
}

function costPerUnit(ref: CogsComponentRef): number {
  if (!ref) return 0
  const one = Array.isArray(ref) ? ref[0] : ref
  return one?.cost_per_unit || 0
}

export interface CogsCustomCost {
  amount: number
}

export interface CostableOrder {
  total_price: number | null
  /**
   * Null means the fee is not yet known (pre-feature order, unpaid order) —
   * a different fact from a known $0 fee on a free order. Costing treats
   * null as 0 (the fee is bounded and small, unlike an unknown recipe, so
   * it never excludes an order from the aggregate); the UI badges it.
   * See migration 028 / CoffeeOS#133.
   */
  total_processing_fee?: number | null
  processing_fee_source?: string | null
  order_line_items?: CogsLineItem[] | null
  order_components?: CogsOrderComponent[] | null
  order_custom_costs?: CogsCustomCost[] | null
}

export function getProcessingFee(order: CostableOrder): number {
  return order.total_processing_fee || 0
}

export function getLineItemCogs(item: CogsLineItem, products: ProductLookup): number {
  if (!item.product_id) return 0
  return (products[item.product_id]?.cogs || 0) * item.quantity
}

export function getOrderComponentsCogs(order: CostableOrder): number {
  return (order.order_components || []).reduce(
    (sum, oc) => sum + costPerUnit(oc.components) * oc.quantity,
    0
  )
}

export function getOrderCustomCostsTotal(order: CostableOrder): number {
  return (order.order_custom_costs || []).reduce((sum, cc) => sum + cc.amount, 0)
}

export function getTotalAdditionalCosts(order: CostableOrder): number {
  return getOrderComponentsCogs(order) + getOrderCustomCostsTotal(order)
}

export function getOrderLineItemsCogs(order: CostableOrder, products: ProductLookup): number {
  return (order.order_line_items || []).reduce(
    (sum, item) => sum + getLineItemCogs(item, products),
    0
  )
}

export function getOrderCogs(order: CostableOrder, products: ProductLookup): number {
  // The processing fee is a third cost lane, deliberately NOT folded into
  // getTotalAdditionalCosts: that accessor backs the operator-entered costs
  // concept (components + custom costs), and the fee is a platform cost the
  // operator never enters. Lumping them would make the "additional costs"
  // figure disagree with what the operator can see and edit.
  return (
    getOrderLineItemsCogs(order, products) +
    getTotalAdditionalCosts(order) +
    getProcessingFee(order)
  )
}


/**
 * Range aggregate.
 *
 * MUST be fed every order in the period, never one page of them. Summing a
 * paginated result silently under-reports and looks entirely plausible —
 * spec Criterion 5 exists to catch exactly that.
 */
export function aggregate(orders: CostableOrder[], products: ProductLookup) {
  // Partition BEFORE summing. An order whose cost is unknown contributes full
  // revenue and zero cost, which reads as 100% profit — on production this took
  // the margin figure across 309 orders when only 44 were costed.
  const costed: CostableOrder[] = []
  let excludedUnlinked = 0
  let excludedUncosted = 0

  for (const order of orders) {
    const { status } = classifyOrder(order as ClassifiableOrder, products)
    if (status === 'costed') costed.push(order)
    else if (status === 'unlinked') excludedUnlinked++
    else excludedUncosted++
  }

  const revenue = costed.reduce((sum, o) => sum + (o.total_price || 0), 0)
  const cogs = costed.reduce((sum, o) => sum + getOrderCogs(o, products), 0)
  const profit = revenue - cogs

  return {
    revenue,
    cogs,
    profit,
    margin: revenue > 0 ? (profit / revenue) * 100 : 0,

    // Returned, not left to the caller, so a figure cannot be rendered without
    // the scope that produced it. `revenue` above covers the costed subset only;
    // any copy naming the period has to read THIS.
    totalRevenue: orders.reduce((sum, o) => sum + (o.total_price || 0), 0),
    excludedUnlinked,
    excludedUncosted,
  }
}

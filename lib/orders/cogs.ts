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

export type ProductCogsMap = Record<string, number>

export interface CogsLineItem {
  product_id: string | null
  quantity: number
}

export interface CogsOrderComponent {
  quantity: number
  components: { cost_per_unit: number } | null
}

export interface CogsCustomCost {
  amount: number
}

export interface CostableOrder {
  total_price: number | null
  order_line_items?: CogsLineItem[] | null
  order_components?: CogsOrderComponent[] | null
  order_custom_costs?: CogsCustomCost[] | null
}

export function getLineItemCogs(item: CogsLineItem, map: ProductCogsMap): number {
  if (!item.product_id) return 0
  return (map[item.product_id] || 0) * item.quantity
}

export function getOrderComponentsCogs(order: CostableOrder): number {
  return (order.order_components || []).reduce(
    (sum, oc) => sum + (oc.components?.cost_per_unit || 0) * oc.quantity,
    0
  )
}

export function getOrderCustomCostsTotal(order: CostableOrder): number {
  return (order.order_custom_costs || []).reduce((sum, cc) => sum + cc.amount, 0)
}

export function getTotalAdditionalCosts(order: CostableOrder): number {
  return getOrderComponentsCogs(order) + getOrderCustomCostsTotal(order)
}

export function getOrderLineItemsCogs(order: CostableOrder, map: ProductCogsMap): number {
  return (order.order_line_items || []).reduce(
    (sum, item) => sum + getLineItemCogs(item, map),
    0
  )
}

export function getOrderCogs(order: CostableOrder, map: ProductCogsMap): number {
  return getOrderLineItemsCogs(order, map) + getTotalAdditionalCosts(order)
}

/** True when nothing in the order resolves to a product COGS — the case the
 *  page must surface, because it renders as pure profit. */
export function needsCogs(order: CostableOrder, map: ProductCogsMap): boolean {
  return getOrderLineItemsCogs(order, map) === 0
}

/**
 * Range aggregate.
 *
 * MUST be fed every order in the period, never one page of them. Summing a
 * paginated result silently under-reports and looks entirely plausible —
 * spec Criterion 5 exists to catch exactly that.
 */
export function aggregate(orders: CostableOrder[], map: ProductCogsMap) {
  const revenue = orders.reduce((sum, o) => sum + (o.total_price || 0), 0)
  const cogs = orders.reduce((sum, o) => sum + getOrderCogs(o, map), 0)
  const profit = revenue - cogs
  return {
    revenue,
    cogs,
    profit,
    margin: revenue > 0 ? (profit / revenue) * 100 : 0,
  }
}

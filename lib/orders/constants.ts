/**
 * Period presets and the page limit for /orders.
 *
 * There is deliberately no "All" option. The whole point of bounding this query
 * is that the page stopped loading a roaster's entire order history; an
 * unbounded preset would reintroduce that, merely moved from every page load to
 * one button. Lifetime figures belong in a reporting surface, not a list view.
 *
 * Four options also matches SegmentedControl's documented ≤4 cap, for when the
 * instrument rebuild (CoffeeOS#65) replaces the provisional control.
 */
export const PERIODS = [
  { value: '7', label: '7 days' },
  { value: '30', label: '30 days' },
  { value: '90', label: '90 days' },
  { value: '365', label: '1 year' },
] as const

export type PeriodValue = (typeof PERIODS)[number]['value']

export const DEFAULT_PERIOD: PeriodValue = '30'

/**
 * Exported rather than inlined in the `.limit()` call so tests can lower it.
 *
 * Criterion 5's fixture must contain MORE in-range orders than the limit — with
 * fewer, the page and the range are the same set and a broken implementation
 * passes identically to a correct one. Overriding this to 3 is far cheaper than
 * seeding 101 orders.
 */
export const ORDERS_PAGE_LIMIT = Number(process.env.ORDERS_PAGE_LIMIT ?? 100)

/**
 * `?period=` is user-editable, so an unrecognised value falls back to the
 * default rather than throwing — a 500 on `?period=banana` would be a
 * self-inflicted outage.
 */
export function resolvePeriod(raw: string | string[] | undefined): PeriodValue {
  const value = Array.isArray(raw) ? raw[0] : raw
  return PERIODS.some((p) => p.value === value)
    ? (value as PeriodValue)
    : DEFAULT_PERIOD
}

/** Start of the window, as an ISO string for `.gte("created_at_shopify", …)`. */
export function periodStartISO(period: PeriodValue, now: Date = new Date()): string {
  const start = new Date(now)
  start.setUTCDate(start.getUTCDate() - Number(period))
  return start.toISOString()
}

/**
 * How an order's COGS is written down once its costability is known.
 *
 * A pure function rather than a ternary inline in the page, so the unit test and
 * the UI share ONE implementation. A test that re-declares the rule passes while
 * the component drifts — which is the failure mode this whole ticket is about.
 */

/**
 * `not set` replaces the figure ONLY when there is genuinely nothing costed.
 *
 * An order can carry order components and custom costs while its products are
 * uncosted, and printing "not set" over a real $12.14 would be a lie — the
 * operator has costs, they are just not the whole picture. So: no cost at all →
 * "not set"; some cost but incomplete → the figure.
 *
 * This mirrors `OrdersWorksheetTable`'s rule exactly. The two surfaces showing
 * different COGS for the same order is the defect CoffeeOS#100 exists to close,
 * so this rule may not diverge from the list's without changing both.
 */
export function cogsLabel(cogs: number, costKnown: boolean): string {
  if (!costKnown && cogs === 0) return "not set";
  return `−$${cogs.toFixed(2)}`;
}

/**
 * Whether a margin/profit figure may be rendered at all.
 *
 * Deliberately not `cogs > 0` or any other proxy. Profit and margin are derived
 * wholly from the cost, so when the cost is unknown they are not uncertain —
 * they are invented. Only `classifyOrder`'s verdict may gate them.
 */
export function mayShowMargin(costabilityStatus: string): boolean {
  return costabilityStatus === "costed";
}

/**
 * How an order's costability is written down for an operator.
 *
 * Pure functions rather than ternaries inline in the page, so the unit tests and
 * the UI share ONE implementation. A test that re-declares the rule passes while
 * the component drifts — which is the failure mode this whole ticket is about.
 */

import type { OrderCostability } from "@/lib/orders/cogs";

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
 *
 * The sign moves with the value rather than being hard-coded. COGS is rendered
 * as a deduction, but the amount itself can be negative — `classifyOrder`
 * explicitly treats `product.cogs < 0` as a real state, and the add-cost handler
 * accepts a negative amount — and `−$` + `-5.00` prints the double-negated
 * `−$-5.00`.
 */
export function cogsLabel(cogs: number, costKnown: boolean): string {
  if (!costKnown && cogs === 0) return "not set";
  return `${cogs < 0 ? "+" : "−"}$${Math.abs(cogs).toFixed(2)}`;
}

/**
 * Whether a margin/profit figure may be rendered at all.
 *
 * Deliberately not `cogs > 0` or any other proxy. Profit and margin are derived
 * wholly from the cost, so when the cost is unknown they are not uncertain —
 * they are invented. Only `classifyOrder`'s verdict may gate them.
 *
 * Typed against the union rather than `string`: if `'costed'` is ever renamed,
 * this must fail to compile. Taking a bare `string` would keep compiling and
 * silently withhold every margin on the page, which is exactly the drift this
 * module exists to prevent. `OrdersWorksheetTable` compares against the real
 * union, so both surfaces are protected equally.
 */
export function mayShowMargin(status: OrderCostability["status"]): boolean {
  return status === "costed";
}

/**
 * What the operator would have to fix, named — or `null` when nothing is wrong.
 *
 * The two branches name different things on purpose. `uncosted` names the
 * blocking PRODUCT, whose title comes from the lookup (its CURRENT name, which
 * is where the operator has to go); sending them to fix "Mexico Veracruz" when
 * /products lists "Mexico Veracruz Medium Roast" is the confusion CoffeeOS#78
 * documents. `unlinked` can only name the LINE ITEM, because by definition no
 * product resolved and the historical name is the only name that exists.
 *
 * `unlinked` outranks `uncosted` in `classifyOrder`, so an order with both
 * problems never gets copy implying that costing a product would repair it.
 *
 * `cogs` is a parameter because the empty-line-items case cannot describe itself
 * from the classification alone — see below.
 */
export function blockingReason(
  costability: OrderCostability,
  cogs: number,
): string | null {
  if (costability.status === "costed") return null;

  if (costability.status === "uncosted") {
    const names = costability.blocking.map((b) => b.title).join(", ");
    return `${names} — no components assigned, so the cost is unknown (not zero).`;
  }

  if (costability.unresolvable.length > 0) {
    const names = costability.unresolvable.join(", ");
    const one = costability.unresolvable.length === 1;
    return `${names} — ${one ? "this item matches" : "these items match"} no product, so ${
      one ? "its" : "their"
    } cost cannot be known.`;
  }

  /**
   * An order with no line items at all.
   *
   * `classifyOrder` reads ONLY line items while `getOrderCogs` also sums order
   * components and custom costs (CoffeeOS#81), so such an order can carry a real
   * cost. Saying "there is nothing to cost" over a non-zero figure contradicts
   * the Cost Summary directly above it — and this page is itself the UI that
   * attaches those costs, so it is reachable by using the page as intended.
   * Three such orders exist in production (see lib/orders/cogs.ts).
   *
   * What is genuinely unknown is what the order SOLD, not what it cost.
   */
  if (cogs !== 0) {
    return "This order has no line items, so what it sold cannot be costed — the figure above is order-level cost only.";
  }
  return "This order has no line items, so there is nothing to cost.";
}

/**
 * How a component's cost is presented on /components.
 *
 * These live in lib/ rather than beside the components that use them for the
 * same reason lib/orders/format.ts does: tests/unit asserts the rules the UI
 * actually calls, and a rule copied into a component reopens the split-brain
 * that CoffeeOS#100 closed. tests/unit/components-tokens.spec.ts enforces that
 * nothing under app/(dashboard)/components/ re-derives them.
 *
 * CoffeeOS#73.
 */

/** A cost nobody has set. Deliberately not "$0.00" — see `isUncosted`. */
export const COST_NOT_SET = "not set";

/**
 * `components.cost_per_unit` is `numeric NOT NULL DEFAULT 0`, so a missing cost
 * is unrepresentable: the column fills itself with 0 and there is no null. That
 * makes 0 ambiguous — usually "the default was never overwritten", occasionally
 * "this genuinely costs nothing" (a donated sample, an absorbed cost).
 *
 * We read it as uncosted and accept the false positive. That is the OPPOSITE
 * call to CoffeeOS#68 on /orders, where a product costed entirely from zero-cost
 * components really is $0.00 and saying "not set" would tell an operator to redo
 * work they had already done. The difference is the DEFAULT: there the zero is
 * computed from real recipe rows, here it is what the column does when nobody
 * types anything.
 *
 * If operators start ignoring the red, that is the signal this was wrong and the
 * column needs a nullable or a `cost_confirmed` companion.
 */
export function isUncosted(component: { cost_per_unit: number }): boolean {
  return component.cost_per_unit === 0;
}

/**
 * Two decimals at or above a dollar, four below it — extended in two-decimal
 * steps to a maximum of eight, but ONLY when the shorter form would round a
 * real cost away to zero.
 *
 * That extension is the whole subtlety. A component priced per gram can sit at
 * $0.00004/g legitimately; at four decimals it renders "$0.0000", which is
 * visually indistinguishable from the uncosted state this screen exists to make
 * loud. So precision grows until the figure is non-zero rather than being fixed.
 *
 * The page it replaces used toFixed(8) everywhere, turning $0.35 into
 * $0.35000000 and making cost the widest column on the screen.
 *
 * Callers must test `isUncosted` first: uncosted is decided by the DATA, never
 * by the rendered string, so the two can never collide again if this rule
 * changes. A literal 0 reaching here renders "$0.00" — the honest rendering of a
 * number someone has decided to show.
 */
export function fmtCost(costPerUnit: number): string {
  const abs = Math.abs(costPerUnit);
  if (abs === 0) return "$0.00";
  if (abs >= 1) return `$${costPerUnit.toFixed(2)}`;

  let decimals = 4;
  while (decimals < 8 && Number(abs.toFixed(decimals)) === 0) decimals += 2;
  return `$${costPerUnit.toFixed(decimals)}`;
}

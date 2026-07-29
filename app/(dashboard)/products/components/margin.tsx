/**
 * Margin arithmetic for the /products list.
 *
 * `MarginPill` lived here through Stage A and is gone in Stage B — the worksheet
 * renders margin with instrument's `Badge`, so the loud `Pill` wrapper had no
 * remaining caller.
 *
 * TWO KNOWN DEFECTS PRESERVED ON PURPOSE, until Stage C swaps this page onto
 * lib/products/costing.ts:
 *
 * 1. Returns null when EITHER price or cogs is falsy, so `—` still means "no
 *    price", "no recipe" and "a genuinely $0 recipe" indistinguishably.
 *    Criteria 2 and 4 split those apart.
 *
 * 2. `!cogs` is a truthiness test, so a product costed entirely from zero-cost
 *    components reads as uncosted forever. lib/orders/cogs.ts carries
 *    `hasRecipe` precisely because that is the wrong question.
 */
export const calcMargin = (price: number | null, cogs: number | null | undefined) => {
  if (!price || !cogs) return null;
  return ((price - cogs) / price) * 100;
};

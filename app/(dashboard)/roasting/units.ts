/**
 * Weight formatting for the roasting surface.
 *
 * Every roasting weight is stored in grams and was, before this module,
 * displayed inconsistently: the tables rendered raw grams (`5,000g`) while the
 * roasted-stock panel rendered pounds, and `453.592` was written out by hand in
 * eight places across `actions.ts`, `page.tsx` and two client components — each
 * with its own `gramsToLbs` copy at `toFixed(2)`.
 *
 * One definition, one precision. Lives at the roasting root rather than under
 * `components/` because `actions.ts` needs it too, and NOT in
 * `lib/instrument/tokens.ts` because grams-to-pounds is domain arithmetic, not a
 * type role — see CoffeeOS#110 on not spreading near-copies of the same helper.
 */

/** Grams per pound. The single definition; do not inline this number. */
export const G_PER_LB = 453.592;

/**
 * Pounds, to one decimal.
 *
 * One decimal rather than the old two: at the quantities this surface deals in
 * (whole and half pounds of green), the second decimal was noise that made
 * columns harder to scan without telling the operator anything actionable.
 */
export const lb = (grams: number): string => (grams / G_PER_LB).toFixed(1);

/** Pounds with the unit attached, for standalone figures. */
export const lbs = (grams: number): string => `${lb(grams)} lb`;

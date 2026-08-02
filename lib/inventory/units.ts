/**
 * Grams ↔ pounds, once, for `/inventory`.
 *
 * Quantities are STORED IN GRAMS (`green_coffee_inventory.current_green_quantity_g`,
 * `initial_quantity_g`, `roasted_stock_g`) and PRICED IN POUNDS
 * (`price_per_lb`), so every screen that shows stock has to convert. The
 * constant was declared inline in eight files across three routes, and the two
 * helpers had drifted into incompatible shapes:
 *
 *   app/(dashboard)/inventory/inventory-client.tsx   (g) => number
 *   app/(dashboard)/roasting/roast-requests-client.tsx (g) => string   ← pre-.toFixed(2)
 *   app/(dashboard)/roasting/roasting-page-client.tsx  (g) => string   ← pre-.toFixed(2)
 *   ...plus bare 453.592 arithmetic in roasting/actions.ts, dashboard/page.tsx,
 *      orders/[id]/order-detail-client.tsx and inventory/actions.ts
 *
 * A helper that returns a PRE-FORMATTED STRING is the dangerous one: it cannot
 * be summed, so a caller that wants a total either re-implements the division
 * or silently concatenates. `gramsToLbs` here returns a `number` and formatting
 * is the caller's job — the same split `lib/orders/format.ts` draws between
 * computing a figure and writing it down.
 *
 * CoffeeOS#72 extracts the `/inventory` half only. The `/roasting` and
 * `/dashboard` copies stay for now: reconciling the string/number split would
 * change three routes' rendering inside a ticket that is meant to leave
 * behaviour alone, and both of those routes have visual baselines that read
 * this same data. Consolidating them is filed as follow-up work.
 */

/** 1 lb = 453.592 g. The figure every copy already used, so no total moves. */
export const LBS_TO_GRAMS = 453.592;

/**
 * Grams to pounds, unrounded.
 *
 * Deliberately NOT rounded here. `/inventory` sums per-lot pounds into a total
 * and multiplies pounds by `price_per_lb` for value; rounding at this boundary
 * would make the total disagree with the rows it is a total of, by up to half a
 * display unit per lot. Round once, at render.
 */
export function gramsToLbs(grams: number): number {
  return grams / LBS_TO_GRAMS;
}

/**
 * Pounds to grams, for writes.
 *
 * The server actions take pounds from the operator and persist grams
 * (`createCoffeeInventory`, `adjustInventoryQuantity`), so this is the inverse
 * used on the way in. Keeping both directions in one module is what makes the
 * round trip inspectable — the previous arrangement had the multiply in
 * `actions.ts` and the divide in the client, with no single place asserting
 * they agree.
 */
export function lbsToGrams(pounds: number): number {
  return pounds * LBS_TO_GRAMS;
}

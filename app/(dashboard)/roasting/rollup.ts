import { G_PER_LB } from "./units";

/**
 * The figures behind the roasting hero metric and stat strip.
 *
 * `/roasting` is a cost-attribution surface — `page.tsx` already computes
 * `session_toll_cost` per session, three different ways depending on
 * `cost_mode` — but the page never totalled the money. The stat row counted
 * sessions, batches and grams. This rolls the sessions the page already loads
 * into the one number that ties roasting to COGS: cost per roasted pound.
 *
 * Pure: no I/O, no dates, no formatting. That is deliberate — the divide-by-zero
 * case below cannot be reached from the demo fixture (every seeded session has
 * roasted weight), so it is only testable as a function.
 */

/** The subset of a session this needs. Structural, so `sessionsWithStats` from
 *  page.tsx and a test fixture both satisfy it without a cast. */
export interface RollableSession {
  session_toll_cost: number | null;
  total_green_weight_g: number;
  total_roasted_weight_g: number;
}

export interface RoastingRollup {
  totalCost: number;
  totalGreenG: number;
  totalRoastedG: number;
  /** null when no priced session produced any roasted weight. */
  costPerRoastedLb: number | null;
  /** null when no priced session consumed any green. */
  avgLossPercent: number | null;
}

export function rollUpSessions(sessions: RollableSession[]): RoastingRollup {
  /**
   * Sessions with a null cost are EXCLUDED, not counted as $0. Including their
   * roasted weight in the denominator while contributing nothing to the
   * numerator would silently understate cost per pound — the number would look
   * better the more unpriced sessions existed.
   *
   * `session_toll_cost` is typed `number | null` even though page.tsx's IIFE
   * currently always returns a number, so this is defensive by design.
   */
  const priced = sessions.filter((s) => s.session_toll_cost != null);

  const totalCost = priced.reduce((n, s) => n + (s.session_toll_cost ?? 0), 0);
  const totalGreenG = priced.reduce((n, s) => n + s.total_green_weight_g, 0);
  const totalRoastedG = priced.reduce((n, s) => n + s.total_roasted_weight_g, 0);

  return {
    totalCost,
    totalGreenG,
    totalRoastedG,
    /**
     * The guard that matters. A user with sessions but no completed batches has
     * `totalRoastedG === 0`, and `cost / 0` is Infinity — which renders as
     * "$Infinity". Returning null lets the view show an em dash instead.
     */
    costPerRoastedLb:
      totalRoastedG > 0 ? totalCost / (totalRoastedG / G_PER_LB) : null,
    /**
     * Derived from the TOTALS, not averaged per session. Averaging per session
     * weights a 1kg batch the same as a 30kg one and gives a number that is not
     * the yield loss of anything.
     */
    avgLossPercent:
      totalGreenG > 0 ? ((totalGreenG - totalRoastedG) / totalGreenG) * 100 : null,
  };
}

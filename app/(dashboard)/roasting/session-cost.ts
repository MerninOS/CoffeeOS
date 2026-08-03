import { G_PER_LB } from "./units";

/**
 * A roasting session's cost AND the arithmetic that produced it, from one call.
 *
 * WHY ONE FUNCTION
 *
 * `/roasting` bills three completely different ways depending on `cost_mode` —
 * hours × rate, green pounds × rate, or kWh × rate — and the sessions table has
 * always rendered the result as a bare dollar figure with no indication of
 * which. `$1.79` beside `$66.00` is unreadable: the operator cannot tell a
 * bargain from a different billing model from a bug.
 *
 * The obvious fix is to render a basis string next to the cost. The trap is
 * computing it SEPARATELY from the cost, because then the two can drift and the
 * explanation quietly stops describing the number it sits under — worse than no
 * explanation. So this returns both, derived from the same intermediates.
 *
 * BILLABLE MINUTES: NOTE THE INCONSISTENCY THIS PRESERVES
 *
 * The cost is billed on minutes recomputed here from setup + roast + cleanup,
 * rounded UP to the billing granularity. It deliberately does NOT read
 * `roasting_sessions.billable_minutes`, because the previous inline
 * implementation in page.tsx did not either — and the two disagree. On the demo
 * fixture the stored column says 210 while this arithmetic yields 75, so the
 * page has been displaying one number and billing on another.
 *
 * That is a real pre-existing defect, filed separately. It is preserved exactly
 * here on purpose: this change is a conversion, and silently "fixing" it would
 * move every historical cost figure in the product under cover of a restyle.
 */

export type CostMode = "toll_roasting" | "co_roasting" | "power_usage";

export interface CostableBatch {
  roast_minutes: number | null;
  green_weight_g: number | null;
}

export interface SessionCostInput {
  cost_mode: CostMode;
  setup_minutes: number;
  cleanup_minutes: number;
  billing_granularity_minutes: number;
  rate_per_hour: number;
  rate_per_lb: number | null;
  machine_energy_kwh_per_hour: number | null;
  kwh_rate: number | null;
  batches: CostableBatch[];
}

export interface SessionCost {
  /** Dollars. Identical to what page.tsx computed inline before this module. */
  cost: number;
  /** e.g. "1.3 h × $85.00" — the arithmetic, for rendering under the figure. */
  basis: string;
  /** A short label for the mode, for the vendor cell. */
  modeLabel: string;
  /** Exposed so a caller can show what was actually billed. */
  billableMinutes: number;
}

const MODE_LABEL: Record<CostMode, string> = {
  toll_roasting: "Toll · per hour",
  co_roasting: "Co-roast · per lb",
  power_usage: "In-house · power",
};

/** Trims a trailing ".0" so "2.0 h" reads "2 h" but "2.5 h" survives. */
const trim = (n: number, dp: number) =>
  n.toFixed(dp).replace(/\.0+$/, "");

export function sessionCost(input: SessionCostInput): SessionCost {
  const totalRoastMinutes = input.batches.reduce(
    (sum, b) => sum + (b.roast_minutes || 0),
    0
  );
  const totalSessionMinutes =
    input.setup_minutes + totalRoastMinutes + input.cleanup_minutes;

  // Rounded UP to the granularity — a 64-minute session on 15-minute billing is
  // charged as 75. Guard the divisor: a zero granularity would yield Infinity.
  const granularity = input.billing_granularity_minutes || 1;
  const billableMinutes =
    Math.ceil(totalSessionMinutes / granularity) * granularity;

  const modeLabel = MODE_LABEL[input.cost_mode] ?? MODE_LABEL.toll_roasting;

  if (input.cost_mode === "co_roasting") {
    const rate = Number(input.rate_per_lb || 0);
    const greenLb = input.batches.reduce(
      (sum, b) => sum + (b.green_weight_g || 0) / G_PER_LB,
      0
    );
    return {
      cost: greenLb * rate,
      basis: `${trim(greenLb, 1)} lb × $${rate.toFixed(2)}`,
      modeLabel,
      billableMinutes,
    };
  }

  if (input.cost_mode === "power_usage") {
    const kwhPerHour = input.machine_energy_kwh_per_hour || 0;
    const kwhRate = input.kwh_rate || 0;
    const hours = billableMinutes / 60;
    const kwh = hours * kwhPerHour;
    return {
      cost: kwh * kwhRate,
      // Three decimals on the rate: electricity is priced per kWh at fractions
      // of a cent, and $0.14 would misrepresent $0.1350.
      basis: `${trim(kwh, 1)} kWh × $${kwhRate.toFixed(3)}`,
      modeLabel,
      billableMinutes,
    };
  }

  const hours = billableMinutes / 60;
  return {
    cost: hours * input.rate_per_hour,
    basis: `${trim(hours, 1)} h × $${input.rate_per_hour.toFixed(2)}`,
    modeLabel,
    billableMinutes,
  };
}

/**
 * Yield loss as a percentage, or null when there is nothing to divide by.
 *
 * Null rather than 0: a session with no green weight has an UNKNOWN loss, and
 * rendering 0% would assert a perfect yield that never happened.
 */
export function lossPercent(greenG: number, roastedG: number): number | null {
  if (!greenG || !roastedG) return null;
  return ((greenG - roastedG) / greenG) * 100;
}

/**
 * The in-spec band for yield loss.
 *
 * These two numbers already existed, hardcoded inside `weightLossColor()` in
 * sessions-client.tsx, where they coloured the figure red or green without ever
 * telling the operator what scale they were being judged against.
 *
 * They are NOT read from `roasting_settings.weight_loss_target` yet, even though
 * that column exists — the settings page currently discards every field it
 * renders, so the value is unsettable. Filed separately; until it lands, the
 * band is made VISIBLE rather than made configurable.
 */
export const LOSS_BAND: readonly [number, number] = [12, 18];

export type LossTone = "under" | "in" | "over";

export function lossTone(
  pct: number,
  band: readonly [number, number] = LOSS_BAND
): LossTone {
  if (pct > band[1]) return "over";
  if (pct < band[0]) return "under";
  return "in";
}

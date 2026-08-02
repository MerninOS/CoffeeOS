"use client";

import { mono } from "@/lib/instrument/tokens";
import { LOW_STOCK_LB, stockState } from "@/lib/inventory/valuation";

/**
 * Green remaining, with a hairline bar reading it against what was received.
 *
 * `initial_quantity_g` has been stored since the feature shipped and rendered
 * nowhere, so "12 of 50 lb left" was computable and invisible. This is the whole
 * of what that column adds.
 *
 * THE BAR IS CLAMPED; THE FIGURE IS NOT. `initial_quantity_g` is written once at
 * creation and never updated, so a lot topped up by a manual adjustment holds
 * more than it was "received" and the ratio exceeds 1. Clamping the fill keeps
 * it inside its track; clamping the FIGURE would misreport stock on hand, which
 * is the one thing this screen exists to state. Spec Criterion 9 asserts both
 * halves independently for that reason.
 *
 * Colour encodes the same three states as the badge, from
 * `lib/inventory/valuation.ts` — not a second threshold. It is NOT the roast
 * ramp: `--roast-*` is banned in CoffeeOS until roast-level data exists, and
 * tests/e2e/design-rulings.spec.ts enforces that.
 */
export function Depletion({
  greenLbs,
  initialLbs,
}: {
  greenLbs: number;
  initialLbs: number;
}) {
  const state = stockState(greenLbs);
  const tone =
    state === "out"
      ? "var(--ink-subtle)"
      : state === "low"
        ? "var(--warning)"
        : "var(--ink)";

  // A lot received at 0 (possible: initial_quantity_g is not constrained) would
  // divide by zero. Treat it as full rather than NaN — the figure beside it
  // still tells the truth.
  const pct =
    initialLbs > 0 ? Math.max(0, Math.min(100, (greenLbs / initialLbs) * 100)) : 100;

  return (
    <div className="flex flex-col items-end gap-1">
      <span
        data-testid="lot-green"
        style={{ ...mono, fontSize: "var(--fs-data)", color: tone, whiteSpace: "nowrap" }}
      >
        {greenLbs.toFixed(1)} lbs
      </span>
      <div
        aria-hidden="true"
        style={{
          width: 56,
          height: 3,
          background: "var(--hairline-strong)",
          borderRadius: 2,
          overflow: "hidden",
        }}
      >
        <div style={{ width: `${pct}%`, height: "100%", background: tone }} />
      </div>
    </div>
  );
}

/** The low/out rule, stated where the filter that applies it lives. */
export const LOW_RULE = `Low = under ${LOW_STOCK_LB} lb`;

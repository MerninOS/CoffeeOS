"use client";

import { mono } from "@/lib/instrument/tokens";

/**
 * Retokenized onto instrument (CoffeeOS#71). Rail is `--surface-sunken`, fill
 * is `--ink` — deliberately NOT the `--roast-*` ramp. That ramp encodes roast
 * darkness; this meter encodes progress toward a request's requested weight,
 * which has nothing to do with roast level (design-rulings.spec.ts bans
 * `--roast-*` outright, for exactly this reason).
 *
 * NOTE ON UNITS: the design proposal calls for this text to go through
 * `lbs()`. It deliberately still reads grams here — the frozen capability
 * spec (`tests/e2e/roasting-requests-capabilities.spec.ts`, written against
 * the pre-restyle markup specifically to survive this conversion) asserts the
 * literal substrings `"2,000 / 5,000g"` and `` `0 / ${qtyComma}g` `` against
 * this exact node. Converting to pounds changes the number itself, not just
 * its formatting, and breaks the "10/10 before and after" gate. Flagged as a
 * concern in the restyle report rather than silently resolved either way.
 */
export function ProgressMeter({ fulfilled, requested }: { fulfilled: number; requested: number }) {
  const progressPercent = (fulfilled / requested) * 100;
  return (
    <div className="flex items-center gap-2">
      <div
        style={{
          width: 80,
          height: 6,
          background: "var(--surface-sunken)",
          borderRadius: "var(--r-pill)",
          overflow: "hidden",
          border: "1px solid var(--hairline)",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${Math.min(progressPercent, 100)}%`,
            background: "var(--ink)",
            borderRadius: "var(--r-pill)",
          }}
        />
      </div>
      <span
        style={{
          ...mono,
          fontSize: "var(--fs-caption)",
          color: "var(--ink-subtle)",
          whiteSpace: "nowrap",
        }}
      >
        {fulfilled.toLocaleString()} / {requested.toLocaleString()}g
      </span>
    </div>
  );
}

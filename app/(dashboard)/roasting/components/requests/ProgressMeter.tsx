"use client";

import { mono } from "@/lib/instrument/tokens";
import { lb } from "../../units";

/**
 * Retokenized onto instrument (CoffeeOS#71). Rail is `--surface-sunken`, fill
 * is `--ink` — deliberately NOT the `--roast-*` ramp. That ramp encodes roast
 * darkness; this meter encodes progress toward a request's requested weight,
 * which has nothing to do with roast level (design-rulings.spec.ts bans
 * `--roast-*` outright, for exactly this reason).
 *
 * Units are pounds, via the shared `units.ts` formatter. The capability spec
 * asserted the old gram strings against this node on purpose — so that
 * changing them is a visible, reviewable edit to that spec rather than a
 * silent reformat. That edit is part of this change.
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
        {lb(fulfilled)} / {lb(requested)} lb
      </span>
    </div>
  );
}

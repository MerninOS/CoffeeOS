"use client";

import { StatStrip } from "@merninos/ui/instrument";
import { mono, overline, sans } from "@/lib/instrument/tokens";

/**
 * One hero figure and a ruled strip — never a row of equal cards.
 *
 * The hero is the count of UNCOSTED components, not the count of components.
 * Nobody opens this screen to find out how many components exist; they open it
 * because a cost is wrong or missing somewhere downstream. /components is a
 * setup screen visited rarely, so the design is not optimised for daily
 * scanning — it is optimised so that the one time an operator lands here,
 * whatever is broken is unmissable.
 *
 * When the count is non-zero the figure is brand red. That is the live-register
 * rule applied literally: --brand means "happening now / needs you", and an
 * uncosted component is the only thing on this page that does. At zero there is
 * no figure at all (see below) and no red anywhere, so the signal stays worth
 * something.
 *
 * Both states are hand-rolled rather than using the kit's HeroMetric, following
 * MarginHero (CoffeeOS#70): the deviation is local and explained rather than
 * forking the component.
 *
 * The strip is the type census — what TypePill's four coloured counts used to
 * say, minus the decoration. Deliberately NOT a median or average cost: these
 * figures are $/lb, $/oz, $/hour and $/each, so any single statistic across them
 * is a number with no referent, and the system's rule is that numbers are facts
 * presented flatly.
 */
export function UncostedHero({
  uncosted,
  total,
  census,
}: {
  uncosted: number;
  total: number;
  census: Array<{ label: string; value: string }>;
}) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 24, alignItems: "end" }}>
      <div style={{ flex: "0 0 268px" }}>
        {uncosted === 0 ? (
          /**
           * No figure at zero — a quiet confirmation instead.
           *
           * `HeroMetric value="0"` is the honest number, but a lone 0 at
           * --fs-hero in wide/heavy Martian Mono reads as a symbol rather than a
           * count: a large slashed glyph that looks more like an error mark than
           * "everything is priced". Same failure MarginHero documents for an em
           * dash at this size, which renders as a solid bar and reads as
           * redaction.
           *
           * The dramatic figure returns the moment there IS something to act on,
           * which is when it earns the space. A hero that shouts at you when
           * nothing is wrong teaches you to stop reading it.
           */
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              paddingBottom: 16,
              borderBottom: "2px solid var(--ink)",
            }}
          >
            <span style={{ ...overline, color: "var(--ink-muted)" }}>Uncosted</span>
            <span
              data-testid="uncosted-none"
              style={{ ...sans, fontSize: "var(--fs-body-lg)", color: "var(--ink)" }}
            >
              Every component is priced.
            </span>
            <span
              style={{
                ...sans,
                fontSize: "var(--fs-caption)",
                color: "var(--ink-subtle)",
              }}
            >
              All {total} carry a cost.
            </span>
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              paddingBottom: 16,
              borderBottom: "2px solid var(--ink)",
            }}
          >
            <span style={{ ...overline, color: "var(--ink-muted)" }}>Uncosted</span>
            <div
              style={{
                display: "flex",
                alignItems: "flex-end",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <span
                data-testid="uncosted-count"
                style={{
                  fontFamily: "var(--font-display)",
                  fontVariationSettings: "var(--display-settings)",
                  fontWeight: "var(--display-weight)" as unknown as number,
                  letterSpacing: "var(--display-tracking)",
                  fontSize: "var(--fs-hero)",
                  lineHeight: 0.9,
                  color: "var(--brand)",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {uncosted}
              </span>
              <span
                style={{
                  ...mono,
                  fontSize: "var(--fs-body-lg)",
                  color: "var(--ink-muted)",
                  paddingBottom: 6,
                }}
              >
                of {total}
              </span>
            </div>
            <span
              style={{
                ...sans,
                fontSize: "var(--fs-caption)",
                color: "var(--ink-subtle)",
              }}
            >
              Every product built on these understates its cost.
            </span>
          </div>
        )}
      </div>
      <div style={{ flex: "1 1 440px", minWidth: 0 }}>
        <StatStrip stats={census} />
      </div>
    </div>
  );
}

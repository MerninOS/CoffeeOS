"use client";

import { HeroMetric, StatStrip } from "@merninos/ui/instrument";
import { COGS_NOT_SET } from "@/lib/orders/format";
import { mono, overline, sans, money } from "../../components/tokens";

/**
 * One hero figure and a ruled strip — never a row of equal cards.
 *
 * Replaces four equally-weighted metric cards that gave Payment, Fulfillment,
 * Order Total and Profit Margin identical visual weight: two statuses and two
 * money figures, side by side, none of them the point. Instrument forbids that
 * shape outright, and the reason is legible here — this page produces exactly
 * one number, and it was the fourth of four boxes.
 *
 * The statuses move to header badges, where states belong.
 *
 * WHEN THE COST IS UNKNOWN the figure is not rendered at all. It is not
 * "uncertain", it is invented — profit and margin derive wholly from the number
 * that is missing — and printing it in red would say "be careful about this"
 * when the honest statement is "there is no number". That is how the old figure
 * got believed by 240 of 316 orders' worth of operators.
 *
 * Deliberately NOT `HeroMetric value="—"`: an em dash at --fs-hero in wide/heavy
 * Martian Mono renders as a solid black bar and reads as redaction rather than
 * absence. Found while building the design mock.
 */
export function MarginHero({
  costKnown,
  margin,
  profit,
  revenue,
  cogsText,
  itemCount,
  reason,
}: {
  costKnown: boolean;
  margin: number;
  profit: number;
  revenue: number;
  /** Already formatted by cogsLabel — see the note below. */
  cogsText: string;
  itemCount: number;
  reason: string | null;
}) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 24, alignItems: "end" }}>
      <div style={{ flex: "0 0 292px" }}>
        {costKnown ? (
          <HeroMetric
            label="Margin"
            value={margin.toFixed(1)}
            unit="%"
            note={`${money(profit)} profit on ${money(revenue)} revenue`}
          />
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
            <span style={{ ...overline, color: "var(--ink-muted)" }}>Margin</span>
            <div style={{ display: "flex", alignItems: "center", minHeight: 58 }}>
              {/* Muted, not red. Red marks incompleteness in a figure that
                  exists; this is an absence. Matches /orders. */}
              <span
                style={{
                  ...mono,
                  fontSize: "var(--fs-data-lg)",
                  lineHeight: 1.15,
                  color: "var(--ink-subtle)",
                }}
              >
                Cost unknown
              </span>
            </div>
            <span
              style={{ ...sans, fontSize: "var(--fs-caption)", color: "var(--ink-subtle)" }}
            >
              {reason ?? "This order's cost cannot be computed."}
            </span>
          </div>
        )}
      </div>

      <div style={{ flex: "1 1 440px", minWidth: 0 }}>
        <StatStrip
          stats={[
            { label: "Revenue", value: revenue.toFixed(2), unit: "USD" },
            /* Takes cogsLabel's ANSWER rather than recomputing its rule.
               `costKnown || cogs !== 0` was that rule written a second time, and
               the token guard could not see it because it greps for the "not
               set" literal. A partial figure is toned like the worksheet's, so
               the same number is not shown as complete here and incomplete
               there.

               NOT toned: StatStrip offers only "default" and "live", and the
               design system rules "live" unusable here — nothing on this page
               polls. The partial-ness is carried by the worksheet's red figure
               and by the withheld margin beside this strip. */
            {
              label: "COGS",
              value: cogsText === COGS_NOT_SET ? "—" : cogsText.replace(/^[−+]\$/, ""),
              unit: cogsText === COGS_NOT_SET ? undefined : "USD",
            },
            {
              label: "Profit",
              value: costKnown ? profit.toFixed(2) : "—",
              unit: costKnown ? "USD" : undefined,
            },
            {
              label: "Items",
              value: String(itemCount),
              unit: itemCount === 1 ? "unit" : "units",
            },
          ]}
        />
      </div>
    </div>
  );
}

"use client";

import { HeroMetric, StatStrip } from "@merninos/ui/instrument";
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
  cogs,
  itemCount,
  reason,
}: {
  costKnown: boolean;
  margin: number;
  profit: number;
  revenue: number;
  cogs: number;
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
            /* COGS shows whatever is genuinely known even when the verdict is
               not `costed` — an uncostable order can still carry real
               order-level cost, and hiding it would disagree with /orders. */
            {
              label: "COGS",
              value: costKnown || cogs !== 0 ? cogs.toFixed(2) : "—",
              unit: costKnown || cogs !== 0 ? "USD" : undefined,
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

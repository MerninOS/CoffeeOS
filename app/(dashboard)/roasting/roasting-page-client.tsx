"use client";

import { useSearchParams } from "next/navigation";
import { HeroMetric, StatStrip } from "@merninos/ui/instrument";
import { SessionsClient, type Session } from "./sessions-client";
import { RoastRequestsClient } from "./roast-requests-client";
import { mono, overline, sans } from "@/lib/instrument/tokens";
import type { RoastRequest, CoffeeInventory } from "./components/requests/types";
import type { RoastingRollup } from "./rollup";
import { lb } from "./units";

interface RoastedCoffeeStock {
  id: string;
  name: string;
  origin: string;
  roasted_stock_g: number;
}

interface RoastingPageClientProps {
  initialSessions: Session[];
  roastRequests: RoastRequest[];
  coffeeInventory: CoffeeInventory[];
  roastedCoffeeStock: RoastedCoffeeStock[];
  rollup: RoastingRollup;
  openRequestCount: number;
}

export function RoastingPageClient({
  initialSessions,
  roastRequests,
  coffeeInventory,
  roastedCoffeeStock,
  rollup,
  openRequestCount,
}: RoastingPageClientProps) {
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab");

  /**
   * Queue is the default view now, not Sessions. `?tab=requests` still resolves
   * here so existing links keep working — see layout.tsx.
   */
  const activeTab =
    tab === "sessions" ? "sessions" : tab === "stock" ? "stock" : "queue";

  const totalRoastedStock = roastedCoffeeStock.reduce(
    (sum, c) => sum + c.roasted_stock_g,
    0
  );

  /**
   * The em dash is the divide-by-zero guard reaching the screen: a user with
   * sessions but no completed batches has no roasted weight to divide by, and
   * `rollup` returns null rather than Infinity so this renders "—" instead of
   * "$Infinity". See rollup.ts and tests/unit/roasting-rollup.spec.ts.
   */
  const heroValue =
    rollup.costPerRoastedLb == null ? "—" : `$${rollup.costPerRoastedLb.toFixed(2)}`;
  const avgLoss =
    rollup.avgLossPercent == null ? "—" : rollup.avgLossPercent.toFixed(1);

  return (
    <div className="p-6 space-y-6">
      {/*
        One hero figure and a ruled strip — never a row of equal cards. Cost per
        roasted pound is the number that ties this surface to COGS, and it is a
        reduce over sessions the page already loads.
      */}
      {/*
        Stacked below md, one ruled line at md and up.

        This was `flex flex-wrap` with a fixed 268px hero and a `flex-1` strip,
        which cannot wrap: `flex-1` sets `flex-basis: 0`, so the strip never
        exceeds its container and never triggers `flex-wrap` — it just shrinks.
        At 375px the content box is 327px, the hero took 268 and the gap 24,
        leaving the strip 35px to render four stats in. StatStrip clips at
        `overflow-x: hidden`, so the figures were cut mid-number rather than
        visibly overflowing.
      */}
      <div className="flex flex-col md:flex-row md:flex-wrap gap-6 md:items-end">
        <div className="w-full md:w-[268px] md:flex-none" data-testid="roasting-hero">
          <HeroMetric
            label="Cost per roasted lb · 30d"
            value={heroValue}
            note={`$${rollup.totalCost.toFixed(2)} across ${initialSessions.length} ${
              initialSessions.length === 1 ? "session" : "sessions"
            }`}
          />
        </div>
        {/*
          Four stats, not five. Roasted-on-hand was the fifth and wrapped onto a
          second row at 1280, which reads as two separate strips rather than one
          ruled line. It also has its own tab now, so the strip stays about cost
          and yield.
        */}
        <div className="w-full min-w-0 md:flex-1" data-testid="roasting-stats">
          <StatStrip
            stats={[
              { label: "Roasted · 30d", value: lb(rollup.totalRoastedG), unit: "lb" },
              { label: "Green consumed", value: lb(rollup.totalGreenG), unit: "lb" },
              { label: "Avg yield loss", value: avgLoss, unit: "%" },
              { label: "Open requests", value: String(openRequestCount) },
            ]}
          />
        </div>
      </div>

      {activeTab === "queue" && (
        <RoastRequestsClient requests={roastRequests} coffeeInventory={coffeeInventory} />
      )}

      {activeTab === "sessions" && (
        <SessionsClient initialSessions={initialSessions} hideHeader />
      )}

      {/*
        Roasted stock was pinned above every tab, taking the top of the page for
        reference data that answers none of the questions the queue does. It is
        its own view now.
      */}
      {activeTab === "stock" && (
        <div data-testid="roasted-stock" className="flex flex-col gap-3">
          <div
            className="flex items-baseline justify-between gap-4 flex-wrap pb-2.5"
            style={{ borderBottom: "1px solid var(--hairline)" }}
          >
            <span style={{ ...overline, color: "var(--ink)" }}>Roasted stock on hand</span>
            <span style={{ ...sans, fontSize: "var(--fs-caption)", color: "var(--ink-subtle)" }}>
              Also shown on Green inventory — candidate for consolidation.
            </span>
          </div>

          {roastedCoffeeStock.length === 0 ? (
            <p style={{ ...sans, color: "var(--ink-muted)", padding: "24px 0" }}>
              Nothing roasted yet. Complete a roasting batch to build stock.
            </p>
          ) : (
            <div className="flex flex-col">
              {roastedCoffeeStock.map((coffee, i) => (
                <div
                  key={coffee.id}
                  data-testid="stock-row"
                  className="flex items-center justify-between gap-4 py-3"
                  style={{ borderTop: i ? "1px solid var(--hairline)" : "none" }}
                >
                  <span className="flex flex-col min-w-0" style={{ lineHeight: 1.3 }}>
                    <span style={{ ...sans, fontWeight: 500 }}>{coffee.name}</span>
                    {coffee.origin && (
                      <span style={{ ...overline }}>{coffee.origin}</span>
                    )}
                  </span>
                  <span style={{ ...mono, fontSize: "var(--fs-data)" }}>
                    {lb(coffee.roasted_stock_g)} lb
                  </span>
                </div>
              ))}
              <div
                className="flex items-center justify-between gap-4 py-3"
                style={{ borderTop: "2px solid var(--ink)" }}
              >
                <span style={{ ...overline, color: "var(--ink)" }}>Total</span>
                <span
                  style={{ ...mono, fontSize: "var(--fs-data-lg)", fontWeight: 500 }}
                  data-testid="stock-total"
                >
                  {lb(totalRoastedStock)} lb
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

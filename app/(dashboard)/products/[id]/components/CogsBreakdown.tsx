"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { TrendingUp } from "lucide-react";
import { fmt, Panel } from "./primitives";

/**
 * The COGS donut, its legend and its empty state, moved out of
 * product-detail-client.tsx unchanged (CoffeeOS#69 Stage A). The recharts
 * configuration — innerRadius "55%", outerRadius "80%", paddingAngle 2, the
 * default <Tooltip> chrome and CHART_COLORS in this exact order — is what the
 * visual baselines are pinned to, so none of it is touched.
 *
 * `CHART_COLORS` lives here because this is its only consumer.
 *
 * Preserved as-is:
 *  - the panel renders the chart only when `calculatedCogs > 0` AND the
 *    breakdown is non-empty, so a recipe made entirely of zero-cost components
 *    shows the "Add components with costs" empty state as though nothing were
 *    configured (the same truthiness defect recorded in ../../components/margin.tsx)
 *  - the legend keys on `d.name`, so two distinct components sharing a name
 *    collide on a duplicate React key — the parent's `cogsBreakdown` groups by
 *    component id, not name, so this is reachable
 *  - the percentage uses `toFixed(0)`, so slices can visibly sum to 99% or 101%
 */

const CHART_COLORS = ["#E8442A", "#F5C842", "#E8913A", "#5BC8D5", "#5A7A3A", "#3B1F0A", "#D8D0B8"];

export function CogsBreakdown({
  calculatedCogs,
  cogsBreakdown,
}: {
  calculatedCogs: number;
  cogsBreakdown: Array<{ name: string; value: number }>;
}) {
  return (
    <Panel title="COGS Breakdown" subtitle={calculatedCogs > 0 ? fmt(calculatedCogs) : undefined}>
      {calculatedCogs > 0 && cogsBreakdown.length > 0 ? (
        <>
          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={cogsBreakdown} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="80%" paddingAngle={2}>
                  {cogsBreakdown.map((_, i) => (
                    <Cell key={`cell-${i}`} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => fmt(Number(v))} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 space-y-2">
            {cogsBreakdown.map((d, i) => (
              <div key={d.name} className="flex items-center justify-between gap-3 text-[12px]">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2.5 h-2.5 rounded-[3px] shrink-0" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                  <span className="truncate font-medium text-espresso">{d.name}</span>
                </div>
                <div className="shrink-0 font-bold tabular-nums text-espresso">
                  {fmt(d.value)}{" "}
                  <span className="text-muted-foreground font-normal">
                    ({((d.value / calculatedCogs) * 100).toFixed(0)}%)
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <TrendingUp size={32} strokeWidth={1.5} className="text-fog mb-3" />
          <p className="text-[13px] text-muted-foreground">
            Add components with costs to see the breakdown.
          </p>
        </div>
      )}
    </Panel>
  );
}

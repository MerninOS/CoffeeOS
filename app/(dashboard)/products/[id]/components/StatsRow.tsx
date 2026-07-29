"use client";

import { fmt, Pill } from "./primitives";

/**
 * The four stat tiles, moved out of product-detail-client.tsx unchanged
 * (CoffeeOS#69 Stage A). The tiles are still built from a literal array that is
 * then `.map`ed, exactly as before — flattening that into four JSX blocks would
 * be tidier and is deliberately NOT done, because `key={label}` and the
 * `color || "text-espresso"` fallback are what the current DOM depends on.
 *
 * `marginPill` came across with it: it is a locally-scoped render helper with
 * exactly one call site, so it moves rather than staying behind as a prop.
 *
 * Preserved as-is:
 *  - all three money tiles use `fmt`, i.e. THREE decimals (see primitives.tsx)
 *  - the margin thresholds 30/15 are duplicated between the numeric class in
 *    ../../components/margin.tsx and the Healthy/Fair/Low wording here; the two
 *    are unified in Stage C, not now
 *  - "Profit / Unit" colours on `profit >= 0`, so exactly $0.00 profit reads as
 *    matcha/healthy green
 */

const marginPill = (m: number) => {
  const v = m >= 30 ? "matcha" : m >= 15 ? "sun" : "tomato";
  return <Pill variant={v}>{m >= 30 ? "Healthy" : m >= 15 ? "Fair" : "Low"}</Pill>;
};

export function StatsRow({
  isVariantMode,
  priceValue,
  calculatedCogs,
  profit,
  margin,
}: {
  isVariantMode: boolean;
  priceValue: number;
  calculatedCogs: number;
  profit: number;
  margin: number;
}) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {[
        {
          label: isVariantMode ? "Variant Price" : "Selling Price",
          value: fmt(priceValue),
          sub: null as React.ReactNode,
          testId: "stat-price",
        },
        { label: "Total COGS", value: fmt(calculatedCogs), sub: null, testId: "stat-total-cogs" },
        {
          label: "Profit / Unit",
          value: fmt(profit),
          sub: null,
          color: profit >= 0 ? "text-matcha" : "text-tomato",
          testId: "stat-profit",
        },
        {
          label: "Profit Margin",
          value: `${margin.toFixed(1)}%`,
          sub: marginPill(margin),
          testId: "stat-margin",
        },
      ].map(({ label, value, sub, color, testId }) => (
        <div
          key={label}
          className="bg-chalk border-[3px] border-espresso rounded-[14px] p-4 shadow-flat-md"
        >
          <div className="text-[10.5px] font-extrabold tracking-[.12em] uppercase text-muted-foreground">
            {label}
          </div>
          <div
            data-testid={testId}
            className={`font-extrabold text-[28px] leading-none mt-1.5 ${color || "text-espresso"}`}
          >
            {value}
          </div>
          {sub && <div className="mt-2">{sub}</div>}
        </div>
      ))}
    </div>
  );
}

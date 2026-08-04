/**
 * The /roasting route skeleton, on instrument.
 *
 * Missed when the surface converted (CoffeeOS#71): the token guard in
 * tests/unit/roasting-tokens.spec.ts lists files explicitly and this one was
 * never added, so it sat green while painting the loud palette — cream panels,
 * 3px espresso borders, flat offset shadows — for the length of every navigation
 * into the tab, then snapped to the hairline worksheet. It is in FILES now.
 *
 * The shape was stale as well. It drew the old layout: a pinned roasted-stock
 * panel above a sessions panel. Neither is what /roasting opens on any more —
 * roasted stock moved behind its own tab and the default view is Queue. This
 * draws what actually arrives: the hero figure and ruled strip, then the request
 * worksheet at its real 34px header and 40px rows.
 *
 * No page header here on purpose. loading.tsx renders INSIDE layout.tsx, which
 * owns the "Roasting" title and the tab bar — both stay put across the fallback,
 * so redrawing them would double them up.
 */

function Bar({ className, width }: { className?: string; width?: number | string }) {
  return (
    <div
      className={`animate-pulse ${className ?? ""}`}
      style={{
        width,
        background: "var(--surface-sunken)",
        borderRadius: "var(--r-sm)",
      }}
    />
  );
}

export default function RoastingLoading() {
  return (
    <div className="p-6 space-y-6">
      {/* Hero + ruled strip — stacked below md, one line at md and up, matching
          the page's own breakpoint rather than a flex-wrap that cannot wrap. */}
      <div className="flex flex-col md:flex-row md:flex-wrap gap-6 md:items-end">
        {/* HeroMetric: label, display figure, note, over a 2px --ink rule. */}
        <div
          className="w-full md:w-[268px] md:flex-none"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            paddingBottom: 16,
            borderBottom: "2px solid var(--ink)",
          }}
        >
          <Bar className="h-[11px]" width={170} />
          <Bar className="h-[44px]" width={120} />
          <Bar className="h-[11px]" width={210} />
        </div>

        {/* StatStrip: four cells, 1px gap over a hairline ground. */}
        <div
          className="w-full min-w-0 md:flex-1 flex flex-wrap items-stretch"
          style={{
            gap: 1,
            border: "1px solid var(--hairline)",
            borderRadius: "var(--r-md)",
            background: "var(--hairline)",
            overflow: "hidden",
          }}
        >
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              style={{
                flex: "1 1 150px",
                minWidth: 0,
                display: "flex",
                flexDirection: "column",
                gap: 6,
                padding: "12px 16px",
                background: "var(--surface)",
              }}
            >
              <Bar className="h-[10px]" width={88} />
              <Bar className="h-[18px]" width={52} />
            </div>
          ))}
        </div>
      </div>

      {/* Queue is the default tab, so the fallback draws the request worksheet. */}
      <div className="flex flex-col gap-6">
        {/* Section header + New Request button */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1.5">
            <Bar className="h-[16px]" width={140} />
            <Bar className="h-[11px]" width={260} />
          </div>
          <Bar className="h-[28px]" width={124} />
        </div>

        {/* Worksheet — hairline container on --surface, no offset shadow. */}
        <div
          style={{
            border: "1px solid var(--hairline)",
            borderRadius: "var(--r-md)",
            overflow: "hidden",
            background: "var(--surface)",
          }}
        >
          <div
            className="flex items-center justify-between"
            style={{
              height: 34,
              padding: "0 12px",
              background: "var(--surface-sunken)",
              borderBottom: "1px solid var(--hairline-strong)",
            }}
          >
            <Bar className="h-[9px]" width={72} />
            <Bar className="h-[9px]" width={96} />
          </div>
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-3"
              style={{
                minHeight: 40,
                padding: "0 12px",
                borderBottom: i < 4 ? "1px solid var(--hairline)" : undefined,
              }}
            >
              <Bar className="h-[13px] flex-1" />
              <Bar className="h-[13px] shrink-0" width={72} />
              <Bar className="h-[13px] shrink-0" width={120} />
              <Bar className="h-[16px] shrink-0" width={56} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

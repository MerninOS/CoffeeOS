/**
 * The route-group skeleton, on instrument.
 *
 * This is the `(dashboard)` group fallback, so in practice it is the /dashboard
 * skeleton: every sibling route (orders, products, inventory, components,
 * roasting, settings) ships its own loading.tsx and never reaches this one.
 *
 * It was the last loud file on the surface. Left on the Tailwind theme — which
 * IS the loud Mernin' palette — it painted chalk panels, 3px espresso borders
 * and flat offset shadows for the length of every navigation into the tab, then
 * snapped to instrument's hairline worksheet. A route is only as converted as
 * its first frame.
 *
 * The old shape was wrong too, independently of the palette: it drew a title and
 * subtitle the page does not have (the heading lives in the shell), then four
 * equal KPI cards and one panel. The real page opens on a hero figure plus a
 * ruled strip and carries four panels in two rows. Both are corrected here so
 * the swap to real content does not jump.
 *
 * The role fork does not reach the geometry: owners/admins and roasters differ
 * only in WHICH three stats and which second bottom panel render, never in how
 * many. So unlike the settings skeleton, this one needs no role it cannot know.
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

/** Mirrors the page's local Panel: hairline container, ruled header, padded body. */
function PanelSkeleton({ children }: { children: React.ReactNode }) {
  return (
    <section
      style={{
        display: "flex",
        flexDirection: "column",
        background: "var(--surface)",
        border: "1px solid var(--hairline)",
        borderRadius: "var(--r-lg)",
        boxShadow: "var(--shadow-sm)",
        overflow: "hidden",
      }}
    >
      <div
        className="flex items-center justify-between"
        style={{
          gap: "var(--space-3)",
          padding: "var(--space-3) var(--space-4)",
          borderBottom: "1px solid var(--hairline)",
        }}
      >
        <Bar className="h-[10px]" width={120} />
        <Bar className="h-[10px]" width={64} />
      </div>
      <div style={{ flex: 1, padding: "var(--space-4)" }}>{children}</div>
    </section>
  );
}

/** A ruled list row — the shape shared by Recent Roasts and Recent Orders. */
function RowSkeleton({ first }: { first?: boolean }) {
  return (
    <div
      className="flex items-center"
      style={{
        gap: "var(--space-3)",
        padding: "var(--space-3) 0",
        borderTop: first ? undefined : "1px solid var(--hairline)",
      }}
    >
      <Bar className="h-[12px] shrink-0" width={52} />
      <Bar className="h-[12px] flex-1" />
      <Bar className="h-[12px] shrink-0" width={40} />
    </div>
  );
}

export default function DashboardLoading() {
  return (
    <div
      style={{
        maxWidth: "var(--content-max)",
        margin: "0 auto",
        padding: "var(--space-6)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-6)",
      }}
    >
      {/* Hero + ruled strip */}
      <div
        className="flex flex-wrap items-end"
        style={{ gap: "var(--space-6)" }}
      >
        {/* HeroMetric: label, display figure, note, over a 2px --ink rule. */}
        <div
          style={{
            flex: "0 0 260px",
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            gap: 8,
            paddingBottom: 16,
            borderBottom: "2px solid var(--ink)",
          }}
        >
          <Bar className="h-[11px]" width={150} />
          <Bar className="h-[44px]" width={110} />
          <Bar className="h-[11px]" width={200} />
        </div>

        {/* StatStrip: three cells, 1px gap over a hairline ground. */}
        <div
          className="flex flex-wrap items-stretch"
          style={{
            flex: "1 1 420px",
            minWidth: 0,
            gap: 1,
            border: "1px solid var(--hairline)",
            borderRadius: "var(--r-md)",
            background: "var(--hairline)",
            overflow: "hidden",
          }}
        >
          {Array.from({ length: 3 }).map((_, i) => (
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
              <Bar className="h-[10px]" width={84} />
              <Bar className="h-[18px]" width={56} />
            </div>
          ))}
        </div>
      </div>

      {/* Chart + recent roasts */}
      <div
        className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr]"
        style={{ gap: "var(--space-4)" }}
      >
        <PanelSkeleton>
          {/* Seven day columns at the chart's real 132px track height, so the
              panel does not grow when the bars arrive. */}
          <div
            className="flex items-end"
            style={{ gap: "var(--space-2)", borderBottom: "1px solid var(--viz-axis)" }}
          >
            {Array.from({ length: 7 }).map((_, i) => (
              <div
                key={i}
                className="flex flex-col items-center"
                style={{ flex: 1, minWidth: 0, gap: "var(--space-1)" }}
              >
                <span style={{ height: 14 }} />
                <div
                  className="animate-pulse"
                  style={{
                    width: "100%",
                    height: 132,
                    background: "var(--viz-grid)",
                    borderRadius: "var(--r-sm) var(--r-sm) 0 0",
                  }}
                />
              </div>
            ))}
          </div>
          <div className="flex" style={{ gap: "var(--space-2)", marginTop: "var(--space-2)" }}>
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="flex justify-center" style={{ flex: 1, minWidth: 0 }}>
                <Bar className="h-[9px]" width={26} />
              </div>
            ))}
          </div>
        </PanelSkeleton>

        <PanelSkeleton>
          {Array.from({ length: 3 }).map((_, i) => (
            <RowSkeleton key={i} first={i === 0} />
          ))}
        </PanelSkeleton>
      </div>

      {/* Green inventory + orders (or quick actions) */}
      <div className="grid grid-cols-1 lg:grid-cols-2" style={{ gap: "var(--space-4)" }}>
        <PanelSkeleton>
          {/* The inventory table's own header rule, then five ruled rows. */}
          <div
            className="flex items-center justify-between"
            style={{
              paddingBottom: "var(--space-2)",
              borderBottom: "1px solid var(--hairline-strong)",
            }}
          >
            <Bar className="h-[9px]" width={48} />
            <Bar className="h-[9px]" width={56} />
          </div>
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center justify-between"
              style={{
                gap: "var(--space-3)",
                padding: "var(--space-3) 0",
                borderBottom: "1px solid var(--hairline)",
              }}
            >
              <Bar className="h-[12px] flex-1" />
              <Bar className="h-[12px] shrink-0" width={48} />
              <Bar className="h-[16px] shrink-0" width={56} />
            </div>
          ))}
        </PanelSkeleton>

        <PanelSkeleton>
          {Array.from({ length: 4 }).map((_, i) => (
            <RowSkeleton key={i} first={i === 0} />
          ))}
        </PanelSkeleton>
      </div>
    </div>
  );
}

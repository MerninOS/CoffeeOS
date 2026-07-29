/**
 * The /products route skeleton, on instrument (CoffeeOS#69 Stage B).
 *
 * Easy to miss, and it matters: this renders on every navigation into the route
 * BEFORE the page does. Left on the loud palette it produced a flash of the
 * other design system — cream card, 3px espresso border, flat offset shadow —
 * that then snapped to a hairline worksheet. Criterion 17 greps the whole
 * directory, which is what caught it.
 *
 * Shaped to match what actually arrives: a hero figure and a ruled strip, then
 * the worksheet rows. A skeleton whose geometry disagrees with the real page is
 * its own kind of flash.
 */

function SkeletonBar({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse ${className ?? ""}`}
      style={{ background: "var(--surface-sunken)", borderRadius: "var(--r-sm)" }}
    />
  );
}

export default function ProductsLoading() {
  return (
    <div style={{ maxWidth: "var(--content-max)", margin: "0 auto", padding: "var(--space-6)" }}>
      {/* Header */}
      <div className="flex items-start justify-between" style={{ marginBottom: "var(--space-6)" }}>
        <div className="space-y-2">
          <SkeletonBar className="h-[38px] w-44" />
          <SkeletonBar className="h-[14px] w-64" />
        </div>
        <div className="flex gap-2.5">
          <SkeletonBar className="h-[34px] w-32" />
          <SkeletonBar className="h-[34px] w-32" />
        </div>
      </div>

      {/* Hero + strip */}
      <div className="flex flex-wrap items-end" style={{ gap: "var(--space-6)", marginBottom: "var(--space-5)" }}>
        <div style={{ flex: "0 0 300px" }} className="space-y-2">
          <SkeletonBar className="h-[11px] w-20" />
          <SkeletonBar className="h-[52px] w-28" />
          <div style={{ borderBottom: "1px solid var(--hairline-strong)", paddingTop: 8 }} />
        </div>
        <div style={{ flex: "1 1 480px", minWidth: 0 }} className="grid grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="space-y-2"
              style={{
                padding: "0 var(--pad-cell)",
                borderLeft: i === 0 ? "none" : "1px solid var(--hairline)",
              }}
            >
              <SkeletonBar className="h-[11px] w-16" />
              <SkeletonBar className="h-[22px] w-14" />
            </div>
          ))}
        </div>
      </div>

      {/* Worksheet */}
      <div
        style={{
          border: "1px solid var(--hairline)",
          borderRadius: "var(--r-md)",
          overflow: "hidden",
          background: "var(--surface)",
        }}
      >
        <div
          className="flex items-center justify-between px-3"
          style={{
            height: 34,
            background: "var(--surface-sunken)",
            borderBottom: "1px solid var(--hairline-strong)",
          }}
        >
          <SkeletonBar className="h-[9px] w-20" />
          <SkeletonBar className="h-[9px] w-24" />
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 px-3"
            style={{
              height: 40,
              borderBottom: i < 5 ? "1px solid var(--hairline)" : "none",
            }}
          >
            <SkeletonBar className="h-[26px] w-[26px] shrink-0" />
            <div className="flex-1 space-y-1">
              <SkeletonBar className="h-[12px] w-44" />
              <SkeletonBar className="h-[9px] w-24" />
            </div>
            <SkeletonBar className="h-[12px] w-16 shrink-0" />
            <SkeletonBar className="h-[12px] w-16 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}

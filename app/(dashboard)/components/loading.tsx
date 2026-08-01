/**
 * The /components route skeleton, on instrument (CoffeeOS#73 Stage B).
 *
 * Easy to miss, and it matters: this renders on every navigation into the route
 * BEFORE the page does. Left on the loud palette it produced a flash of the
 * other design system — chalk card, 3px espresso border, flat offset shadow —
 * that then snapped to a hairline worksheet. The Stage B plan did not list this
 * file at all; tests/unit/components-tokens.spec.ts greps the whole directory,
 * which is what caught it.
 *
 * Shaped to match what actually arrives: a hero slot and a ruled strip, then the
 * worksheet's ruled rows at their real 40px height. A skeleton whose geometry
 * disagrees with the real page is its own kind of flash.
 */

function SkeletonBar({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse ${className ?? ""}`}
      style={{ background: "var(--surface-sunken)", borderRadius: "var(--r-sm)" }}
    />
  );
}

export default function ComponentsLoading() {
  return (
    <div
      style={{
        maxWidth: "var(--content-max)",
        margin: "0 auto",
        padding: "var(--space-6)",
      }}
    >
      {/* Header */}
      <div
        className="flex items-start justify-between"
        style={{ marginBottom: "var(--space-6)" }}
      >
        <div className="space-y-2">
          <SkeletonBar className="h-[38px] w-52" />
          <SkeletonBar className="h-[14px] w-96" />
        </div>
        <SkeletonBar className="h-[34px] w-36" />
      </div>

      {/* Hero + census strip */}
      <div
        className="flex flex-wrap items-end"
        style={{ gap: "var(--space-6)", marginBottom: "var(--space-5)" }}
      >
        <div style={{ flex: "0 0 268px" }} className="space-y-2">
          <SkeletonBar className="h-[11px] w-20" />
          <SkeletonBar className="h-[46px] w-24" />
          <div style={{ borderBottom: "2px solid var(--hairline-strong)", paddingTop: 8 }} />
        </div>
        <div
          style={{
            flex: "1 1 440px",
            minWidth: 0,
            border: "1px solid var(--hairline)",
            borderRadius: "var(--r-md)",
            background: "var(--surface)",
            display: "flex",
          }}
        >
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="space-y-2"
              style={{
                flex: 1,
                padding: "var(--space-4)",
                borderLeft: i === 0 ? undefined : "1px solid var(--hairline)",
              }}
            >
              <SkeletonBar className="h-[11px] w-16" />
              <SkeletonBar className="h-[22px] w-10" />
            </div>
          ))}
        </div>
      </div>

      {/* Search */}
      <div style={{ marginBottom: "var(--space-4)" }}>
        <SkeletonBar className="h-[38px] w-80" />
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
          style={{
            height: 32,
            background: "var(--surface-sunken)",
            borderBottom: "1px solid var(--hairline-strong)",
          }}
        />
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center justify-between"
            style={{
              minHeight: 40,
              padding: "0 12px",
              borderBottom: "1px solid var(--hairline)",
            }}
          >
            <SkeletonBar className="h-[13px] w-48" />
            <SkeletonBar className="h-[13px] w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}

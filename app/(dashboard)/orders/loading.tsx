/**
 * The /orders loading skeleton, on the instrument design system.
 *
 * Rebuilt alongside the page itself (CoffeeOS#65 Stage B): it is the first thing
 * the route paints, so leaving it on the loud palette would flash the wrong
 * design system for the length of every navigation. Its shape mirrors what
 * actually arrives — one hero figure, one ruled strip of four, a filter bar and
 * a worksheet — so nothing jumps when the real content replaces it.
 *
 * Instrument values are read as `var(--token)` through inline styles. Tailwind
 * is layout and the pulse animation only.
 */

function SkeletonBar({
  className,
  width,
}: {
  className?: string;
  width?: number | string;
}) {
  return (
    <div
      className={`animate-pulse ${className ?? ""}`}
      style={{
        width,
        background: "var(--surface-sunken-hover)",
        borderRadius: "var(--r-sm)",
      }}
    />
  );
}

export default function OrdersLoading() {
  return (
    <div
      style={{
        maxWidth: "var(--content-max)",
        margin: "0 auto",
        padding: "var(--space-6)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-5)",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
        <SkeletonBar className="h-[40px]" width={200} />
        <SkeletonBar className="h-[14px]" width={260} />
      </div>

      {/* Period control. Sits between the header and the hero on the real page,
          so it has to sit there here too — omitting it shifted everything below
          it upward by the strip's height plus a gap the moment data arrived,
          which is exactly the jump this skeleton exists to prevent. */}
      <div
        className="flex flex-wrap items-center gap-3"
        style={{
          paddingBottom: "var(--space-4)",
          borderBottom: "1px solid var(--hairline)",
        }}
      >
        <SkeletonBar className="h-[11px]" width={52} />
        <SkeletonBar className="h-[30px]" width={260} />
      </div>

      {/* Hero + strip */}
      <div className="flex flex-col gap-6 min-[1400px]:flex-row min-[1400px]:items-end">
        <div className="min-[1400px]:flex-[0_1_340px]">
          <SkeletonBar className="h-[12px] mb-3" width={110} />
          <SkeletonBar className="h-[56px]" width={300} />
          <div style={{ borderBottom: "2px solid var(--hairline)", marginTop: "var(--space-3)" }} />
        </div>
        <div
          className="grid grid-cols-2 min-[1180px]:grid-cols-4 min-[1400px]:flex-1"
          style={{
            border: "1px solid var(--hairline)",
            borderRadius: "var(--r-md)",
          }}
        >
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              style={{
                padding: "var(--space-3) var(--space-4)",
                borderLeft: i === 0 ? undefined : "1px solid var(--hairline)",
              }}
            >
              <SkeletonBar className="h-[11px] mb-3" width={72} />
              <SkeletonBar className="h-[22px]" width={96} />
            </div>
          ))}
        </div>
      </div>

      {/* Filter bar */}
      <div
        className="flex flex-wrap items-center gap-3"
        style={{
          padding: "var(--space-3)",
          background: "var(--surface-sunken)",
          border: "1px solid var(--hairline)",
          borderRadius: "var(--r-md)",
        }}
      >
        <SkeletonBar className="h-[32px]" width={280} />
        <SkeletonBar className="h-[32px]" width={220} />
      </div>

      {/* Worksheet */}
      <div
        style={{
          border: "1px solid var(--hairline)",
          borderRadius: "var(--r-md)",
          background: "var(--surface)",
        }}
      >
        <div
          style={{
            height: 34,
            display: "flex",
            alignItems: "center",
            padding: "0 var(--space-3)",
            background: "var(--surface-sunken)",
            borderBottom: "1px solid var(--hairline-strong)",
          }}
        >
          <SkeletonBar className="h-[10px]" width={120} />
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4"
            style={{
              height: 40,
              padding: "0 var(--space-3)",
              borderBottom: i === 5 ? undefined : "1px solid var(--hairline)",
            }}
          >
            <SkeletonBar className="h-[13px] shrink-0" width={72} />
            <SkeletonBar className="h-[13px] shrink-0" width={92} />
            <SkeletonBar className="h-[18px] shrink-0" width={64} />
            <div className="flex-1" />
            <SkeletonBar className="h-[13px] shrink-0" width={64} />
            <SkeletonBar className="h-[13px] shrink-0" width={64} />
          </div>
        ))}
      </div>
    </div>
  );
}

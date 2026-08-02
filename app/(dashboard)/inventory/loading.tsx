/**
 * The /inventory loading skeleton, on instrument (CoffeeOS#72 Stage 4).
 *
 * Converted because it was missed on the first pass and the token guard caught
 * it: a loud skeleton flashes comic-panel borders and offset shadows for the
 * duration of the server round trip, before the instrument page replaces it.
 * The route is only as converted as its slowest frame.
 *
 * Shapes mirror the real page — hero, ruled stat strip, filter bar, worksheet
 * rows — so the transition does not jump.
 */
function Bar({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse ${className ?? ""}`}
      style={{ background: "var(--hairline)", borderRadius: "var(--r-sm)" }}
    />
  );
}

export default function InventoryLoading() {
  return (
    <div className="p-6" style={{ maxWidth: "var(--content-max)", margin: "0 auto" }}>
      <div className="flex items-start justify-between mb-6">
        <div className="space-y-2">
          <Bar className="h-[34px] w-64" />
          <Bar className="h-[13px] w-80" />
        </div>
        <Bar className="h-[36px] w-32" />
      </div>

      {/* Hero + strip */}
      <div className="flex flex-wrap gap-6 items-end mb-6">
        <div style={{ flex: "0 0 260px" }} className="space-y-2">
          <Bar className="h-[11px] w-28" />
          <Bar className="h-[52px] w-56" />
          <div style={{ borderBottom: "2px solid var(--hairline)" }} />
        </div>
        <div
          style={{
            flex: "1 1 480px",
            minWidth: 0,
            border: "1px solid var(--hairline)",
            borderRadius: "var(--r-md)",
            background: "var(--surface)",
          }}
          className="grid grid-cols-2 sm:grid-cols-4"
        >
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="p-4 space-y-2"
              style={{ borderLeft: i ? "1px solid var(--hairline)" : undefined }}
            >
              <Bar className="h-[10px] w-20" />
              <Bar className="h-[18px] w-16" />
            </div>
          ))}
        </div>
      </div>

      {/* Filter bar */}
      <div
        className="flex items-center gap-3 mb-4"
        style={{
          padding: 10,
          background: "var(--surface-sunken)",
          border: "1px solid var(--hairline)",
          borderRadius: "var(--r-md)",
        }}
      >
        <Bar className="h-[30px] w-[260px]" />
        <Bar className="h-[30px] w-[210px]" />
        <Bar className="h-[30px] w-[170px]" />
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
          className="h-[34px]"
          style={{
            background: "var(--surface-sunken)",
            borderBottom: "1px solid var(--hairline-strong)",
          }}
        />
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center justify-between px-3 h-10"
            style={{ borderBottom: "1px solid var(--hairline)" }}
          >
            <Bar className="h-[13px] w-48" />
            <Bar className="h-[13px] w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}

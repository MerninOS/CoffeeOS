/**
 * The settings skeleton, drawn to match the converted layout: hero, stat strip,
 * then ruled sections. The loud version faked two generic bordered panels, so
 * the swap to real content jumped.
 *
 * It cannot know the role — it is a route-level Suspense fallback with no props
 * — so it always draws the owner shape, and a roaster sees two sections flash
 * that never arrive. Accepted knowingly (CoffeeOS#74 criterion 19); moving the
 * role read above the boundary is more than this ticket.
 */
function Bar({ w, h = 12 }: { w: number | string; h?: number }) {
  return (
    <div
      className="animate-pulse"
      style={{
        width: w,
        height: h,
        borderRadius: "var(--r-sm)",
        background: "var(--surface-sunken)",
      }}
    />
  );
}

function SectionSkeleton({ rows }: { rows: number }) {
  return (
    <section style={{ paddingTop: 34 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          paddingBottom: 10,
          borderBottom: "1px solid var(--hairline-strong)",
        }}
      >
        <Bar w={90} h={11} />
        <Bar w={120} h={11} />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            gap: 24,
            padding: "18px 0",
            borderBottom: "1px solid var(--hairline)",
          }}
        >
          <Bar w={140} h={11} />
          <Bar w="40%" h={14} />
        </div>
      ))}
    </section>
  );
}

export default function SettingsLoading() {
  return (
    <div className="flex flex-col min-h-full pb-28">
      <div className="px-6 pt-6" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Bar w={90} h={11} />
          <Bar w={280} h={56} />
          <Bar w={420} h={12} />
        </div>
        <div
          style={{
            display: "flex",
            border: "1px solid var(--hairline)",
            borderRadius: "var(--r-md)",
            overflow: "hidden",
          }}
        >
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                flex: 1,
                padding: "14px 16px",
                display: "flex",
                flexDirection: "column",
                gap: 8,
                borderLeft: i ? "1px solid var(--hairline)" : "none",
              }}
            >
              <Bar w={60} h={10} />
              <Bar w={40} h={22} />
            </div>
          ))}
        </div>
        <SectionSkeleton rows={3} />
        <SectionSkeleton rows={2} />
      </div>
    </div>
  );
}

function SkeletonBar({ className }: { className?: string }) {
  return (
    <div
      className={`bg-fog/60 rounded-[6px] animate-pulse ${className ?? ""}`}
    />
  );
}

function SkeletonPanel({ rows = 3 }: { rows?: number }) {
  return (
    <div className="bg-chalk border-[3px] border-espresso rounded-[16px] shadow-flat-md overflow-hidden">
      <div className="px-5 py-4 border-b-2 border-espresso bg-cream">
        <SkeletonBar className="h-[14px] w-32" />
      </div>
      <div className="p-5 space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <SkeletonBar key={i} className="h-[38px] w-full" />
        ))}
      </div>
    </div>
  );
}

export default function DashboardLoading() {
  return (
    <div className="p-6 space-y-6">
      <div className="space-y-1.5">
        <SkeletonBar className="h-[36px] w-48" />
        <SkeletonBar className="h-[13px] w-64" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-chalk border-[3px] border-espresso rounded-[14px] p-4 shadow-flat-md animate-pulse">
            <SkeletonBar className="h-[11px] w-20 mb-3" />
            <SkeletonBar className="h-[28px] w-24" />
          </div>
        ))}
      </div>
      <SkeletonPanel rows={4} />
    </div>
  );
}

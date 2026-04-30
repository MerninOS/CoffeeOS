function SkeletonBar({ className }: { className?: string }) {
  return <div className={`bg-fog/60 rounded-[6px] animate-pulse ${className ?? ""}`} />;
}

function SkeletonPanel({ rows = 2 }: { rows?: number }) {
  return (
    <div className="bg-chalk border-[3px] border-espresso rounded-[16px] shadow-flat-md overflow-hidden">
      <div className="px-5 py-4 border-b-2 border-espresso bg-cream">
        <SkeletonBar className="h-[14px] w-36" />
      </div>
      <div className="p-5 space-y-4">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <SkeletonBar className="h-[11px] w-24" />
            <SkeletonBar className="h-[42px] w-full rounded-[10px]" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SettingsLoading() {
  return (
    <div className="p-6 space-y-6">
      <div className="space-y-1.5">
        <SkeletonBar className="h-[36px] w-32" />
        <SkeletonBar className="h-[13px] w-56" />
      </div>
      <SkeletonPanel rows={2} />
      <SkeletonPanel rows={3} />
    </div>
  );
}

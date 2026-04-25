function SkeletonBar({ className }: { className?: string }) {
  return <div className={`bg-fog/60 rounded-[6px] animate-pulse ${className ?? ""}`} />;
}

export default function RoastingLoading() {
  return (
    <div className="p-6 space-y-6">
      {/* Roasted stock panel */}
      <div className="bg-chalk border-[3px] border-espresso rounded-[16px] shadow-flat-md overflow-hidden">
        <div className="px-5 py-4 border-b-2 border-espresso bg-cream flex items-center justify-between">
          <SkeletonBar className="h-[14px] w-40" />
          <SkeletonBar className="h-[26px] w-20 rounded-full" />
        </div>
        <div className="p-5 grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between rounded-[10px] border-[2px] border-fog bg-cream px-4 py-2.5 animate-pulse">
              <div className="space-y-1.5">
                <SkeletonBar className="h-[13px] w-28" />
                <SkeletonBar className="h-[11px] w-16" />
              </div>
              <div className="text-right space-y-1.5">
                <SkeletonBar className="h-[13px] w-14" />
                <SkeletonBar className="h-[10px] w-8" />
              </div>
            </div>
          ))}
        </div>
      </div>
      {/* Sessions panel */}
      <div className="bg-chalk border-[3px] border-espresso rounded-[16px] shadow-flat-md overflow-hidden">
        <div className="px-5 py-4 border-b-2 border-espresso bg-cream">
          <SkeletonBar className="h-[14px] w-32" />
        </div>
        <div className="p-5 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 rounded-[10px] border-[2px] border-fog bg-cream px-4 py-3 animate-pulse">
              <div className="flex-1 space-y-1.5">
                <SkeletonBar className="h-[13px] w-36" />
                <SkeletonBar className="h-[11px] w-24" />
              </div>
              <SkeletonBar className="h-[22px] w-16 rounded-full shrink-0" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

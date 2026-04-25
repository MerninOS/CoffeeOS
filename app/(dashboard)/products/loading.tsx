function SkeletonBar({ className }: { className?: string }) {
  return <div className={`bg-fog/60 rounded-[6px] animate-pulse ${className ?? ""}`} />;
}

export default function ProductsLoading() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div className="space-y-1.5">
          <SkeletonBar className="h-[36px] w-36" />
          <SkeletonBar className="h-[13px] w-56" />
        </div>
        <SkeletonBar className="h-[38px] w-32 rounded-full" />
      </div>
      <div className="bg-chalk border-[3px] border-espresso rounded-[16px] shadow-flat-md overflow-hidden">
        <div className="px-5 py-4 border-b-2 border-espresso bg-cream flex items-center justify-between">
          <SkeletonBar className="h-[14px] w-24" />
          <SkeletonBar className="h-[26px] w-16 rounded-full" />
        </div>
        <div className="p-5 space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 rounded-[10px] border-[2px] border-fog bg-cream px-4 py-3 animate-pulse">
              <SkeletonBar className="h-10 w-10 rounded-[8px] shrink-0" />
              <div className="flex-1 space-y-1.5">
                <SkeletonBar className="h-[13px] w-40" />
                <SkeletonBar className="h-[11px] w-24" />
              </div>
              <SkeletonBar className="h-[13px] w-16 shrink-0" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

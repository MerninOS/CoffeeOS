function SkeletonBar({ className }: { className?: string }) {
  return <div className={`bg-fog/60 rounded-[6px] animate-pulse ${className ?? ""}`} />;
}

export default function InventoryLoading() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div className="space-y-1.5">
          <SkeletonBar className="h-[36px] w-36" />
          <SkeletonBar className="h-[13px] w-64" />
        </div>
        <SkeletonBar className="h-[38px] w-36 rounded-full" />
      </div>
      <div className="bg-chalk border-[3px] border-espresso rounded-[16px] shadow-flat-md overflow-hidden">
        <div className="px-5 py-4 border-b-2 border-espresso bg-cream flex items-center justify-between">
          <SkeletonBar className="h-[14px] w-28" />
          <SkeletonBar className="h-[26px] w-20 rounded-full" />
        </div>
        <div className="p-5 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between rounded-[10px] border-[2px] border-fog bg-cream px-4 py-3 animate-pulse">
              <div className="space-y-1.5">
                <SkeletonBar className="h-[13px] w-36" />
                <SkeletonBar className="h-[11px] w-20" />
              </div>
              <div className="text-right space-y-1.5">
                <SkeletonBar className="h-[13px] w-16" />
                <SkeletonBar className="h-[10px] w-10" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

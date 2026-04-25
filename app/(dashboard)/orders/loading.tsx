function SkeletonBar({ className }: { className?: string }) {
  return <div className={`bg-fog/60 rounded-[6px] animate-pulse ${className ?? ""}`} />;
}

export default function OrdersLoading() {
  return (
    <div className="p-6 space-y-6">
      <div className="space-y-1.5">
        <SkeletonBar className="h-[36px] w-28" />
        <SkeletonBar className="h-[13px] w-52" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-chalk border-[3px] border-espresso rounded-[14px] p-4 shadow-flat-md animate-pulse">
            <SkeletonBar className="h-[11px] w-20 mb-3" />
            <SkeletonBar className="h-[28px] w-16" />
          </div>
        ))}
      </div>
      <div className="bg-chalk border-[3px] border-espresso rounded-[16px] shadow-flat-md overflow-hidden">
        <div className="px-5 py-4 border-b-2 border-espresso bg-cream">
          <SkeletonBar className="h-[14px] w-20" />
        </div>
        <div className="p-5 space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 rounded-[10px] border-[2px] border-fog bg-cream px-4 py-3 animate-pulse">
              <div className="flex-1 space-y-1.5">
                <SkeletonBar className="h-[13px] w-32" />
                <SkeletonBar className="h-[11px] w-20" />
              </div>
              <SkeletonBar className="h-[22px] w-20 rounded-full shrink-0" />
              <SkeletonBar className="h-[13px] w-14 shrink-0" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

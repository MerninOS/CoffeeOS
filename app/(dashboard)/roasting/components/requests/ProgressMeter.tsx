"use client";

export function ProgressMeter({ fulfilled, requested }: { fulfilled: number; requested: number }) {
  const progressPercent = (fulfilled / requested) * 100;
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-2 bg-fog rounded-full overflow-hidden border border-espresso/20">
        <div
          className="h-full bg-honey rounded-full"
          style={{ width: `${Math.min(progressPercent, 100)}%` }}
        />
      </div>
      <span className="text-[10px] text-espresso/50 font-medium whitespace-nowrap">
        {fulfilled.toLocaleString()} / {requested.toLocaleString()}g
      </span>
    </div>
  );
}

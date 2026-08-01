"use client";

import { Clock, Coffee, CheckCircle2, XCircle } from "lucide-react";
import type { RoastPriority, RoastStatus } from "./types";

const priorityConfig = {
  low: { label: "Low", className: "bg-fog/60 text-espresso border-fog" },
  normal: { label: "Normal", className: "bg-sky/20 text-espresso border-sky/40" },
  high: { label: "High", className: "bg-sun/30 text-espresso border-sun/60" },
  urgent: { label: "Urgent", className: "bg-tomato text-cream border-espresso" },
};

const statusConfig = {
  pending: { label: "Pending", Icon: Clock, className: "bg-fog/60 text-espresso border-fog" },
  in_progress: { label: "In Progress", Icon: Coffee, className: "bg-honey/20 text-espresso border-honey/40" },
  fulfilled: { label: "Fulfilled", Icon: CheckCircle2, className: "bg-matcha/20 text-matcha border-matcha/40" },
  cancelled: { label: "Cancelled", Icon: XCircle, className: "bg-espresso/10 text-espresso/60 border-fog" },
};

export function PriorityPill({ priority }: { priority: RoastPriority }) {
  const cfg = priorityConfig[priority];
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full border-[1.5px] text-[10px] font-extrabold uppercase tracking-[.06em] ${cfg.className}`}
    >
      {cfg.label}
    </span>
  );
}

export function StatusPill({ status }: { status: RoastStatus }) {
  const cfg = statusConfig[status];
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border-[1.5px] text-[10px] font-extrabold uppercase tracking-[.06em] ${cfg.className}`}
    >
      <cfg.Icon size={10} strokeWidth={2.2} />
      {cfg.label}
    </span>
  );
}

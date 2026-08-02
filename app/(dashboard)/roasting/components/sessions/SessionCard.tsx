"use client";

import Link from "next/link";
import { format } from "date-fns";
import { Trash2, Eye } from "lucide-react";
import type { Session } from "./types";
import { Btn } from "./primitives";

interface SessionCardProps {
  session: Session;
  calcWeightLoss: (green: number, roasted: number) => number | null;
  weightLossColor: (pct: number) => string;
  onDelete: (id: string) => void;
}

export function SessionCard({ session, calcWeightLoss, weightLossColor, onDelete }: SessionCardProps) {
  const wl = calcWeightLoss(session.total_green_weight_g, session.total_roasted_weight_g);
  return (
    <div
      data-testid="session-card"
      className="bg-chalk border-[3px] border-espresso rounded-[14px] shadow-flat-sm p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <Link
            href={`/roasting/sessions/${session.id}`}
            className="text-[14px] font-extrabold text-espresso hover:text-tomato transition-colors block"
          >
            {format(new Date(session.session_date), "MMM d, yyyy")}
          </Link>
          <p className="text-[12px] text-espresso/50 font-medium truncate mt-0.5">
            {session.vendor_name}
          </p>
        </div>
        <span className="inline-flex items-center px-2 py-1 rounded-full border-[2px] border-espresso bg-fog/40 text-[10px] font-extrabold text-espresso shrink-0">
          {session.batch_count} {session.batch_count === 1 ? "batch" : "batches"}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {[
          { label: "Roasted", value: `${session.total_roasted_weight_g.toFixed(0)}g` },
          {
            label: "Loss",
            value: wl !== null
              ? <span className={`font-extrabold ${weightLossColor(wl)}`}>{wl.toFixed(1)}%</span>
              : <span className="text-espresso/30">—</span>,
          },
          {
            label: "Cost",
            value: session.session_toll_cost !== null
              ? `$${session.session_toll_cost.toFixed(2)}`
              : <span className="text-espresso/30">—</span>,
          },
        ].map((stat) => (
          <div key={stat.label}>
            <span className="text-[10px] text-espresso/40 font-extrabold uppercase tracking-[.08em] block">
              {stat.label}
            </span>
            <span className="text-[13px] font-bold text-espresso">{stat.value}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <Btn href={`/roasting/sessions/${session.id}`} className="flex-1 justify-center">
          <Eye size={11} strokeWidth={2.2} />
          View Session
        </Btn>
        <button
          onClick={() => onDelete(session.id)}
          className="flex h-8 w-8 items-center justify-center rounded-[8px] border-[2.5px] border-espresso text-tomato hover:bg-tomato/10 transition-all"
        >
          <Trash2 size={13} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}

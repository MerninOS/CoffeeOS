"use client";

import Link from "next/link";
import { format } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Trash2, Eye } from "lucide-react";
import type { Session } from "./types";

interface SessionsTableProps {
  sessions: Session[];
  calcWeightLoss: (green: number, roasted: number) => number | null;
  weightLossColor: (pct: number) => string;
  onDelete: (id: string) => void;
}

export function SessionsTable({ sessions, calcWeightLoss, weightLossColor, onDelete }: SessionsTableProps) {
  return (
    <div data-testid="sessions-table" className="hidden md:block bg-chalk border-[3px] border-espresso rounded-[16px] shadow-flat-md overflow-hidden">
      <div className="grid grid-cols-[120px_1fr_70px_90px_90px_90px_90px_48px] border-b-[2px] border-espresso bg-cream px-5 py-2.5">
        {["Date", "Vendor", "Batches", "Green (g)", "Roasted (g)", "Loss", "Cost", ""].map((h) => (
          <div key={h} className="text-[10px] font-extrabold uppercase tracking-[.1em] text-espresso/50">
            {h}
          </div>
        ))}
      </div>
      <div className="divide-y-[1.5px] divide-dashed divide-fog">
        {sessions.map((session) => {
          const wl = calcWeightLoss(session.total_green_weight_g, session.total_roasted_weight_g);
          return (
            <div
              key={session.id}
              data-testid="session-row"
              className="grid grid-cols-[120px_1fr_70px_90px_90px_90px_90px_48px] px-5 py-3 items-center"
            >
              <div>
                <Link
                  href={`/roasting/sessions/${session.id}`}
                  data-testid="row-date"
                  className="text-[13px] font-bold text-espresso hover:text-tomato transition-colors"
                >
                  {format(new Date(session.session_date), "MMM d, yyyy")}
                </Link>
              </div>
              <div data-testid="row-vendor" className="text-[13px] text-espresso/60 font-medium truncate pr-3">
                {session.vendor_name}
              </div>
              <div data-testid="row-batches" className="text-[13px] font-bold text-espresso text-center">
                {session.batch_count}
              </div>
              <div data-testid="row-green" className="text-[13px] font-medium text-espresso text-right">
                {session.total_green_weight_g.toFixed(0)}
              </div>
              <div data-testid="row-roasted" className="text-[13px] font-medium text-espresso text-right">
                {session.total_roasted_weight_g.toFixed(0)}
              </div>
              <div data-testid="row-loss" className="text-right">
                {wl !== null ? (
                  <span className={`text-[13px] font-extrabold ${weightLossColor(wl)}`}>
                    {wl.toFixed(1)}%
                  </span>
                ) : (
                  <span className="text-espresso/30 text-[13px]">—</span>
                )}
              </div>
              <div data-testid="row-cost" className="text-[13px] font-bold text-espresso text-right">
                {session.session_toll_cost !== null
                  ? `$${session.session_toll_cost.toFixed(2)}`
                  : <span className="text-espresso/30">—</span>}
              </div>
              <div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button data-testid="session-menu" className="flex h-7 w-7 items-center justify-center rounded-[6px] border-[2px] border-transparent text-espresso/50 hover:border-fog hover:text-espresso hover:bg-fog/30 transition-all">
                      <MoreHorizontal size={14} strokeWidth={2} />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild data-testid="menu-open">
                      <Link href={`/roasting/sessions/${session.id}`}>
                        <Eye className="mr-2 h-4 w-4" />View Details
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      data-testid="menu-delete"
                      onClick={() => onDelete(session.id)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

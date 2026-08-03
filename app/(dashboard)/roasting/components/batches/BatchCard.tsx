"use client";

import Link from "next/link";
import { format } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Trash2, Eye, Package, Plus } from "lucide-react";
import type { Batch } from "./types";
import { lossColor } from "./costing";

interface BatchCardProps {
  batches: Batch[];
  onCreateComponent: (batch: Batch) => void;
  onDelete: (id: string) => void;
}

export function BatchCard({ batches, onCreateComponent, onDelete }: BatchCardProps) {
  return (
    <div className="space-y-2 md:hidden">
      {batches.map((batch) => (
        <div
          key={batch.id}
          className="bg-chalk border-[2.5px] border-espresso rounded-[12px] shadow-flat-sm p-3"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-bold text-espresso truncate">{batch.coffee_name}</p>
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                {batch.roasting_sessions ? (
                  <Link
                    href={`/roasting/sessions/${batch.roasting_sessions.id}`}
                    className="text-[11px] text-espresso/50 font-medium hover:text-tomato transition-colors"
                  >
                    {format(new Date(batch.roasting_sessions.session_date), "MMM d, yyyy")}
                  </Link>
                ) : (
                  <span className="text-[11px] text-espresso/50 font-medium">
                    {format(new Date(batch.batch_date), "MMM d, yyyy")}
                  </span>
                )}
                {batch.lot_code && (
                  <span className="inline-flex items-center px-1.5 py-0 rounded-full border-[1.5px] border-fog bg-fog/40 text-[9px] font-extrabold uppercase tracking-[.06em] text-espresso">
                    {batch.lot_code}
                  </span>
                )}
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex h-7 w-7 items-center justify-center rounded-[6px] border-[2px] border-fog text-espresso/50 hover:text-espresso hover:border-espresso/40 hover:bg-fog/30 transition-all shrink-0">
                  <MoreHorizontal size={14} strokeWidth={2} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {batch.roasting_sessions && (
                  <DropdownMenuItem asChild>
                    <Link href={`/roasting/sessions/${batch.roasting_sessions.id}`}>
                      <Eye className="mr-2 h-4 w-4" />View Session
                    </Link>
                  </DropdownMenuItem>
                )}
                {!batch.component_id && (
                  <DropdownMenuItem onClick={() => onCreateComponent(batch)}>
                    <Package className="mr-2 h-4 w-4" />Create Component
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => onDelete(batch.id)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="mt-2 grid grid-cols-4 gap-1">
            {[
              { label: "Green", value: `${batch.green_weight_g.toFixed(0)}g` },
              { label: "Roasted", value: `${batch.roasted_weight_g.toFixed(0)}g` },
              {
                label: "Loss",
                value: (
                  <span className={`font-extrabold ${lossColor(batch.loss_percent)}`}>
                    {batch.loss_percent.toFixed(1)}%
                  </span>
                ),
              },
              { label: "Sellable", value: `${batch.sellable_g.toFixed(0)}g` },
            ].map((stat) => (
              <div key={stat.label}>
                <span className="text-[9px] text-espresso/40 font-extrabold uppercase tracking-[.07em] block">
                  {stat.label}
                </span>
                <span className="text-[12px] font-bold text-espresso">{stat.value}</span>
              </div>
            ))}
          </div>

          {batch.components ? (
            <div className="mt-2">
              <Link
                href="/components"
                className="inline-flex items-center gap-1 text-[11px] font-bold text-espresso hover:text-tomato transition-colors"
              >
                <Package size={10} strokeWidth={2} />
                {batch.components.name}
              </Link>
            </div>
          ) : (
            <button
              onClick={() => onCreateComponent(batch)}
              className="mt-2 flex w-full items-center justify-center gap-1 py-1 rounded-[6px] border-[1.5px] border-dashed border-espresso/30 text-[10px] font-extrabold uppercase tracking-[.07em] text-espresso/50 hover:border-espresso/60 hover:text-espresso hover:bg-fog/20 transition-all"
            >
              <Plus size={10} strokeWidth={2.5} />
              Create Component
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

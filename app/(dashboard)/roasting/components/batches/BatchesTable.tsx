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

interface BatchesTableProps {
  batches: Batch[];
  onCreateComponent: (batch: Batch) => void;
  onDelete: (id: string) => void;
}

export function BatchesTable({ batches, onCreateComponent, onDelete }: BatchesTableProps) {
  return (
    <div data-testid="batches-table" className="hidden md:block bg-chalk border-[3px] border-espresso rounded-[16px] shadow-flat-md overflow-hidden">
      <div className="grid grid-cols-[1fr_110px_80px_80px_80px_80px_80px_130px_48px] border-b-[2px] border-espresso bg-cream px-5 py-2.5">
        {["Coffee", "Session", "Lot Code", "Green (g)", "Roasted (g)", "Loss %", "Sellable (g)", "Component", ""].map((h) => (
          <div key={h} className="text-[10px] font-extrabold uppercase tracking-[.1em] text-espresso/50">
            {h}
          </div>
        ))}
      </div>
      <div className="divide-y-[1.5px] divide-dashed divide-fog">
        {batches.map((batch) => (
          <div
            key={batch.id}
            data-testid="batch-row"
            className="grid grid-cols-[1fr_110px_80px_80px_80px_80px_80px_130px_48px] px-5 py-3 items-center"
          >
            <p data-testid="row-coffee" className="text-[13px] font-bold text-espresso truncate pr-2">{batch.coffee_name}</p>
            <div data-testid="row-session" className="text-[12px] font-medium text-espresso/70">
              {batch.roasting_sessions ? (
                <Link
                  href={`/roasting/sessions/${batch.roasting_sessions.id}`}
                  className="hover:text-tomato transition-colors"
                >
                  {format(new Date(batch.roasting_sessions.session_date), "MMM d, yyyy")}
                </Link>
              ) : (
                format(new Date(batch.batch_date), "MMM d, yyyy")
              )}
            </div>
            <div data-testid="row-lot">
              {batch.lot_code ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full border-[1.5px] border-fog bg-fog/40 text-[10px] font-extrabold text-espresso">
                  {batch.lot_code}
                </span>
              ) : (
                <span className="text-espresso/30 text-[13px]">—</span>
              )}
            </div>
            <div data-testid="row-green" className="text-[13px] font-medium text-espresso text-right">
              {batch.green_weight_g.toFixed(0)}
            </div>
            <div data-testid="row-roasted" className="text-[13px] font-medium text-espresso text-right">
              {batch.roasted_weight_g.toFixed(0)}
            </div>
            <div data-testid="row-loss" className="text-right">
              <span className={`text-[13px] font-extrabold ${lossColor(batch.loss_percent)}`}>
                {batch.loss_percent.toFixed(1)}%
              </span>
            </div>
            <div data-testid="row-sellable" className="text-[13px] font-medium text-espresso text-right">
              {batch.sellable_g.toFixed(0)}
            </div>
            <div data-testid="row-component">
              {batch.components ? (
                <Link
                  href="/components"
                  className="inline-flex items-center gap-1 text-[12px] font-bold text-espresso hover:text-tomato transition-colors"
                >
                  <Package size={11} strokeWidth={2} />
                  <span className="truncate">{batch.components.name}</span>
                </Link>
              ) : (
                <button
                  onClick={() => onCreateComponent(batch)}
                  className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-[.07em] text-espresso/40 hover:text-espresso transition-colors"
                >
                  <Plus size={10} strokeWidth={2.5} />
                  Create
                </button>
              )}
            </div>
            <div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button data-testid="batch-menu" className="flex h-7 w-7 items-center justify-center rounded-[6px] border-[2px] border-transparent text-espresso/50 hover:border-fog hover:text-espresso hover:bg-fog/30 transition-all">
                    <MoreHorizontal size={14} strokeWidth={2} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {batch.roasting_sessions && (
                    <DropdownMenuItem asChild>
                      <Link data-testid="menu-view-session" href={`/roasting/sessions/${batch.roasting_sessions.id}`}>
                        <Eye className="mr-2 h-4 w-4" />View Session
                      </Link>
                    </DropdownMenuItem>
                  )}
                  {!batch.component_id && (
                    <DropdownMenuItem data-testid="menu-create-component" onClick={() => onCreateComponent(batch)}>
                      <Package className="mr-2 h-4 w-4" />Create Component
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    data-testid="menu-delete"
                    onClick={() => onDelete(batch.id)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

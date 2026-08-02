"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MoreHorizontal,
  Edit,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import type { RoastRequest, RoastStatus } from "./types";
import { PriorityPill, StatusPill } from "./Pills";
import { ProgressMeter } from "./ProgressMeter";

interface RequestsTableProps {
  requests: RoastRequest[];
  variant: "active" | "completed";
  onEdit: (request: RoastRequest) => void;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: RoastStatus) => void;
}

export function RequestsTable({ requests, variant, onEdit, onDelete, onStatusChange }: RequestsTableProps) {
  if (variant === "completed") {
    return (
      <div className="hidden md:block">
        <div className="grid grid-cols-[1fr_100px_100px_100px_48px] border-b-[2px] border-espresso bg-cream px-5 py-2.5">
          {["Coffee", "Quantity", "Status", "Completed", ""].map((h) => (
            <div key={h} className="text-[10px] font-extrabold uppercase tracking-[.1em] text-espresso/50">
              {h}
            </div>
          ))}
        </div>
        <div className="divide-y-[1.5px] divide-dashed divide-fog">
          {requests.map((request) => (
            <div key={request.id} data-testid="request-row" className="grid grid-cols-[1fr_100px_100px_100px_48px] px-5 py-3 items-center">
              <p data-testid="row-coffee" className="text-[13px] font-bold text-espresso truncate">
                {request.green_coffee_inventory?.name || "Unknown"}
              </p>
              <div data-testid="row-quantity" className="text-[13px] font-bold text-espresso">
                {request.requested_roasted_g.toLocaleString()}g
              </div>
              <div>
                <StatusPill status={request.status} />
              </div>
              <div className="text-[12px] text-espresso/50 font-medium">
                {new Date(request.created_at).toLocaleDateString()}
              </div>
              <button
                data-testid="request-delete"
                onClick={() => onDelete(request.id)}
                className="flex h-7 w-7 items-center justify-center rounded-[6px] border-[2px] border-transparent text-espresso/30 hover:border-tomato/30 hover:text-tomato hover:bg-tomato/10 transition-all"
              >
                <Trash2 size={13} strokeWidth={2} />
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="hidden md:block">
      <div className="grid grid-cols-[1fr_100px_160px_90px_100px_100px_48px] border-b-[2px] border-espresso bg-cream px-5 py-2.5">
        {["Coffee", "Quantity", "Progress", "Priority", "Due Date", "Status", ""].map((h) => (
          <div key={h} className="text-[10px] font-extrabold uppercase tracking-[.1em] text-espresso/50">
            {h}
          </div>
        ))}
      </div>
      <div className="divide-y-[1.5px] divide-dashed divide-fog">
        {requests.map((request) => {
          const isOverdue = request.due_date && new Date(request.due_date) < new Date() && request.status !== "fulfilled";
          return (
            <div key={request.id} data-testid="request-row" className="grid grid-cols-[1fr_100px_160px_90px_100px_100px_48px] px-5 py-3 items-center">
              <div className="min-w-0">
                <p data-testid="row-coffee" className="text-[13px] font-bold text-espresso truncate">
                  {request.green_coffee_inventory?.name || "Unknown"}
                </p>
                {request.green_coffee_inventory?.origin && (
                  <p className="text-[11px] text-espresso/50 font-medium truncate">
                    {request.green_coffee_inventory.origin}
                  </p>
                )}
              </div>
              <div data-testid="row-quantity" className="text-[13px] font-bold text-espresso">
                {request.requested_roasted_g.toLocaleString()}g
              </div>
              <ProgressMeter
                fulfilled={request.fulfilled_roasted_g}
                requested={request.requested_roasted_g}
              />
              <div>
                <PriorityPill priority={request.priority} />
              </div>
              <div className="text-[12px] font-medium text-espresso">
                {request.due_date ? (
                  <div className="flex items-center gap-1">
                    {isOverdue && <AlertTriangle size={11} className="text-tomato shrink-0" />}
                    <span className={isOverdue ? "text-tomato" : ""}>
                      {new Date(request.due_date).toLocaleDateString()}
                    </span>
                  </div>
                ) : (
                  <span className="text-espresso/30">—</span>
                )}
              </div>
              <div>
                <StatusPill status={request.status} />
              </div>
              <div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button data-testid="request-menu" className="flex h-7 w-7 items-center justify-center rounded-[6px] border-[2px] border-transparent text-espresso/50 hover:border-fog hover:text-espresso hover:bg-fog/30 transition-all cursor-pointer">
                      <MoreHorizontal size={14} strokeWidth={2} />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem data-testid="menu-edit" onClick={() => onEdit(request)}>
                      <Edit className="mr-2 h-4 w-4" />Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem data-testid="menu-fulfill" onClick={() => onStatusChange(request.id, "fulfilled")}>
                      <CheckCircle2 className="mr-2 h-4 w-4" />Mark Fulfilled
                    </DropdownMenuItem>
                    <DropdownMenuItem data-testid="menu-cancel" onClick={() => onStatusChange(request.id, "cancelled")}>
                      <XCircle className="mr-2 h-4 w-4" />Cancel
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      data-testid="menu-delete"
                      onClick={() => onDelete(request.id)}
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

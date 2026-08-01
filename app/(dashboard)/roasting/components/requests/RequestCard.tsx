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

interface RequestCardProps {
  request: RoastRequest;
  variant: "active" | "completed";
  onEdit: (request: RoastRequest) => void;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: RoastStatus) => void;
}

export function RequestCard({ request, variant, onEdit, onDelete, onStatusChange }: RequestCardProps) {
  if (variant === "completed") {
    return (
      <div className="flex items-center justify-between p-4">
        <div>
          <p className="text-[13px] font-bold text-espresso">
            {request.green_coffee_inventory?.name || "Unknown"}
          </p>
          <p className="text-[11px] text-espresso/50 font-medium">
            {request.requested_roasted_g.toLocaleString()}g
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusPill status={request.status} />
          <button
            onClick={() => onDelete(request.id)}
            className="flex h-7 w-7 items-center justify-center rounded-[6px] border-[2px] border-transparent text-espresso/30 hover:border-tomato/30 hover:text-tomato hover:bg-tomato/10 transition-all"
          >
            <Trash2 size={13} strokeWidth={2} />
          </button>
        </div>
      </div>
    );
  }

  const progressPercent = (request.fulfilled_roasted_g / request.requested_roasted_g) * 100;
  const isOverdue = request.due_date && new Date(request.due_date) < new Date() && request.status !== "fulfilled";
  return (
    <div className="p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[13px] font-bold text-espresso">
            {request.green_coffee_inventory?.name || "Unknown"}
          </p>
          {request.green_coffee_inventory?.origin && (
            <p className="text-[11px] text-espresso/50 font-medium">
              {request.green_coffee_inventory.origin}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <PriorityPill priority={request.priority} />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex h-7 w-7 items-center justify-center rounded-[6px] border-[2px] border-fog text-espresso/50 hover:text-espresso hover:bg-fog/30 transition-all cursor-pointer">
                <MoreHorizontal size={14} strokeWidth={2} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(request)}>
                <Edit className="mr-2 h-4 w-4" />Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onStatusChange(request.id, "fulfilled")}>
                <CheckCircle2 className="mr-2 h-4 w-4" />Mark Fulfilled
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onStatusChange(request.id, "cancelled")}>
                <XCircle className="mr-2 h-4 w-4" />Cancel
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onDelete(request.id)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-espresso/50 font-medium">Progress</span>
          <span className="font-bold text-espresso">
            {request.fulfilled_roasted_g.toLocaleString()} / {request.requested_roasted_g.toLocaleString()}g
          </span>
        </div>
        <div className="w-full h-2 bg-fog rounded-full overflow-hidden border border-espresso/20">
          <div
            className="h-full bg-honey rounded-full"
            style={{ width: `${Math.min(progressPercent, 100)}%` }}
          />
        </div>
      </div>
      <div className="flex items-center justify-between">
        <StatusPill status={request.status} />
        {request.due_date && (
          <div className="flex items-center gap-1 text-[11px] font-medium">
            {isOverdue && <AlertTriangle size={11} className="text-tomato" />}
            <span className={isOverdue ? "text-tomato" : "text-espresso/50"}>
              Due: {new Date(request.due_date).toLocaleDateString()}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

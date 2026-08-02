"use client";

import type { CSSProperties } from "react";
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
import { IconButton } from "@merninos/ui/instrument";
import { mono, overline, sans } from "@/lib/instrument/tokens";
import type { RoastRequest, RoastStatus } from "./types";
import { PriorityPill, StatusPill } from "./Pills";

/**
 * The mobile (`md:hidden`) half of the queue, retokenized onto instrument
 * (CoffeeOS#71). Kept as its own stacked-row rendering rather than merged
 * with RequestsTable.tsx into one responsive worksheet — see the note there.
 *
 * The progress fraction stays in grams for the same reason as ProgressMeter:
 * the frozen capability spec asserts the literal gram-comma text against this
 * markup too (mobile runs the same `observe`/`create`/`edit` assertions).
 */

const MENU_CONTENT: CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--hairline-strong)",
  borderRadius: "var(--r-md)",
  boxShadow: "var(--shadow-pop)",
  color: "var(--ink)",
  padding: 4,
};

const MENU_ITEM: CSSProperties = {
  fontFamily: "var(--font-sans)",
  fontSize: "var(--fs-body)",
  color: "var(--ink)",
  borderRadius: "var(--r-sm)",
};

const menuTriggerStyle: CSSProperties = {
  display: "flex",
  height: 28,
  width: 28,
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "var(--r-sm)",
  border: "1px solid var(--hairline)",
  color: "var(--ink-muted)",
  background: "transparent",
  cursor: "pointer",
};

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
      <div data-testid="request-card" className="flex items-center justify-between p-4">
        <div>
          <p data-testid="row-coffee" style={{ ...sans, fontWeight: 500, color: "var(--ink)" }}>
            {request.green_coffee_inventory?.name || "Unknown"}
          </p>
          <p data-testid="row-quantity" style={{ ...mono, fontSize: "var(--fs-caption)", color: "var(--ink-muted)" }}>
            {request.requested_roasted_g.toLocaleString()}g
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusPill status={request.status} />
          <IconButton
            size="sm"
            icon={<Trash2 size={13} strokeWidth={2} />}
            aria-label={`Delete ${request.green_coffee_inventory?.name || "request"}`}
            data-testid="request-delete"
            onClick={() => onDelete(request.id)}
          />
        </div>
      </div>
    );
  }

  const progressPercent = (request.fulfilled_roasted_g / request.requested_roasted_g) * 100;
  const isOverdue = request.due_date && new Date(request.due_date) < new Date() && request.status !== "fulfilled";
  return (
    <div data-testid="request-card" className="p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p style={{ ...sans, fontWeight: 500, color: "var(--ink)" }}>
            {request.green_coffee_inventory?.name || "Unknown"}
          </p>
          {request.green_coffee_inventory?.origin && (
            <p style={overline}>{request.green_coffee_inventory.origin}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <PriorityPill priority={request.priority} />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button data-testid="request-menu" style={menuTriggerStyle}>
                <MoreHorizontal size={14} strokeWidth={2} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent data-surface="app" align="end" style={MENU_CONTENT}>
              <DropdownMenuItem data-testid="menu-edit" style={MENU_ITEM} onClick={() => onEdit(request)}>
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                data-testid="menu-fulfill"
                style={MENU_ITEM}
                onClick={() => onStatusChange(request.id, "fulfilled")}
              >
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Mark Fulfilled
              </DropdownMenuItem>
              <DropdownMenuItem
                data-testid="menu-cancel"
                style={MENU_ITEM}
                onClick={() => onStatusChange(request.id, "cancelled")}
              >
                <XCircle className="mr-2 h-4 w-4" />
                Cancel
              </DropdownMenuItem>
              <DropdownMenuItem
                data-testid="menu-delete"
                style={{ ...MENU_ITEM, color: "var(--danger)" }}
                onClick={() => onDelete(request.id)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between" style={{ fontSize: "var(--fs-caption)" }}>
          <span style={{ color: "var(--ink-muted)" }}>Progress</span>
          <span style={{ ...mono, color: "var(--ink)" }}>
            {request.fulfilled_roasted_g.toLocaleString()} / {request.requested_roasted_g.toLocaleString()}g
          </span>
        </div>
        <div
          style={{
            width: "100%",
            height: 6,
            background: "var(--surface-sunken)",
            borderRadius: "var(--r-pill)",
            overflow: "hidden",
            border: "1px solid var(--hairline)",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${Math.min(progressPercent, 100)}%`,
              background: "var(--ink)",
              borderRadius: "var(--r-pill)",
            }}
          />
        </div>
      </div>
      <div className="flex items-center justify-between">
        <StatusPill status={request.status} />
        {request.due_date && (
          <div
            className="flex items-center gap-1"
            style={{ fontSize: "var(--fs-caption)", color: isOverdue ? "var(--danger)" : "var(--ink-muted)" }}
          >
            {isOverdue && <AlertTriangle size={11} />}
            <span>Due: {new Date(request.due_date).toLocaleDateString()}</span>
          </div>
        )}
      </div>
    </div>
  );
}

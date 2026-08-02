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
import { lbs } from "../../units";
import { ProgressMeter } from "./ProgressMeter";

/**
 * The desktop (`hidden md:block`) half of the queue, retokenized onto
 * instrument (CoffeeOS#71). Worksheet idiom, not a card: a sunken 34px
 * overline header, hairline row rules, no zebra. Kept as its own file rather
 * than merged with RequestCard.tsx into one responsive rendering (the
 * ComponentsTable precedent) — that would be a structural change beyond this
 * ticket's restyle scope, and the capability spec's mobile-testid-gap note
 * already documents that the two markups are NOT equivalent today (the mobile
 * card's own dropdown items carry no testids at all).
 *
 * DropdownMenuContent gets `data-surface="app"` because Radix portals it to
 * <body>, outside the instrument token scope — see ProductDialogs.tsx.
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

const HEAD: CSSProperties = {
  ...overline,
  color: "var(--ink-muted)",
  background: "var(--surface-sunken)",
  borderBottom: "1px solid var(--hairline-strong)",
  height: 34,
  display: "flex",
  alignItems: "center",
  padding: "0 12px",
};

const CELL: CSSProperties = {
  ...sans,
  fontSize: "var(--fs-body)",
  color: "var(--ink)",
  minHeight: 40,
  padding: "0 12px",
  display: "flex",
  alignItems: "center",
};

const RULE: CSSProperties = { borderBottom: "1px solid var(--hairline)" };

const TRUNCATE: CSSProperties = { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };

const menuTriggerStyle: CSSProperties = {
  display: "flex",
  height: 28,
  width: 28,
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "var(--r-sm)",
  border: "1px solid transparent",
  color: "var(--ink-muted)",
  background: "transparent",
  cursor: "pointer",
};

const COMPLETED_GRID = "minmax(0,1fr) 100px 100px 100px 44px";
/**
 * The progress column is 210px, not 160px. At 160 the meter plus
 * "4.4 / 11.0 lb" overflowed by 41px into the priority column — the same way
 * /orders shipped an overlapping figure, and invisible to a screenshot at 1%
 * tolerance. tests/e2e/roasting-layout.spec.ts measures it now.
 */
const ACTIVE_GRID = "minmax(0,1fr) 100px 210px 90px 100px 100px 44px";

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
        <div className="grid" style={{ gridTemplateColumns: COMPLETED_GRID }}>
          {["Coffee", "Quantity", "Status", "Completed", ""].map((h) => (
            <div key={h} style={HEAD}>
              {h}
            </div>
          ))}
        </div>
        <div>
          {requests.map((request, i) => (
            <div
              key={request.id}
              data-testid="request-row"
              className="grid items-center"
              style={{ gridTemplateColumns: COMPLETED_GRID, ...(i < requests.length - 1 ? RULE : {}) }}
            >
              <div data-testid="row-coffee" style={{ ...CELL, ...TRUNCATE, fontWeight: 500 }}>
                {request.green_coffee_inventory?.name || "Unknown"}
              </div>
              <div data-testid="row-quantity" style={{ ...CELL, ...mono }}>
                {lbs(request.requested_roasted_g)}
              </div>
              <div style={CELL}>
                <StatusPill status={request.status} />
              </div>
              <div style={{ ...CELL, fontSize: "var(--fs-caption)", color: "var(--ink-muted)" }}>
                {new Date(request.created_at).toLocaleDateString()}
              </div>
              <div style={{ ...CELL, justifyContent: "center" }}>
                <IconButton
                  size="sm"
                  icon={<Trash2 size={13} strokeWidth={2} />}
                  aria-label={`Delete ${request.green_coffee_inventory?.name || "request"}`}
                  data-testid="request-delete"
                  onClick={() => onDelete(request.id)}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="hidden md:block">
      <div className="grid" style={{ gridTemplateColumns: ACTIVE_GRID }}>
        {["Coffee", "Quantity", "Progress", "Priority", "Due Date", "Status", ""].map((h) => (
          <div key={h} style={HEAD}>
            {h}
          </div>
        ))}
      </div>
      <div>
        {requests.map((request, i) => {
          const isOverdue = request.due_date && new Date(request.due_date) < new Date() && request.status !== "fulfilled";
          return (
            <div
              key={request.id}
              data-testid="request-row"
              className="grid items-center"
              style={{ gridTemplateColumns: ACTIVE_GRID, ...(i < requests.length - 1 ? RULE : {}) }}
            >
              <div style={{ ...CELL, flexDirection: "column", alignItems: "flex-start", minWidth: 0, gap: 1 }}>
                <div data-testid="row-coffee" style={{ fontWeight: 500, color: "var(--ink)", width: "100%", ...TRUNCATE }}>
                  {request.green_coffee_inventory?.name || "Unknown"}
                </div>
                {request.green_coffee_inventory?.origin && (
                  <div style={{ ...overline, width: "100%", ...TRUNCATE }}>
                    {request.green_coffee_inventory.origin}
                  </div>
                )}
              </div>
              <div data-testid="row-quantity" style={{ ...CELL, ...mono }}>
                {lbs(request.requested_roasted_g)}
              </div>
              <div style={CELL}>
                <ProgressMeter
                  fulfilled={request.fulfilled_roasted_g}
                  requested={request.requested_roasted_g}
                />
              </div>
              <div style={CELL}>
                <PriorityPill priority={request.priority} />
              </div>
              <div style={{ ...CELL, fontSize: "var(--fs-caption)" }}>
                {request.due_date ? (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      color: isOverdue ? "var(--danger)" : "var(--ink)",
                    }}
                  >
                    {isOverdue && <AlertTriangle size={11} />}
                    {new Date(request.due_date).toLocaleDateString()}
                  </span>
                ) : (
                  <span style={{ color: "var(--ink-subtle)" }}>—</span>
                )}
              </div>
              <div style={CELL}>
                <StatusPill status={request.status} />
              </div>
              <div style={{ ...CELL, justifyContent: "center" }}>
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
          );
        })}
      </div>
    </div>
  );
}

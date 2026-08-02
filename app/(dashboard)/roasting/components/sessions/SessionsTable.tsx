"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { format } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Trash2, Eye } from "lucide-react";
import { mono, overline, sans } from "@/lib/instrument/tokens";
import { microdata } from "./primitives";
import type { Session } from "./types";
import { lossTone } from "../../session-cost";
import { lb } from "../../units";

/**
 * Retokenized onto instrument (CoffeeOS#71), matching the
 * requests/RequestsTable.tsx worksheet idiom: sunken 34px overline header,
 * hairline row rules, no zebra, no card border/offset shadow — the parent
 * (sessions-client.tsx) supplies the single hairline container both this and
 * SessionCard.tsx sit inside, the same split as /requests.
 *
 * `cost_basis` / `cost_mode_label` arrive precomputed on `Session`
 * (session-cost.ts, derived alongside `session_toll_cost` from the same
 * intermediates so the figure and its explanation can never disagree) — this
 * component only renders them, it does not recompute.
 *
 * The loss figure is coloured via `lossTone()` (session-cost.ts) mapped to
 * semantic tokens, not the old `weightLossColor()` returning Tailwind
 * classes — that scale is also drawn as the `YieldBand` above this table.
 */

const TONE_VAR: Record<string, string> = {
  under: "var(--warning)",
  in: "var(--success)",
  over: "var(--danger)",
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
  minHeight: 48,
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

const GRID = "110px minmax(0,1fr) 70px 84px 84px 70px 130px 44px";

interface SessionsTableProps {
  sessions: Session[];
  calcWeightLoss: (green: number, roasted: number) => number | null;
  onDelete: (id: string) => void;
}

export function SessionsTable({ sessions, calcWeightLoss, onDelete }: SessionsTableProps) {
  return (
    <div data-testid="sessions-table" className="hidden md:block">
      <div className="grid" style={{ gridTemplateColumns: GRID }}>
        {["Date", "Vendor", "Batches", "Green (lb)", "Roasted (lb)", "Loss", "Cost", ""].map((h) => (
          <div key={h} style={HEAD}>
            {h}
          </div>
        ))}
      </div>
      <div>
        {sessions.map((session, i) => {
          const wl = calcWeightLoss(session.total_green_weight_g, session.total_roasted_weight_g);
          return (
            <div
              key={session.id}
              data-testid="session-row"
              className="grid items-center"
              style={{ gridTemplateColumns: GRID, ...(i < sessions.length - 1 ? RULE : {}) }}
            >
              <div style={CELL}>
                <Link
                  href={`/roasting/sessions/${session.id}`}
                  data-testid="row-date"
                  style={{ ...sans, fontWeight: 600, color: "var(--ink)", textDecoration: "none" }}
                >
                  {format(new Date(session.session_date), "MMM d, yyyy")}
                </Link>
              </div>
              <div style={{ ...CELL, flexDirection: "column", alignItems: "flex-start", minWidth: 0, gap: 1 }}>
                <div data-testid="row-vendor" style={{ width: "100%", color: "var(--ink-muted)", ...TRUNCATE }}>
                  {session.vendor_name}
                </div>
                {session.cost_mode_label && (
                  <div style={{ ...overline, width: "100%", ...TRUNCATE }}>{session.cost_mode_label}</div>
                )}
              </div>
              <div data-testid="row-batches" style={{ ...CELL, ...mono, justifyContent: "center" }}>
                {session.batch_count}
              </div>
              <div data-testid="row-green" style={{ ...CELL, ...mono, justifyContent: "flex-end" }}>
                {lb(session.total_green_weight_g)}
              </div>
              <div data-testid="row-roasted" style={{ ...CELL, ...mono, justifyContent: "flex-end" }}>
                {lb(session.total_roasted_weight_g)}
              </div>
              <div data-testid="row-loss" style={{ ...CELL, justifyContent: "flex-end" }}>
                {wl !== null ? (
                  <span style={{ ...mono, fontWeight: 700, color: TONE_VAR[lossTone(wl)] }}>{wl.toFixed(1)}%</span>
                ) : (
                  <span style={{ color: "var(--ink-subtle)" }}>—</span>
                )}
              </div>
              <div
                data-testid="row-cost"
                style={{ ...CELL, flexDirection: "column", alignItems: "flex-end", gap: 1 }}
              >
                {session.session_toll_cost !== null ? (
                  <>
                    <span style={{ ...mono, fontWeight: 700, color: "var(--ink)" }}>
                      ${session.session_toll_cost.toFixed(2)}
                    </span>
                    {session.cost_basis && <span style={microdata}>{session.cost_basis}</span>}
                  </>
                ) : (
                  <span style={{ color: "var(--ink-subtle)" }}>—</span>
                )}
              </div>
              <div style={{ ...CELL, justifyContent: "center" }}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button data-testid="session-menu" style={menuTriggerStyle}>
                      <MoreHorizontal size={14} strokeWidth={2} />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent data-surface="app" align="end" style={MENU_CONTENT}>
                    <DropdownMenuItem asChild data-testid="menu-open" style={MENU_ITEM}>
                      <Link href={`/roasting/sessions/${session.id}`}>
                        <Eye className="mr-2 h-4 w-4" />
                        View Details
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      data-testid="menu-delete"
                      style={{ ...MENU_ITEM, color: "var(--danger)" }}
                      onClick={() => onDelete(session.id)}
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

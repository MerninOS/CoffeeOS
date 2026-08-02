"use client";

import Link from "next/link";
import { format } from "date-fns";
import { Trash2, Eye } from "lucide-react";
import { Badge, IconButton } from "@merninos/ui/instrument";
import { mono, overline, sans } from "@/lib/instrument/tokens";
import { lb } from "../../units";
import { lossTone } from "../../session-cost";
import type { Session } from "./types";
import { Btn, microdata } from "./primitives";

/**
 * The mobile (`md:hidden`) half of the sessions list, retokenized onto
 * instrument (CoffeeOS#71). Kept as its own stacked-card rendering rather
 * than merged with SessionsTable.tsx into one responsive worksheet — see the
 * note on RequestsTable.tsx/RequestCard.tsx.
 */

const TONE_VAR: Record<string, string> = {
  under: "var(--warning)",
  in: "var(--success)",
  over: "var(--danger)",
};

interface SessionCardProps {
  session: Session;
  calcWeightLoss: (green: number, roasted: number) => number | null;
  onDelete: (id: string) => void;
}

export function SessionCard({ session, calcWeightLoss, onDelete }: SessionCardProps) {
  const wl = calcWeightLoss(session.total_green_weight_g, session.total_roasted_weight_g);
  return (
    <div data-testid="session-card" className="p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <Link
            href={`/roasting/sessions/${session.id}`}
            style={{ ...sans, fontWeight: 700, color: "var(--ink)", display: "block", textDecoration: "none" }}
          >
            {format(new Date(session.session_date), "MMM d, yyyy")}
          </Link>
          {session.cost_mode_label && (
            <p style={{ ...overline, marginTop: 2 }}>{session.cost_mode_label}</p>
          )}
          <p
            className="truncate"
            style={{ ...sans, fontSize: "var(--fs-caption)", color: "var(--ink-muted)", marginTop: 2 }}
          >
            {session.vendor_name}
          </p>
        </div>
        <Badge tone="neutral" variant="soft" size="sm">
          {session.batch_count} {session.batch_count === 1 ? "batch" : "batches"}
        </Badge>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <span style={{ ...overline, display: "block" }}>Roasted</span>
          <span style={{ ...mono, fontSize: "var(--fs-body)", color: "var(--ink)" }}>
            {lb(session.total_roasted_weight_g)} lb
          </span>
        </div>
        <div>
          <span style={{ ...overline, display: "block" }}>Loss</span>
          {wl !== null ? (
            <span style={{ ...mono, fontSize: "var(--fs-body)", fontWeight: 700, color: TONE_VAR[lossTone(wl)] }}>
              {wl.toFixed(1)}%
            </span>
          ) : (
            <span style={{ ...sans, fontSize: "var(--fs-body)", color: "var(--ink-subtle)" }}>—</span>
          )}
        </div>
        <div>
          <span style={{ ...overline, display: "block" }}>Cost</span>
          {session.session_toll_cost !== null ? (
            <div className="flex flex-col">
              <span style={{ ...mono, fontSize: "var(--fs-body)", fontWeight: 700, color: "var(--ink)" }}>
                ${session.session_toll_cost.toFixed(2)}
              </span>
              {session.cost_basis && <span style={microdata}>{session.cost_basis}</span>}
            </div>
          ) : (
            <span style={{ ...sans, fontSize: "var(--fs-body)", color: "var(--ink-subtle)" }}>—</span>
          )}
        </div>
      </div>
      <div className="flex gap-2">
        <Btn href={`/roasting/sessions/${session.id}`} className="flex-1 justify-center">
          <Eye size={11} strokeWidth={2.2} />
          View Session
        </Btn>
        <IconButton
          size="sm"
          icon={<Trash2 size={13} strokeWidth={2} />}
          aria-label={`Delete session with ${session.vendor_name}`}
          onClick={() => onDelete(session.id)}
        />
      </div>
    </div>
  );
}

"use client";

import { Badge } from "@merninos/ui/instrument";
import { Clock, Coffee, CheckCircle2, XCircle } from "lucide-react";
import type { RoastPriority, RoastStatus } from "./types";

/**
 * Retokenized onto instrument's `Badge` (CoffeeOS#71). No `dot`, no `pulse` —
 * per the approved proposal, urgency/status here is a snapshot re-read from
 * server props on every reload, never a live signal, so a pulsing dot would
 * claim something untrue about the data (see design-rulings.spec.ts).
 *
 * Priority: urgent -> danger, high -> warning, normal/low -> neutral.
 * Status: pending -> neutral, in_progress -> info, fulfilled -> success,
 * cancelled -> neutral.
 */
const priorityConfig: Record<RoastPriority, { label: string; tone: "danger" | "warning" | "neutral" }> = {
  low: { label: "Low", tone: "neutral" },
  normal: { label: "Normal", tone: "neutral" },
  high: { label: "High", tone: "warning" },
  urgent: { label: "Urgent", tone: "danger" },
};

const statusConfig: Record<
  RoastStatus,
  { label: string; Icon: typeof Clock; tone: "neutral" | "info" | "success" }
> = {
  pending: { label: "Pending", Icon: Clock, tone: "neutral" },
  in_progress: { label: "In Progress", Icon: Coffee, tone: "info" },
  fulfilled: { label: "Fulfilled", Icon: CheckCircle2, tone: "success" },
  cancelled: { label: "Cancelled", Icon: XCircle, tone: "neutral" },
};

export function PriorityPill({ priority }: { priority: RoastPriority }) {
  const cfg = priorityConfig[priority];
  return (
    <Badge tone={cfg.tone} variant="soft" size="sm">
      {cfg.label}
    </Badge>
  );
}

export function StatusPill({ status }: { status: RoastStatus }) {
  const cfg = statusConfig[status];
  const Icon = cfg.Icon;
  return (
    <Badge tone={cfg.tone} variant="soft" size="sm">
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
        <Icon size={10} strokeWidth={2.2} />
        {cfg.label}
      </span>
    </Badge>
  );
}

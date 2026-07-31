"use client";

import Link from "next/link";
import { format } from "date-fns";
import { ArrowLeft, Check, Clock } from "lucide-react";
import { Badge, Button, IconButton } from "@merninos/ui/instrument";
import { mono, sans } from "../../components/tokens";
import type { Order } from "./types";

/**
 * Order identity, its states, and the one primary action.
 *
 * The four metric cards used to carry Payment and Fulfillment alongside two
 * money figures, at equal weight. They are STATES, not measurements, so they
 * belong here as badges — which also frees the metric row to be what Instrument
 * requires: one hero figure and a ruled strip.
 *
 * The primary action is INK, never brand red. Red in this system means
 * "happening now / needs you" — the live register — and a button that is merely
 * available is not that. The old page filled this button with --color-tomato.
 */

const FINANCIAL: Record<
  string,
  { tone: "success" | "warning" | "danger" | "neutral"; label: string }
> = {
  paid: { tone: "success", label: "Paid" },
  pending: { tone: "warning", label: "Pending" },
  refunded: { tone: "neutral", label: "Refunded" },
  partially_refunded: { tone: "neutral", label: "Partly refunded" },
};

const FULFILLMENT: Record<string, { tone: "success" | "info" | "neutral"; label: string }> = {
  fulfilled: { tone: "success", label: "Fulfilled" },
  partial: { tone: "info", label: "Partial" },
  partially_fulfilled: { tone: "info", label: "Partial" },
};

/**
 * A separator with its own padding.
 *
 * JSX collapses literal whitespace around an inline element, so `' · '` written
 * as text renders as `Cafe·Jul`. Found in the design mock.
 */
function Dot() {
  return <span style={{ padding: "0 7px", color: "var(--ink-subtle)" }}>·</span>;
}

export function OrderHeader({
  order,
  isPending,
  handleToggleReadyToShip,
}: {
  order: Order;
  isPending: boolean;
  handleToggleReadyToShip: () => void;
}) {
  const fin = FINANCIAL[(order.financial_status || "").toLowerCase()];
  const ful = FULFILLMENT[(order.fulfillment_status || "").toLowerCase()];

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: 16,
        flexWrap: "wrap",
      }}
    >
      <div style={{ display: "flex", gap: 14, alignItems: "flex-start", minWidth: 0 }}>
        <div style={{ paddingTop: 4 }}>
          <Link href="/orders" aria-label="Back to orders">
            <IconButton
              size="sm"
              icon={<ArrowLeft size={16} strokeWidth={1.5} />}
              aria-label="Back to orders"
            />
          </Link>
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <h1
              style={{
                fontFamily: "var(--font-display)",
                fontVariationSettings: "var(--display-settings)",
                fontWeight: "var(--display-weight)" as unknown as number,
                letterSpacing: "var(--display-tracking)",
                fontSize: "var(--fs-display)",
                color: "var(--ink)",
                margin: 0,
                lineHeight: 1,
              }}
            >
              {order.order_name}
            </h1>
            {fin && (
              <Badge tone={fin.tone} dot>
                {fin.label}
              </Badge>
            )}
            {ful ? (
              <Badge tone={ful.tone}>{ful.label}</Badge>
            ) : (
              <Badge tone="neutral">Unfulfilled</Badge>
            )}
            {order.ready_to_ship && <Badge tone="info">Ready to ship</Badge>}
          </div>
          <p
            style={{
              ...sans,
              color: "var(--ink-muted)",
              margin: "8px 0 0",
              display: "flex",
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <span style={{ ...mono, fontSize: "var(--fs-caption)" }}>
              {format(new Date(order.created_at_shopify), "MMM d, yyyy 'at' h:mm a")}
            </span>
            <Dot />
            <span style={{ ...mono, fontSize: "var(--fs-caption)" }}>{order.currency}</span>
          </p>
        </div>
      </div>

      <Button
        variant={order.ready_to_ship ? "secondary" : "primary"}
        disabled={isPending}
        onClick={handleToggleReadyToShip}
        iconLeft={
          order.ready_to_ship ? (
            <Clock size={14} strokeWidth={1.5} />
          ) : (
            <Check size={14} strokeWidth={1.5} />
          )
        }
      >
        {order.ready_to_ship ? "Mark not ready" : "Mark ready to ship"}
      </Button>
    </div>
  );
}

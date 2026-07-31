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

/**
 * Tone lookups ONLY — never label lookups.
 *
 * Shopify's displayFinancialStatus / displayFulfillmentStatus are stored
 * verbatim (lib/orders/sync.ts) and include values these maps do not name:
 * AUTHORIZED, PARTIALLY_PAID, VOIDED, EXPIRED, RESTOCKED, ON_HOLD, IN_PROGRESS,
 * SCHEDULED. An earlier version of this file looked the LABEL up here too, so an
 * unrecognised payment status rendered no badge at all and an unrecognised
 * fulfilment status was asserted to be "Unfulfilled" — positively false, and a
 * regression against both the StatusPill this replaced (which rendered
 * `{status || "Unfulfilled"}`) and /orders' StatusBadge, which still shows the
 * real value with a neutral fallback.
 *
 * So: an unknown status is displayed, in a neutral tone. Never swallowed, never
 * relabelled.
 */
const FIN_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  paid: "success",
  pending: "warning",
  refunded: "neutral",
  partially_refunded: "neutral",
  voided: "neutral",
  expired: "neutral",
  authorized: "warning",
  partially_paid: "warning",
};

const FUL_TONE: Record<string, "success" | "info" | "neutral"> = {
  fulfilled: "success",
  partial: "info",
  partially_fulfilled: "info",
  in_progress: "info",
  scheduled: "info",
  on_hold: "neutral",
  restocked: "neutral",
};

/** Shopify sends SCREAMING_SNAKE; operators read words. */
const humanise = (s: string) => s.replace(/_/g, " ").toLowerCase();

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
  const finRaw = order.financial_status || "unknown";
  const fulRaw = order.fulfillment_status || "unfulfilled";

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
            <Badge tone={FIN_TONE[finRaw.toLowerCase()] ?? "neutral"} dot>
              {humanise(finRaw)}
            </Badge>
            <Badge tone={FUL_TONE[fulRaw.toLowerCase()] ?? "neutral"}>
              {humanise(fulRaw)}
            </Badge>
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

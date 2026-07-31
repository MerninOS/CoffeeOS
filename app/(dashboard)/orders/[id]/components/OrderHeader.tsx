"use client";

import Link from "next/link";
import { format } from "date-fns";
import { ArrowLeft, CheckCircle2, Clock, Truck } from "lucide-react";
import { Btn } from "./primitives";
import type { Order } from "./types";

/**
 * Order identity and the one primary action.
 *
 * Moved out of order-detail-client.tsx byte-for-byte (CoffeeOS#70 Stage A).
 * Props are named exactly as the parent's locals were, so the markup below
 * needed no edits at all — the safest possible extraction, and the reason the
 * baselines can prove it.
 */
export function OrderHeader({
  order,
  isPending,
  handleToggleReadyToShip,
}: {
  order: Order;
  isPending: boolean;
  handleToggleReadyToShip: () => void;
}) {
  return (
  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
    <div className="flex items-center gap-3">
      <Link href="/orders">
        <button className="p-2 rounded-[10px] border-[2.5px] border-espresso bg-cream text-espresso hover:bg-espresso hover:text-cream transition-all duration-[120ms] shadow-[2px_2px_0_#1C0F05]">
          <ArrowLeft size={16} strokeWidth={2.2} />
        </button>
      </Link>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-extrabold text-[24px] uppercase tracking-[.04em] text-espresso leading-none">
            {order.order_name}
          </h1>
          {order.ready_to_ship && (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full border-[2px] border-matcha bg-matcha/20 text-matcha text-[11px] font-extrabold uppercase">
              <Truck size={11} strokeWidth={2.2} className="mr-1" />
              Ready to Ship
            </span>
          )}
        </div>
        <p className="text-[12px] text-espresso/50 font-medium mt-0.5">
          {format(new Date(order.created_at_shopify), "MMM d, yyyy 'at' h:mm a")}
        </p>
      </div>
    </div>
    <Btn
      onClick={handleToggleReadyToShip}
      disabled={isPending}
      variant={order.ready_to_ship ? "outline" : "primary"}
      className="w-full sm:w-auto"
    >
      {order.ready_to_ship ? (
        <><Clock size={13} strokeWidth={2.2} className="mr-1.5" />Mark Not Ready</>
      ) : (
        <><CheckCircle2 size={13} strokeWidth={2.2} className="mr-1.5" />Mark Ready to Ship</>
      )}
    </Btn>
  </div>

  );
}

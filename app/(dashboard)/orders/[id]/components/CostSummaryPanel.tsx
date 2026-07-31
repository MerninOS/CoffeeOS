"use client";

import { cogsLabel } from "@/lib/orders/format";
import { Panel } from "./primitives";
import type { Order } from "./types";

/**
 * Where revenue and cost reconcile.
 *
 * Moved out of order-detail-client.tsx byte-for-byte (CoffeeOS#70 Stage A).
 *
 * Everything decided here is decided elsewhere on purpose: `cogsLabel` owns the
 * `not set`-vs-partial-figure rule, `costKnown` comes from `mayShowMargin`, and
 * `blockedBy` from `blockingReason` — all in lib/orders/format.ts, all asserted
 * by tests rather than re-declared by them. This component renders those
 * answers; it must never compute them (spec criterion 12d).
 *
 * `detail-cogs` and `detail-profit` are a TEST CONTRACT. Stage B may move or
 * restyle these figures but must carry the testids with it — they are the only
 * thing distinguishing a working control from one that silently no-ops.
 */
export function CostSummaryPanel({
  order,
  cogs,
  costKnown,
  profit,
  blockedBy,
}: {
  order: Order;
  cogs: number;
  costKnown: boolean;
  profit: number;
  blockedBy: string | null;
}) {
  return (
  <Panel title="Cost Summary">
    <div className="space-y-2 text-[13px]">
      {[
        ["Subtotal", `$${order.subtotal_price.toFixed(2)}`],
        ["Tax", `$${order.total_tax.toFixed(2)}`],
      ].map(([label, val]) => (
        <div key={label} className="flex justify-between">
          <span className="text-espresso/60 font-medium">{label}</span>
          <span className="font-bold text-espresso">{val}</span>
        </div>
      ))}
      <div className="flex justify-between border-t-[2px] border-dashed border-fog pt-2">
        <span className="font-extrabold text-espresso text-[12px] uppercase tracking-[.06em]">Total Revenue</span>
        <span className="font-extrabold text-espresso">${order.total_price.toFixed(2)}</span>
      </div>
      {/*
        `not set` replaces the figure ONLY when there is genuinely nothing
        costed. An order can carry components and custom costs while its
        products are uncosted — printing "not set" over a real $12.14 would
        be a lie. So: no cost at all → "not set"; some cost but incomplete →
        the figure, in danger.

        Red here means INCOMPLETE, not "known". A costed order's COGS is
        equally known and renders in ink. Same rule as /orders
        (OrdersWorksheetTable) — the two surfaces must not disagree.
      */}
      {/* `detail-cogs` and `detail-profit` are the elements
          order-detail-capabilities.spec.ts asserts exact dollar deltas
          against. They are a TEST CONTRACT, not decoration: the Instrument
          rebuild (CoffeeOS#70) may move, restyle or re-parent these figures,
          but must carry the testids with them — they are the only thing that
          can tell a working control from one that renders perfectly and
          silently no-ops, which a screenshot cannot. */}
      <div className="flex justify-between pt-1">
        <span className="text-espresso/60 font-medium">Total COGS</span>
        <span
          data-testid="detail-cogs"
          className={`font-bold ${costKnown ? "text-espresso" : "text-tomato"}`}
        >
          {cogsLabel(cogs, costKnown)}
        </span>
      </div>
      {costKnown ? (
        <div className={`flex justify-between border-t-[2px] border-espresso pt-2 ${profit >= 0 ? "text-matcha" : "text-tomato"}`}>
          <span className="font-extrabold text-[14px] uppercase tracking-[.06em]">Net Profit</span>
          <span data-testid="detail-profit" className="font-extrabold text-[14px]">${profit.toFixed(2)}</span>
        </div>
      ) : (
        <div className="border-t-[2px] border-espresso pt-2">
          <div className="flex justify-between text-espresso/40">
            <span className="font-extrabold text-[14px] uppercase tracking-[.06em]">Net Profit</span>
            <span className="font-extrabold text-[14px]">—</span>
          </div>
          {/* The remedy, named. Never a bare "cannot compute". */}
          <p className="text-[12px] font-medium text-tomato mt-2 leading-snug">{blockedBy}</p>
        </div>
      )}
    </div>
  </Panel>

  );
}

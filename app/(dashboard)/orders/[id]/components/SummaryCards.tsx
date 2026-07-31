"use client";

import { StatusPill } from "./primitives";
import type { Order } from "./types";

/**
 * The four equal metric cards.
 *
 * Moved byte-for-byte (CoffeeOS#70 Stage A). Stage B deletes this outright:
 * Instrument forbids a row of equally-weighted metric cards, and these four
 * become one HeroMetric (margin) plus a ruled StatStrip, with the two statuses
 * moving to header badges where states belong.
 */
export function SummaryCards({
  order,
  costKnown,
  margin,
  profit,
}: {
  order: Order;
  costKnown: boolean;
  margin: number;
  profit: number;
}) {
  return (
  <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
    {[
      { label: "Payment", content: <StatusPill status={order.financial_status} type="financial" /> },
      { label: "Fulfillment", content: <StatusPill status={order.fulfillment_status} type="fulfillment" /> },
      {
        label: "Order Total",
        content: (
          <div className="text-[24px] font-extrabold text-espresso leading-none">
            ${order.total_price.toFixed(2)}
          </div>
        ),
      },
      {
        label: "Profit Margin",
        /*
          WITHHELD, not reddened, when the cost is unknown. Both figures here
          are derived wholly from the missing number, so a value would not be
          uncertain — it would be invented. The em dash is the true statement,
          and it is muted rather than red on purpose: red warns about a figure
          that exists, and there is no figure. Matches /orders exactly
          (OrdersWorksheetTable, "Profit and margin are WITHHELD, not
          reddened").
        */
        content: costKnown ? (
          <div>
            <div className={`text-[24px] font-extrabold leading-none ${margin >= 0 ? "text-matcha" : "text-tomato"}`}>
              {margin.toFixed(1)}%
            </div>
            <div className={`text-[11px] font-bold mt-0.5 ${profit >= 0 ? "text-matcha" : "text-tomato"}`}>
              ${profit.toFixed(2)} profit
            </div>
          </div>
        ) : (
          <div>
            <div className="text-[24px] font-extrabold leading-none text-espresso/30">—</div>
            <div className="text-[11px] font-bold mt-0.5 text-espresso/40">
              cost unknown
            </div>
          </div>
        ),
      },
    ].map(({ label, content }) => (
      <div
        key={label}
        className="bg-chalk border-[3px] border-espresso rounded-[14px] shadow-flat-sm px-4 py-4"
      >
        <div className="text-[10px] font-extrabold uppercase tracking-[.1em] text-espresso/50 mb-2">
          {label}
        </div>
        {content}
      </div>
    ))}
  </div>

  );
}

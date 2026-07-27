"use client";

import React from "react";
import Link from "next/link";
import { format } from "date-fns";
import { ChevronDown, ChevronRight, Truck, ExternalLink } from "lucide-react";
import { StatusPill, MarginPill } from "./primitives";
import { ExpandedOrder, type OrderExpandedContentProps } from "./ExpandedOrder";
import type { Order } from "./types";

/**
 * The desktop orders table.
 *
 * Moved verbatim out of orders-client.tsx during the CoffeeOS#65 Stage A
 * extraction — same wrapper, same class strings, same `data-testid` hooks.
 * `order-row` and `row-revenue` are load-bearing: tests/e2e/orders-query.spec.ts
 * counts rows and sums revenue through them, and would go quietly green if they
 * disappeared. `row-cogs` is new, for the capability tests.
 *
 * The `md:hidden` mobile card list deliberately stays behind in orders-client —
 * deleting it is Stage B's job (spec Criterion 11), and removing it here would
 * move the mobile baseline.
 *
 * Everything the expanded row needs is forwarded unchanged, hence
 * `Omit<OrderExpandedContentProps, "order">`: the per-row `order` is supplied
 * here, every other prop is passed straight through exactly as before.
 */

type OrdersWorksheetTableProps = Omit<OrderExpandedContentProps, "order"> & {
  filteredOrders: Order[];
  expandedOrders: Set<string>;
  toggleOrderExpanded: (orderId: string) => void;
  getOrderCogs: (order: Order) => number;
};

export function OrdersWorksheetTable({
  filteredOrders,
  expandedOrders,
  toggleOrderExpanded,
  getOrderCogs,
  ...expandedProps
}: OrdersWorksheetTableProps) {
  return (
    <div className="hidden md:block">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b-[2px] border-dashed border-fog">
            <th className="w-8 px-3 py-2.5" />
            <th className="text-left px-3 py-2.5 font-extrabold text-[11px] uppercase tracking-[.08em] text-espresso/60">Order</th>
            <th className="text-left px-3 py-2.5 font-extrabold text-[11px] uppercase tracking-[.08em] text-espresso/60">Date</th>
            <th className="text-left px-3 py-2.5 font-extrabold text-[11px] uppercase tracking-[.08em] text-espresso/60">Status</th>
            <th className="text-center px-3 py-2.5 font-extrabold text-[11px] uppercase tracking-[.08em] text-espresso/60">Ready</th>
            <th className="text-right px-3 py-2.5 font-extrabold text-[11px] uppercase tracking-[.08em] text-espresso/60">Revenue</th>
            <th className="text-right px-3 py-2.5 font-extrabold text-[11px] uppercase tracking-[.08em] text-espresso/60">COGS</th>
            <th className="text-right px-3 py-2.5 font-extrabold text-[11px] uppercase tracking-[.08em] text-espresso/60">Profit</th>
            <th className="text-right px-3 py-2.5 font-extrabold text-[11px] uppercase tracking-[.08em] text-espresso/60">Margin</th>
            <th className="w-10 px-3 py-2.5" />
          </tr>
        </thead>
        <tbody>
          {filteredOrders.map((order) => {
            const revenue = order.total_price || 0;
            const cogs = getOrderCogs(order);
            const profit = revenue - cogs;
            const margin = revenue > 0 ? ((revenue - cogs) / revenue) * 100 : 0;
            const isExpanded = expandedOrders.has(order.id);
            return (
              <React.Fragment key={order.id}>
                <tr
                  data-testid="order-row"
                  className="border-b border-dashed border-fog/70 cursor-pointer hover:bg-cream/60 transition-colors"
                  onClick={() => toggleOrderExpanded(order.id)}
                >
                  <td className="px-3 py-3 text-espresso/50">
                    {isExpanded
                      ? <ChevronDown size={15} strokeWidth={2.2} />
                      : <ChevronRight size={15} strokeWidth={2.2} />
                    }
                  </td>
                  <td className="px-3 py-3 font-bold text-espresso">{order.order_name}</td>
                  <td className="px-3 py-3 text-espresso/60 font-medium">
                    {order.created_at_shopify ? format(new Date(order.created_at_shopify), "MMM d, yyyy") : "—"}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      <StatusPill status={order.financial_status} type="financial" />
                      <StatusPill status={order.fulfillment_status} type="fulfillment" />
                    </div>
                  </td>
                  <td className="px-3 py-3 text-center">
                    {order.ready_to_ship
                      ? <span className="inline-flex items-center px-2 py-0.5 rounded-full border-[2px] border-matcha bg-matcha/20 text-matcha text-[10px] font-extrabold uppercase"><Truck size={10} strokeWidth={2.2} className="mr-1" />Ready</span>
                      : <span className="text-espresso/30">—</span>
                    }
                  </td>
                  <td data-testid="row-revenue" className="px-3 py-3 text-right font-bold text-espresso">${revenue.toFixed(2)}</td>
                  <td data-testid="row-cogs" className="px-3 py-3 text-right font-bold text-espresso">${cogs.toFixed(2)}</td>
                  <td className={`px-3 py-3 text-right font-bold ${profit >= 0 ? "text-matcha" : "text-tomato"}`}>${profit.toFixed(2)}</td>
                  <td className="px-3 py-3 text-right"><MarginPill margin={margin} /></td>
                  <td className="px-3 py-3">
                    <Link href={`/orders/${order.id}`} onClick={(e) => e.stopPropagation()}>
                      <button className="p-1.5 rounded-[8px] text-espresso/50 hover:text-espresso hover:bg-fog/50 transition-colors">
                        <ExternalLink size={14} strokeWidth={2.2} />
                      </button>
                    </Link>
                  </td>
                </tr>
                {isExpanded && (
                  <tr className="bg-cream/60">
                    <td colSpan={10} className="px-6 py-5">
                      <ExpandedOrder order={order} {...expandedProps} />
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

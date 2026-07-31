"use client";

import { Panel } from "./primitives";
import type { Order } from "./types";

/**
 * The order's sold items and the revenue side of the ledger.
 *
 * Moved out of order-detail-client.tsx byte-for-byte (CoffeeOS#70 Stage A) —
 * nothing tidied, renamed or restyled, because Stage A's only proof is that the
 * six visual baselines did not move.
 *
 * `shipping` is derived in the parent (total - subtotal - tax) rather than
 * stored, and is passed in so this panel has no arithmetic of its own.
 *
 * Stage B folds this into Worksheet alongside the components, custom costs and
 * totals, so all four land on one set of column tracks.
 */
export function LineItemsPanel({ order, shipping }: { order: Order; shipping: number }) {
  return (
  <Panel title="Order Items">
    <table className="w-full text-[13px]">
      <thead>
        <tr className="border-b-[2px] border-dashed border-fog">
          <th className="text-left py-2 font-extrabold text-[11px] uppercase tracking-[.08em] text-espresso/50">Item</th>
          <th className="text-center py-2 font-extrabold text-[11px] uppercase tracking-[.08em] text-espresso/50">Qty</th>
          <th className="text-right py-2 font-extrabold text-[11px] uppercase tracking-[.08em] text-espresso/50">Price</th>
          <th className="text-right py-2 font-extrabold text-[11px] uppercase tracking-[.08em] text-espresso/50">Total</th>
        </tr>
      </thead>
      <tbody>
        {order.order_line_items.map((item) => (
          <tr key={item.id} className="border-b border-dashed border-fog/60">
            <td className="py-2.5">
              <div className="font-bold text-espresso">{item.title}</div>
              {item.variant_title && (
                <div className="text-[11px] text-espresso/50">{item.variant_title}</div>
              )}
              {item.sku && (
                <div className="text-[10px] text-espresso/40 font-mono">SKU: {item.sku}</div>
              )}
            </td>
            <td className="py-2.5 text-center font-bold text-espresso">{item.quantity}</td>
            <td className="py-2.5 text-right font-bold text-espresso">${item.price.toFixed(2)}</td>
            <td className="py-2.5 text-right font-bold text-espresso">${item.total_price.toFixed(2)}</td>
          </tr>
        ))}
        {[
          ["Subtotal", `$${(order.subtotal_price || 0).toFixed(2)}`],
          ["Shipping", `$${shipping.toFixed(2)}`],
          ["Tax", `$${(order.total_tax || 0).toFixed(2)}`],
        ].map(([label, val]) => (
          <tr key={label} className="border-b border-dashed border-fog/40">
            <td colSpan={3} className="py-1.5 text-right text-[12px] font-bold text-espresso/50">{label}</td>
            <td className="py-1.5 text-right font-bold text-espresso">{val}</td>
          </tr>
        ))}
        <tr className="border-t-[2px] border-espresso">
          <td colSpan={3} className="py-2.5 text-right font-extrabold text-[12px] uppercase tracking-[.06em] text-espresso">Total</td>
          <td className="py-2.5 text-right font-extrabold text-espresso">${(order.total_price || 0).toFixed(2)}</td>
        </tr>
      </tbody>
    </table>
  </Panel>

  );
}

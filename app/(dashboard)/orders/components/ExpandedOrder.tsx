"use client";

import React from "react";
import { Plus, Minus, Trash2, X, Flame } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Btn, MerninInput, FieldLabel } from "./primitives";
import type {
  Order,
  OrderLineItem,
  ComponentData,
  CoffeeInventory,
} from "./types";

/**
 * The expanded content of an order row — line items, additional costs, custom
 * costs and the roast-request entry point.
 *
 * Moved verbatim out of orders-client.tsx (where it was `OrderExpandedContent`)
 * during the CoffeeOS#65 Stage A extraction. Prop names, class strings and
 * handler wiring are UNCHANGED: Stage A is a pure refactor and the visual
 * baselines must not move by a pixel. Stage B restyles this to the instrument
 * design system.
 *
 * The only additions are `data-testid` hooks. Those are test hooks, not
 * styling — `tests/e2e/orders-capabilities.spec.ts` drives the six mutation
 * flows through them, so Stage B's rewrite must carry them across.
 */

export interface OrderExpandedContentProps {
  order: Order;
  productCogsMap: Record<string, number>;
  allComponents: ComponentData[];
  coffeeInventory: CoffeeInventory[];
  getLineItemCogs: (item: OrderLineItem) => number;
  getOrderComponentsCogs: (order: Order) => number;
  getOrderCustomCostsTotal: (order: Order) => number;
  getTotalAdditionalCosts: (order: Order) => number;
  addingComponentTo: string | null;
  setAddingComponentTo: (id: string | null) => void;
  selectedComponentId: string;
  setSelectedComponentId: (id: string) => void;
  componentQuantity: number;
  setComponentQuantity: (qty: number) => void;
  handleAddComponent: (orderId: string) => void;
  handleUpdateQuantity: (orderComponentId: string, newQuantity: number) => void;
  handleRemoveComponent: (orderComponentId: string) => void;
  addingCustomCostTo: string | null;
  setAddingCustomCostTo: (id: string | null) => void;
  customCostDescription: string;
  setCustomCostDescription: (desc: string) => void;
  customCostAmount: string;
  setCustomCostAmount: (amount: string) => void;
  handleAddCustomCost: (orderId: string) => void;
  handleRemoveCustomCost: (customCostId: string) => void;
  setRoastRequestOrder: (order: Order | null) => void;
}

export function ExpandedOrder({
  order,
  productCogsMap,
  allComponents,
  coffeeInventory,
  getOrderComponentsCogs,
  getOrderCustomCostsTotal,
  getTotalAdditionalCosts,
  addingComponentTo,
  setAddingComponentTo,
  selectedComponentId,
  setSelectedComponentId,
  componentQuantity,
  setComponentQuantity,
  handleAddComponent,
  handleUpdateQuantity,
  handleRemoveComponent,
  addingCustomCostTo,
  setAddingCustomCostTo,
  customCostDescription,
  setCustomCostDescription,
  customCostAmount,
  setCustomCostAmount,
  handleAddCustomCost,
  handleRemoveCustomCost,
  setRoastRequestOrder,
}: OrderExpandedContentProps) {
  const shipping =
    (order.total_price || 0) -
    (order.subtotal_price || 0) -
    (order.total_tax || 0);

  return (
    <div className="space-y-5" data-testid="order-expanded">
      {/* Line Items */}
      <div>
        <div className="text-[11px] font-extrabold uppercase tracking-[.08em] text-espresso/60 mb-2">
          Line Items
        </div>

        {/* Desktop */}
        <div className="hidden md:block">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b-[2px] border-dashed border-fog">
                <th className="text-left py-2 font-extrabold text-[11px] uppercase tracking-[.08em] text-espresso/50">Product</th>
                <th className="text-left py-2 font-extrabold text-[11px] uppercase tracking-[.08em] text-espresso/50">SKU</th>
                <th className="text-center py-2 font-extrabold text-[11px] uppercase tracking-[.08em] text-espresso/50">Qty</th>
                <th className="text-right py-2 font-extrabold text-[11px] uppercase tracking-[.08em] text-espresso/50">Price</th>
                <th className="text-right py-2 font-extrabold text-[11px] uppercase tracking-[.08em] text-espresso/50">COGS</th>
              </tr>
            </thead>
            <tbody>
              {order.order_line_items.map((item) => (
                <tr key={item.id} className="border-b border-dashed border-fog/60">
                  <td className="py-2 font-medium text-espresso">
                    {item.title}
                    {!item.product_id && (
                      <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded-full border-[2px] border-sun bg-sun/30 text-espresso text-[9px] font-extrabold uppercase">
                        No COGS
                      </span>
                    )}
                  </td>
                  <td className="py-2 font-mono text-[11px] text-espresso/50">{item.sku || "—"}</td>
                  <td className="py-2 text-center font-bold text-espresso">{item.quantity}</td>
                  <td className="py-2 text-right font-bold text-espresso">${(item.price || 0).toFixed(2)}</td>
                  <td className="py-2 text-right font-bold text-espresso">
                    {item.product_id ? `$${(productCogsMap[item.product_id] || 0).toFixed(2)}` : <span className="text-espresso/30">—</span>}
                  </td>
                </tr>
              ))}
              <tr className="border-t-[2px] border-espresso/20">
                <td colSpan={3} className="py-1.5 text-right text-[12px] font-bold text-espresso/50">Subtotal</td>
                <td className="py-1.5 text-right font-bold text-espresso">${(order.subtotal_price || 0).toFixed(2)}</td>
                <td />
              </tr>
              <tr>
                <td colSpan={3} className="py-1 text-right text-[12px] font-bold text-espresso/50">Shipping</td>
                <td className="py-1 text-right font-bold text-espresso">${shipping.toFixed(2)}</td>
                <td />
              </tr>
              <tr>
                <td colSpan={3} className="py-1 text-right text-[12px] font-bold text-espresso/50">Tax</td>
                <td className="py-1 text-right font-bold text-espresso">${(order.total_tax || 0).toFixed(2)}</td>
                <td />
              </tr>
              <tr className="border-t-[2px] border-espresso">
                <td colSpan={3} className="py-2 text-right font-extrabold text-espresso text-[12px] uppercase tracking-[.06em]">Total</td>
                <td className="py-2 text-right font-extrabold text-espresso">${(order.total_price || 0).toFixed(2)}</td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>

        {/* Mobile */}
        <div className="space-y-2 md:hidden">
          {order.order_line_items.map((item) => (
            <div key={item.id} className="rounded-[10px] border-[2px] border-fog bg-cream p-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-bold text-espresso leading-tight">{item.title}</p>
                  {item.sku && <p className="mt-0.5 font-mono text-[10px] text-espresso/50">{item.sku}</p>}
                  {!item.product_id && (
                    <span className="mt-1 inline-flex items-center px-1.5 py-0.5 rounded-full border-[2px] border-sun bg-sun/30 text-espresso text-[9px] font-extrabold uppercase">
                      No COGS
                    </span>
                  )}
                </div>
                <div className="text-right text-[12px] shrink-0">
                  <p className="font-bold text-espresso">{item.quantity} × ${(item.price || 0).toFixed(2)}</p>
                  {item.product_id && (
                    <p className="text-espresso/50">COGS: ${(productCogsMap[item.product_id] || 0).toFixed(2)}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
          <div className="rounded-[10px] border-[2px] border-espresso bg-cream p-2.5 space-y-1 text-[12px]">
            {[
              ["Subtotal", `$${(order.subtotal_price || 0).toFixed(2)}`],
              ["Shipping", `$${shipping.toFixed(2)}`],
              ["Tax", `$${(order.total_tax || 0).toFixed(2)}`],
            ].map(([label, val]) => (
              <div key={label} className="flex justify-between">
                <span className="text-espresso/50 font-medium">{label}</span>
                <span className="font-bold text-espresso">{val}</span>
              </div>
            ))}
            <div className="flex justify-between border-t-[2px] border-espresso pt-1">
              <span className="font-extrabold text-espresso uppercase tracking-[.06em]">Total</span>
              <span className="font-extrabold text-espresso">${(order.total_price || 0).toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t-[2px] border-dashed border-fog" />

      {/* Additional Costs */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-[11px] font-extrabold uppercase tracking-[.08em] text-espresso/60">
            Additional Costs
          </div>
          {addingComponentTo !== order.id && (
            <Btn
              size="sm"
              variant="outline"
              testId="add-component-open"
              onClick={(e) => {
                e?.stopPropagation();
                setAddingComponentTo(order.id);
              }}
            >
              <Plus size={11} strokeWidth={2.5} className="mr-1" />
              Add Component
            </Btn>
          )}
        </div>

        {addingComponentTo === order.id && (
          <div
            className="flex flex-col gap-2 rounded-[10px] border-[2px] border-espresso bg-cream p-3 sm:flex-row sm:items-end"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex-1">
              <FieldLabel>Component</FieldLabel>
              <Select value={selectedComponentId} onValueChange={setSelectedComponentId}>
                <SelectTrigger data-testid="component-select" className="border-[2.5px] border-espresso bg-cream rounded-[10px] shadow-[3px_3px_0_#1C0F05] focus:ring-0">
                  <SelectValue placeholder="Select component..." />
                </SelectTrigger>
                <SelectContent>
                  {allComponents.map((comp) => (
                    <SelectItem key={comp.id} value={comp.id}>
                      {comp.name} (${comp.cost_per_unit.toFixed(2)}/{comp.unit})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-2">
              <div className="w-20">
                <FieldLabel>Qty</FieldLabel>
                <MerninInput
                  type="number"
                  min="1"
                  testId="component-qty-input"
                  value={componentQuantity}
                  onChange={(e) => setComponentQuantity(parseInt(e.target.value) || 1)}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
              <Btn
                size="sm"
                testId="component-add-submit"
                onClick={(e) => {
                  e?.stopPropagation();
                  handleAddComponent(order.id);
                }}
                disabled={!selectedComponentId}
              >
                Add
              </Btn>
              <Btn
                size="sm"
                variant="ghost"
                onClick={(e) => {
                  e?.stopPropagation();
                  setAddingComponentTo(null);
                  setSelectedComponentId("");
                  setComponentQuantity(1);
                }}
              >
                <X size={13} strokeWidth={2.2} />
              </Btn>
            </div>
          </div>
        )}

        {(order.order_components || []).length > 0 && (
          <div className="space-y-1.5">
            {order.order_components.map((oc) => (
              <div
                key={oc.id}
                data-testid="order-component-row"
                className="flex items-center justify-between rounded-[10px] border-[2px] border-fog bg-cream px-3 py-2"
              >
                <div>
                  <span className="font-bold text-[13px] text-espresso">{oc.components?.name || "Unknown"}</span>
                  <span className="ml-2 text-[11px] text-espresso/50 capitalize">{oc.components?.type}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    data-testid="component-qty-decrement"
                    onClick={(e) => { e.stopPropagation(); handleUpdateQuantity(oc.id, oc.quantity - 1); }}
                    className="p-1 rounded-[6px] text-espresso/60 hover:text-espresso hover:bg-fog/50 transition-colors"
                  >
                    <Minus size={12} strokeWidth={2.5} />
                  </button>
                  <span data-testid="component-qty-value" className="w-6 text-center text-[13px] font-bold text-espresso">{oc.quantity}</span>
                  <button
                    data-testid="component-qty-increment"
                    onClick={(e) => { e.stopPropagation(); handleUpdateQuantity(oc.id, oc.quantity + 1); }}
                    className="p-1 rounded-[6px] text-espresso/60 hover:text-espresso hover:bg-fog/50 transition-colors"
                  >
                    <Plus size={12} strokeWidth={2.5} />
                  </button>
                  <span data-testid="component-unit-cost" className="ml-2 text-[12px] font-bold text-espresso">${(oc.components?.cost_per_unit || 0).toFixed(2)}</span>
                  <button
                    data-testid="component-remove"
                    onClick={(e) => { e.stopPropagation(); handleRemoveComponent(oc.id); }}
                    className="ml-1 p-1 rounded-[6px] text-espresso/40 hover:text-tomato hover:bg-tomato/10 transition-colors"
                  >
                    <Trash2 size={12} strokeWidth={2.2} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Custom Costs */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-[11px] font-extrabold uppercase tracking-[.08em] text-espresso/60">
            Custom Costs
          </div>
          {addingCustomCostTo !== order.id && (
            <Btn
              size="sm"
              variant="outline"
              testId="add-custom-cost-open"
              onClick={(e) => {
                e?.stopPropagation();
                setAddingCustomCostTo(order.id);
              }}
            >
              <Plus size={11} strokeWidth={2.5} className="mr-1" />
              Add Cost
            </Btn>
          )}
        </div>

        {addingCustomCostTo === order.id && (
          <div
            className="flex flex-col gap-2 rounded-[10px] border-[2px] border-espresso bg-cream p-3 sm:flex-row sm:items-end"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex-1">
              <FieldLabel>Description</FieldLabel>
              <MerninInput
                placeholder="Shipping, Gift wrap..."
                testId="custom-cost-description-input"
                value={customCostDescription}
                onChange={(e) => setCustomCostDescription(e.target.value)}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
            <div className="flex items-end gap-2">
              <div className="w-24">
                <FieldLabel>Amount ($)</FieldLabel>
                <MerninInput
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  testId="custom-cost-amount-input"
                  value={customCostAmount}
                  onChange={(e) => setCustomCostAmount(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
              <Btn
                size="sm"
                testId="custom-cost-add-submit"
                onClick={(e) => {
                  e?.stopPropagation();
                  handleAddCustomCost(order.id);
                }}
                disabled={!customCostDescription.trim() || !customCostAmount}
              >
                Add
              </Btn>
              <Btn
                size="sm"
                variant="ghost"
                onClick={(e) => {
                  e?.stopPropagation();
                  setAddingCustomCostTo(null);
                  setCustomCostDescription("");
                  setCustomCostAmount("");
                }}
              >
                <X size={13} strokeWidth={2.2} />
              </Btn>
            </div>
          </div>
        )}

        {(order.order_custom_costs || []).length > 0 ? (
          <div className="space-y-1.5">
            {order.order_custom_costs.map((cc) => (
              <div
                key={cc.id}
                data-testid="custom-cost-row"
                className="flex items-center justify-between rounded-[10px] border-[2px] border-fog bg-cream px-3 py-2"
              >
                <span className="font-medium text-[13px] text-espresso">{cc.description}</span>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-[13px] text-espresso">${cc.amount.toFixed(2)}</span>
                  <button
                    data-testid="custom-cost-remove"
                    onClick={(e) => { e.stopPropagation(); handleRemoveCustomCost(cc.id); }}
                    className="p-1 rounded-[6px] text-espresso/40 hover:text-tomato hover:bg-tomato/10 transition-colors"
                  >
                    <Trash2 size={12} strokeWidth={2.2} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[12px] text-espresso/50 font-medium">
            No custom costs added. Use this for one-off charges like shipping or gift wrapping.
          </p>
        )}
      </div>

      {/* Totals summary */}
      {((order.order_components || []).length > 0 || (order.order_custom_costs || []).length > 0) && (
        <div className="flex justify-end border-t-[2px] border-dashed border-fog pt-3">
          <div className="space-y-1 text-[13px]">
            {(order.order_components || []).length > 0 && (
              <div className="flex justify-between gap-8">
                <span className="text-espresso/50 font-medium">Component Costs:</span>
                <span className="font-bold text-espresso">${getOrderComponentsCogs(order).toFixed(2)}</span>
              </div>
            )}
            {(order.order_custom_costs || []).length > 0 && (
              <div className="flex justify-between gap-8">
                <span className="text-espresso/50 font-medium">Custom Costs:</span>
                <span className="font-bold text-espresso">${getOrderCustomCostsTotal(order).toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between gap-8 border-t-[2px] border-espresso pt-1">
              <span className="font-extrabold text-espresso text-[12px] uppercase tracking-[.06em]">Total Additional:</span>
              <span data-testid="total-additional" className="font-extrabold text-espresso">${getTotalAdditionalCosts(order).toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Roast Request */}
      {coffeeInventory.length > 0 && (
        <>
          <div className="border-t-[2px] border-dashed border-fog" />
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[11px] font-extrabold uppercase tracking-[.08em] text-espresso/60">Roasting</div>
              <div className="text-[12px] text-espresso/50 font-medium mt-0.5">Create a roast request for this order</div>
            </div>
            <Btn
              size="sm"
              variant="outline"
              testId="roast-request-open"
              onClick={(e) => {
                e?.stopPropagation();
                setRoastRequestOrder(order);
              }}
            >
              <Flame size={12} strokeWidth={2.2} className="mr-1.5" />
              Roast Request
            </Btn>
          </div>
        </>
      )}
    </div>
  );
}

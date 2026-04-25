"use client";

import React from "react";
import { useState } from "react";
import { format } from "date-fns";
import {
  RefreshCw,
  Search,
  ShoppingCart,
  ChevronDown,
  ChevronRight,
  Plus,
  Minus,
  Trash2,
  X,
  Truck,
  ExternalLink,
  Flame,
  Settings,
  TrendingDown,
  Scale,
} from "lucide-react";
import Link from "next/link";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  syncShopifyOrders,
  addOrderComponent,
  updateOrderComponentQuantity,
  removeOrderComponent,
  addOrderCustomCost,
  removeOrderCustomCost,
  createRoastRequestForOrder,
} from "./actions";

// ── Types ───────────────────────────────────────────────────────────────────

interface OrderLineItem {
  id: string;
  title: string;
  sku: string | null;
  quantity: number;
  price: number;
  total_price: number;
  product_id: string | null;
  shopify_product_id: string | null;
}

interface ComponentData {
  id: string;
  name: string;
  cost_per_unit: number;
  unit: string;
  type: string;
}

interface OrderComponent {
  id: string;
  component_id: string;
  quantity: number;
  components: ComponentData | null;
}

interface OrderCustomCost {
  id: string;
  description: string;
  amount: number;
}

interface Order {
  id: string;
  shopify_order_id: string;
  order_name: string;
  shopify_order_number: string;
  created_at_shopify: string;
  financial_status: string;
  fulfillment_status: string;
  subtotal_price: number;
  total_tax: number;
  total_price: number;
  currency: string;
  ready_to_ship: boolean;
  order_line_items: OrderLineItem[];
  order_components: OrderComponent[];
  order_custom_costs: OrderCustomCost[];
}

interface CoffeeInventory {
  id: string;
  name: string;
  origin: string;
  current_green_quantity_g: number;
}

interface OrdersClientProps {
  initialOrders: Order[];
  productCogsMap: Record<string, number>;
  allComponents: ComponentData[];
  coffeeInventory: CoffeeInventory[];
  isAdminConfigured: boolean;
}

// ── Primitives ──────────────────────────────────────────────────────────────

function Btn({
  children,
  onClick,
  disabled,
  variant = "primary",
  size = "md",
  type = "button",
  className = "",
}: {
  children: React.ReactNode;
  onClick?: (e?: React.MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  variant?: "primary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md";
  type?: "button" | "submit";
  className?: string;
}) {
  const base =
    "inline-flex items-center justify-center font-extrabold uppercase tracking-[.08em] transition-all duration-[120ms] border-[2.5px] cursor-pointer disabled:opacity-50 disabled:pointer-events-none";
  const sizes = {
    sm: "text-[11px] px-3 py-1.5 rounded-[8px]",
    md: "text-[12px] px-4 py-2 rounded-[10px]",
  };
  const variants = {
    primary:
      "bg-tomato text-cream border-espresso shadow-[3px_3px_0_#1C0F05] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_#1C0F05] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none",
    outline:
      "bg-transparent text-espresso border-espresso hover:bg-espresso hover:text-cream",
    ghost:
      "bg-transparent text-espresso border-transparent hover:bg-fog/50 shadow-none",
    danger:
      "bg-transparent text-tomato border-tomato hover:bg-tomato hover:text-cream",
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

function StatCard({
  label,
  value,
  valueClassName = "",
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="bg-chalk border-[3px] border-espresso rounded-[14px] shadow-flat-sm px-4 py-3 flex flex-col gap-1">
      <div className="text-[10px] font-extrabold uppercase tracking-[.1em] text-espresso/60">
        {label}
      </div>
      <div className={`text-[22px] font-extrabold text-espresso leading-none ${valueClassName}`}>
        {value}
      </div>
    </div>
  );
}

function MerninInput({
  id,
  type = "text",
  value,
  onChange,
  placeholder,
  step,
  min,
  onClick,
}: {
  id?: string;
  type?: string;
  value: string | number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  step?: string;
  min?: string;
  onClick?: (e: React.MouseEvent) => void;
}) {
  return (
    <input
      id={id}
      type={type}
      step={step}
      min={min}
      value={value}
      onChange={onChange}
      onClick={onClick}
      placeholder={placeholder}
      className="w-full bg-cream border-[2.5px] border-espresso rounded-[10px] px-3 py-2 text-[13px] font-medium text-espresso placeholder:text-espresso/40 shadow-[3px_3px_0_#1C0F05] focus:outline-none focus:border-tomato focus:shadow-[3px_3px_0_#E8442A] transition-all duration-[120ms]"
    />
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-extrabold uppercase tracking-[.08em] text-espresso mb-1">
      {children}
    </div>
  );
}

function StatusPill({ status, type }: { status: string; type: "financial" | "fulfillment" }) {
  const s = status.toLowerCase();
  let bg = "bg-fog text-espresso border-fog";
  if (type === "financial") {
    if (s === "paid") bg = "bg-matcha/20 text-matcha border-matcha";
    else if (s === "pending") bg = "bg-sun/30 text-espresso border-sun";
    else if (s === "refunded" || s === "partially_refunded") bg = "bg-tomato/20 text-tomato border-tomato";
  } else {
    if (s === "fulfilled") bg = "bg-matcha/20 text-matcha border-matcha";
    else if (s === "unfulfilled") bg = "bg-sun/30 text-espresso border-sun";
    else if (s === "partially_fulfilled") bg = "bg-sky/30 text-espresso border-sky";
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full border-[2px] ${bg} text-[10px] font-extrabold uppercase tracking-[.06em]`}>
      {status}
    </span>
  );
}

function MarginPill({ margin }: { margin: number }) {
  const color =
    margin >= 30
      ? "bg-matcha/20 text-matcha border-matcha"
      : margin >= 15
      ? "bg-sun/30 text-espresso border-sun"
      : "bg-tomato/20 text-tomato border-tomato";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full border-[2px] ${color} text-[10px] font-extrabold`}>
      {margin.toFixed(1)}%
    </span>
  );
}

// ── Expanded order content ──────────────────────────────────────────────────

interface OrderExpandedContentProps {
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

function OrderExpandedContent({
  order,
  productCogsMap,
  allComponents,
  coffeeInventory,
  getLineItemCogs,
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
    <div className="space-y-5">
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
                <SelectTrigger className="border-[2.5px] border-espresso bg-cream rounded-[10px] shadow-[3px_3px_0_#1C0F05] focus:ring-0">
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
                  value={componentQuantity}
                  onChange={(e) => setComponentQuantity(parseInt(e.target.value) || 1)}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
              <Btn
                size="sm"
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
                className="flex items-center justify-between rounded-[10px] border-[2px] border-fog bg-cream px-3 py-2"
              >
                <div>
                  <span className="font-bold text-[13px] text-espresso">{oc.components?.name || "Unknown"}</span>
                  <span className="ml-2 text-[11px] text-espresso/50 capitalize">{oc.components?.type}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleUpdateQuantity(oc.id, oc.quantity - 1); }}
                    className="p-1 rounded-[6px] text-espresso/60 hover:text-espresso hover:bg-fog/50 transition-colors"
                  >
                    <Minus size={12} strokeWidth={2.5} />
                  </button>
                  <span className="w-6 text-center text-[13px] font-bold text-espresso">{oc.quantity}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleUpdateQuantity(oc.id, oc.quantity + 1); }}
                    className="p-1 rounded-[6px] text-espresso/60 hover:text-espresso hover:bg-fog/50 transition-colors"
                  >
                    <Plus size={12} strokeWidth={2.5} />
                  </button>
                  <span className="ml-2 text-[12px] font-bold text-espresso">${(oc.components?.cost_per_unit || 0).toFixed(2)}</span>
                  <button
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
                  value={customCostAmount}
                  onChange={(e) => setCustomCostAmount(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
              <Btn
                size="sm"
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
                className="flex items-center justify-between rounded-[10px] border-[2px] border-fog bg-cream px-3 py-2"
              >
                <span className="font-medium text-[13px] text-espresso">{cc.description}</span>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-[13px] text-espresso">${cc.amount.toFixed(2)}</span>
                  <button
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
              <span className="font-extrabold text-espresso">${getTotalAdditionalCosts(order).toFixed(2)}</span>
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

// ── Main component ──────────────────────────────────────────────────────────

export function OrdersClient({
  initialOrders,
  productCogsMap,
  allComponents,
  coffeeInventory,
  isAdminConfigured,
}: OrdersClientProps) {
  const [orders] = useState(initialOrders);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [addingComponentTo, setAddingComponentTo] = useState<string | null>(null);
  const [selectedComponentId, setSelectedComponentId] = useState<string>("");
  const [componentQuantity, setComponentQuantity] = useState<number>(1);
  const [addingCustomCostTo, setAddingCustomCostTo] = useState<string | null>(null);
  const [customCostDescription, setCustomCostDescription] = useState<string>("");
  const [customCostAmount, setCustomCostAmount] = useState<string>("");
  const [roastRequestOrder, setRoastRequestOrder] = useState<Order | null>(null);
  const [roastRequestData, setRoastRequestData] = useState({
    greenCoffeeId: "",
    quantityG: "",
    priority: "normal" as "low" | "normal" | "high" | "urgent",
    dueDate: "",
  });
  const [isCreatingRoastRequest, setIsCreatingRoastRequest] = useState(false);

  const filteredOrders = orders.filter(
    (order) =>
      order.order_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.order_line_items.some((item) =>
        item.title.toLowerCase().includes(searchQuery.toLowerCase())
      )
  );

  const handleSync = async () => {
    setIsSyncing(true);
    const result = await syncShopifyOrders();
    setIsSyncing(false);
    if (result.error) { alert(result.error); return; }
    if (result.success) window.location.reload();
  };

  const toggleOrderExpanded = (orderId: string) => {
    const next = new Set(expandedOrders);
    next.has(orderId) ? next.delete(orderId) : next.add(orderId);
    setExpandedOrders(next);
  };

  const getLineItemCogs = (item: OrderLineItem) => {
    if (!item.product_id) return 0;
    return (productCogsMap[item.product_id] || 0) * item.quantity;
  };
  const getOrderComponentsCogs = (order: Order) =>
    (order.order_components || []).reduce(
      (sum, oc) => sum + (oc.components?.cost_per_unit || 0) * oc.quantity,
      0
    );
  const getOrderCustomCostsTotal = (order: Order) =>
    (order.order_custom_costs || []).reduce((sum, cc) => sum + cc.amount, 0);
  const getTotalAdditionalCosts = (order: Order) =>
    getOrderComponentsCogs(order) + getOrderCustomCostsTotal(order);
  const getOrderCogs = (order: Order) => {
    const lineItemsCogs = order.order_line_items.reduce((sum, item) => sum + getLineItemCogs(item), 0);
    return lineItemsCogs + getTotalAdditionalCosts(order);
  };

  const handleAddComponent = async (orderId: string) => {
    if (!selectedComponentId || componentQuantity <= 0) return;
    const result = await addOrderComponent(orderId, selectedComponentId, componentQuantity);
    if (result.error) { alert(result.error); } else {
      setAddingComponentTo(null);
      setSelectedComponentId("");
      setComponentQuantity(1);
      window.location.reload();
    }
  };
  const handleUpdateQuantity = async (orderComponentId: string, newQuantity: number) => {
    const result = await updateOrderComponentQuantity(orderComponentId, newQuantity);
    if (result.error) alert(result.error); else window.location.reload();
  };
  const handleRemoveComponent = async (orderComponentId: string) => {
    const result = await removeOrderComponent(orderComponentId);
    if (result.error) alert(result.error); else window.location.reload();
  };
  const handleAddCustomCost = async (orderId: string) => {
    const amount = parseFloat(customCostAmount);
    if (!customCostDescription.trim() || isNaN(amount) || amount <= 0) return;
    const result = await addOrderCustomCost(orderId, customCostDescription, amount);
    if (result.error) { alert(result.error); } else {
      setAddingCustomCostTo(null);
      setCustomCostDescription("");
      setCustomCostAmount("");
      window.location.reload();
    }
  };
  const handleRemoveCustomCost = async (customCostId: string) => {
    const result = await removeOrderCustomCost(customCostId);
    if (result.error) alert(result.error); else window.location.reload();
  };

  const handleCreateRoastRequest = async () => {
    if (!roastRequestOrder || !roastRequestData.greenCoffeeId || !roastRequestData.quantityG) return;
    const selectedCoffee = coffeeInventory.find((c) => c.id === roastRequestData.greenCoffeeId);
    if (!selectedCoffee) return;
    setIsCreatingRoastRequest(true);
    const quantityG = parseFloat(roastRequestData.quantityG);
    const result = await createRoastRequestForOrder({
      orderId: roastRequestOrder.id,
      greenCoffeeId: roastRequestData.greenCoffeeId,
      coffeeName: selectedCoffee.name,
      requestedRoastedG: quantityG,
      priority: roastRequestData.priority,
      dueDate: roastRequestData.dueDate || undefined,
    });
    setIsCreatingRoastRequest(false);
    if (result.error) {
      alert(result.error);
    } else {
      setRoastRequestOrder(null);
      setRoastRequestData({ greenCoffeeId: "", quantityG: "", priority: "normal", dueDate: "" });
      alert(result.merged
        ? `Added ${quantityG}g to existing roast request for ${selectedCoffee.name}. View it in the Roasting page.`
        : "Roast request created! View it in the Roasting page."
      );
    }
  };

  const totalRevenue = orders.reduce((sum, o) => sum + (o.total_price || 0), 0);
  const totalCogs = orders.reduce((sum, o) => sum + getOrderCogs(o), 0);
  const totalProfit = totalRevenue - totalCogs;
  const avgMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

  if (!isAdminConfigured) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-[28px] md:text-[36px] font-extrabold uppercase tracking-tight leading-none text-espresso">
            Orders
          </h1>
          <p className="text-[13px] text-espresso/60 font-medium mt-1">
            Sync and analyze orders from your Shopify store
          </p>
        </div>
        <div className="bg-chalk border-[3px] border-espresso rounded-[16px] shadow-flat-md flex flex-col items-center justify-center py-14 text-center px-6">
          <div className="w-14 h-14 rounded-full border-[3px] border-sun bg-sun/20 flex items-center justify-center mb-4">
            <Settings size={24} strokeWidth={2} className="text-espresso" />
          </div>
          <h3 className="font-extrabold text-[17px] uppercase tracking-[.04em] text-espresso mb-2">
            Shopify Not Connected
          </h3>
          <p className="text-[13px] text-espresso/60 font-medium max-w-sm mb-5">
            Connect your Shopify store in Settings to start syncing orders.
          </p>
          <Link href="/settings">
            <Btn>
              <Settings size={13} strokeWidth={2.2} className="mr-1.5" />
              Go to Settings
            </Btn>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-[28px] md:text-[36px] font-extrabold uppercase tracking-tight leading-none text-espresso">
            Orders
          </h1>
          <p className="text-[13px] text-espresso/60 font-medium mt-1">
            Track revenue, COGS, and profit per order
          </p>
        </div>
        <Btn onClick={handleSync} disabled={isSyncing}>
          <RefreshCw
            size={13}
            strokeWidth={2.2}
            className={`mr-1.5 ${isSyncing ? "animate-spin" : ""}`}
          />
          <span className="hidden sm:inline">{isSyncing ? "Syncing..." : "Sync Orders"}</span>
          <span className="sm:hidden">{isSyncing ? "..." : "Sync"}</span>
        </Btn>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Total Revenue" value={`$${totalRevenue.toFixed(2)}`} />
        <StatCard label="Total COGS" value={`$${totalCogs.toFixed(2)}`} />
        <StatCard
          label="Gross Profit"
          value={`$${totalProfit.toFixed(2)}`}
          valueClassName={totalProfit >= 0 ? "text-matcha" : "text-tomato"}
        />
        <StatCard
          label="Avg Margin"
          value={`${avgMargin.toFixed(1)}%`}
          valueClassName={avgMargin >= 30 ? "text-matcha" : avgMargin >= 15 ? "text-honey" : "text-tomato"}
        />
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={15} strokeWidth={2.2} className="absolute left-3 top-1/2 -translate-y-1/2 text-espresso/40" />
        <input
          type="text"
          placeholder="Search orders..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-cream border-[2.5px] border-espresso rounded-[10px] pl-9 pr-3 py-2 text-[13px] font-medium text-espresso placeholder:text-espresso/40 shadow-[3px_3px_0_#1C0F05] focus:outline-none focus:border-tomato focus:shadow-[3px_3px_0_#E8442A] transition-all duration-[120ms]"
        />
      </div>

      {/* Orders */}
      {orders.length === 0 ? (
        <div className="bg-chalk border-[3px] border-espresso rounded-[16px] shadow-flat-md flex flex-col items-center justify-center py-14 text-center px-6">
          <ShoppingCart size={32} strokeWidth={1.5} className="text-espresso/30 mb-3" />
          <h3 className="font-extrabold text-[15px] uppercase tracking-[.06em] text-espresso mb-1">
            No Orders Yet
          </h3>
          <p className="text-[13px] text-espresso/50 font-medium">
            Click &quot;Sync Orders&quot; to import from Shopify
          </p>
        </div>
      ) : (
        <div className="bg-chalk border-[3px] border-espresso rounded-[16px] shadow-flat-md overflow-hidden">
          {/* Panel header */}
          <div className="flex items-center justify-between px-5 py-4 border-b-2 border-espresso bg-cream">
            <div className="font-extrabold text-sm uppercase tracking-[.08em] text-espresso">
              Orders ({filteredOrders.length})
            </div>
            <div className="text-[11px] text-espresso/50 font-medium">
              Click an order to expand
            </div>
          </div>

          {/* Mobile */}
          <div className="md:hidden divide-y-[2px] divide-dashed divide-fog">
            {filteredOrders.map((order) => {
              const revenue = order.total_price || 0;
              const cogs = getOrderCogs(order);
              const profit = revenue - cogs;
              const margin = revenue > 0 ? ((revenue - cogs) / revenue) * 100 : 0;
              const isExpanded = expandedOrders.has(order.id);
              return (
                <React.Fragment key={`mobile-${order.id}`}>
                  <div
                    className="cursor-pointer px-4 py-3 active:bg-fog/30"
                    onClick={() => toggleOrderExpanded(order.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        {isExpanded
                          ? <ChevronDown size={15} strokeWidth={2.2} className="text-espresso/50 shrink-0" />
                          : <ChevronRight size={15} strokeWidth={2.2} className="text-espresso/50 shrink-0" />
                        }
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-[14px] text-espresso">{order.order_name}</span>
                            {order.ready_to_ship && <Truck size={13} strokeWidth={2} className="text-matcha" />}
                          </div>
                          <span className="text-[11px] text-espresso/50 font-medium">
                            {order.created_at_shopify ? format(new Date(order.created_at_shopify), "MMM d, yyyy") : "—"}
                          </span>
                        </div>
                      </div>
                      <Link href={`/orders/${order.id}`} onClick={(e) => e.stopPropagation()}>
                        <button className="p-1.5 rounded-[8px] text-espresso/50 hover:text-espresso hover:bg-fog/50 transition-colors">
                          <ExternalLink size={14} strokeWidth={2.2} />
                        </button>
                      </Link>
                    </div>
                    <div className="flex flex-wrap gap-1.5 pl-6 mt-1.5">
                      <StatusPill status={order.financial_status} type="financial" />
                      <StatusPill status={order.fulfillment_status} type="fulfillment" />
                    </div>
                    <div className="grid grid-cols-4 gap-1 pl-6 mt-2">
                      {[
                        ["Rev", `$${revenue.toFixed(2)}`, ""],
                        ["COGS", `$${cogs.toFixed(2)}`, ""],
                        ["Profit", `$${profit.toFixed(2)}`, profit >= 0 ? "text-matcha" : "text-tomato"],
                      ].map(([label, val, cls]) => (
                        <div key={label}>
                          <div className="text-[10px] font-extrabold uppercase tracking-[.06em] text-espresso/50">{label}</div>
                          <div className={`text-[12px] font-bold text-espresso ${cls}`}>{val}</div>
                        </div>
                      ))}
                      <div>
                        <div className="text-[10px] font-extrabold uppercase tracking-[.06em] text-espresso/50">Margin</div>
                        <MarginPill margin={margin} />
                      </div>
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="bg-cream/60 px-5 py-4">
                      <OrderExpandedContent
                        order={order}
                        productCogsMap={productCogsMap}
                        allComponents={allComponents}
                        coffeeInventory={coffeeInventory}
                        getLineItemCogs={getLineItemCogs}
                        getOrderComponentsCogs={getOrderComponentsCogs}
                        getOrderCustomCostsTotal={getOrderCustomCostsTotal}
                        getTotalAdditionalCosts={getTotalAdditionalCosts}
                        addingComponentTo={addingComponentTo}
                        setAddingComponentTo={setAddingComponentTo}
                        selectedComponentId={selectedComponentId}
                        setSelectedComponentId={setSelectedComponentId}
                        componentQuantity={componentQuantity}
                        setComponentQuantity={setComponentQuantity}
                        handleAddComponent={handleAddComponent}
                        handleUpdateQuantity={handleUpdateQuantity}
                        handleRemoveComponent={handleRemoveComponent}
                        addingCustomCostTo={addingCustomCostTo}
                        setAddingCustomCostTo={setAddingCustomCostTo}
                        customCostDescription={customCostDescription}
                        setCustomCostDescription={setCustomCostDescription}
                        customCostAmount={customCostAmount}
                        setCustomCostAmount={setCustomCostAmount}
                        handleAddCustomCost={handleAddCustomCost}
                        handleRemoveCustomCost={handleRemoveCustomCost}
                        setRoastRequestOrder={setRoastRequestOrder}
                      />
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>

          {/* Desktop table */}
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
                        <td className="px-3 py-3 text-right font-bold text-espresso">${revenue.toFixed(2)}</td>
                        <td className="px-3 py-3 text-right font-bold text-espresso">${cogs.toFixed(2)}</td>
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
                            <OrderExpandedContent
                              order={order}
                              productCogsMap={productCogsMap}
                              allComponents={allComponents}
                              coffeeInventory={coffeeInventory}
                              getLineItemCogs={getLineItemCogs}
                              getOrderComponentsCogs={getOrderComponentsCogs}
                              getOrderCustomCostsTotal={getOrderCustomCostsTotal}
                              getTotalAdditionalCosts={getTotalAdditionalCosts}
                              addingComponentTo={addingComponentTo}
                              setAddingComponentTo={setAddingComponentTo}
                              selectedComponentId={selectedComponentId}
                              setSelectedComponentId={setSelectedComponentId}
                              componentQuantity={componentQuantity}
                              setComponentQuantity={setComponentQuantity}
                              handleAddComponent={handleAddComponent}
                              handleUpdateQuantity={handleUpdateQuantity}
                              handleRemoveComponent={handleRemoveComponent}
                              addingCustomCostTo={addingCustomCostTo}
                              setAddingCustomCostTo={setAddingCustomCostTo}
                              customCostDescription={customCostDescription}
                              setCustomCostDescription={setCustomCostDescription}
                              customCostAmount={customCostAmount}
                              setCustomCostAmount={setCustomCostAmount}
                              handleAddCustomCost={handleAddCustomCost}
                              handleRemoveCustomCost={handleRemoveCustomCost}
                              setRoastRequestOrder={setRoastRequestOrder}
                            />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Roast Request Dialog */}
      <Dialog
        open={!!roastRequestOrder}
        onOpenChange={(open) => !open && setRoastRequestOrder(null)}
      >
        <DialogContent className="max-w-md p-0 gap-0 border-[3px] border-espresso rounded-[16px] overflow-hidden bg-chalk shadow-flat-lg">
          <div className="bg-cream border-b-[3px] border-espresso px-6 py-4">
            <DialogHeader>
              <DialogTitle className="font-extrabold text-[15px] uppercase tracking-[.08em] text-espresso">
                Create Roast Request
              </DialogTitle>
            </DialogHeader>
          </div>

          <div className="px-6 py-5 space-y-4">
            <p className="text-[13px] text-espresso/60 font-medium">
              Creating roast request for order{" "}
              <span className="font-bold text-espresso">{roastRequestOrder?.order_name}</span>
            </p>

            <div>
              <FieldLabel>Coffee to Roast</FieldLabel>
              <Select
                value={roastRequestData.greenCoffeeId}
                onValueChange={(value) => setRoastRequestData({ ...roastRequestData, greenCoffeeId: value })}
              >
                <SelectTrigger className="border-[2.5px] border-espresso bg-cream rounded-[10px] shadow-[3px_3px_0_#1C0F05] focus:ring-0 focus:border-tomato">
                  <SelectValue placeholder="Select coffee" />
                </SelectTrigger>
                <SelectContent>
                  {coffeeInventory.map((coffee) => (
                    <SelectItem key={coffee.id} value={coffee.id}>
                      {coffee.name} — {coffee.current_green_quantity_g.toLocaleString()}g available
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <FieldLabel>Quantity Needed (grams)</FieldLabel>
              <MerninInput
                type="number"
                step="1"
                min="0"
                value={roastRequestData.quantityG}
                onChange={(e) => setRoastRequestData({ ...roastRequestData, quantityG: e.target.value })}
                placeholder="e.g., 500"
              />
            </div>

            <div>
              <FieldLabel>Priority</FieldLabel>
              <Select
                value={roastRequestData.priority}
                onValueChange={(value: "low" | "normal" | "high" | "urgent") =>
                  setRoastRequestData({ ...roastRequestData, priority: value })
                }
              >
                <SelectTrigger className="border-[2.5px] border-espresso bg-cream rounded-[10px] shadow-[3px_3px_0_#1C0F05] focus:ring-0 focus:border-tomato">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <FieldLabel>Due Date (optional)</FieldLabel>
              <MerninInput
                type="date"
                value={roastRequestData.dueDate}
                onChange={(e) => setRoastRequestData({ ...roastRequestData, dueDate: e.target.value })}
              />
            </div>
          </div>

          <div className="bg-cream border-t-[3px] border-espresso px-6 py-4 flex justify-end gap-2">
            <Btn variant="outline" onClick={() => setRoastRequestOrder(null)}>
              Cancel
            </Btn>
            <Btn
              onClick={handleCreateRoastRequest}
              disabled={isCreatingRoastRequest || !roastRequestData.greenCoffeeId || !roastRequestData.quantityG}
            >
              {isCreatingRoastRequest ? "Creating..." : "Create Request"}
            </Btn>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

"use client";

import React from "react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  RefreshCw,
  Search,
  ShoppingCart,
  ChevronDown,
  ChevronRight,
  Truck,
  ExternalLink,
  Settings,
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
import {
  getLineItemCogs as cogsLineItem,
  getOrderComponentsCogs as cogsOrderComponents,
  getOrderCustomCostsTotal as cogsCustomCosts,
  getTotalAdditionalCosts as cogsAdditional,
  getOrderCogs as cogsOrder,
} from "@/lib/orders/cogs";
import { type PeriodValue } from "@/lib/orders/constants";
import {
  Btn,
  StatCard,
  MerninInput,
  FieldLabel,
  StatusPill,
  MarginPill,
} from "./components/primitives";
import { ExpandedOrder } from "./components/ExpandedOrder";
import { OrdersWorksheetTable } from "./components/OrdersWorksheetTable";
import { PeriodControl } from "./components/PeriodControl";
import type {
  Order,
  OrderLineItem,
  ComponentData,
  CoffeeInventory,
} from "./components/types";

// ── Types ───────────────────────────────────────────────────────────────────
//
// The row/entity shapes moved to ./components/types so the extracted components
// can share them without importing from their own parent.

interface OrdersClientProps {
  initialOrders: Order[];
  productCogsMap: Record<string, number>;
  allComponents: ComponentData[];
  coffeeInventory: CoffeeInventory[];
  isAdminConfigured: boolean;
  /** Active window. The list below is only the orders inside it. */
  period: PeriodValue;
  /**
   * Aggregates over the WHOLE period, computed server-side. Not derived from
   * `initialOrders` — that array is one page, and summing it would under-report
   * as soon as a period exceeds the page limit.
   */
  totals: { revenue: number; cogs: number; profit: number; margin: number };
  missingCogsCount: number;
}

// ── Main component ──────────────────────────────────────────────────────────

export function OrdersClient({
  initialOrders,
  productCogsMap,
  allComponents,
  coffeeInventory,
  isAdminConfigured,
  period,
  totals,
}: OrdersClientProps) {
  const router = useRouter();
  const [orders, setOrders] = useState(initialOrders);
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

  useEffect(() => {
    setOrders(initialOrders);
  }, [initialOrders]);

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
    if (result.success) router.refresh();
  };

  const toggleOrderExpanded = (orderId: string) => {
    const next = new Set(expandedOrders);
    next.has(orderId) ? next.delete(orderId) : next.add(orderId);
    setExpandedOrders(next);
  };

  // The costing math now lives in @/lib/orders/cogs so the per-row figures and
  // the server-side range aggregate cannot drift apart. These adapters only bind
  // `productCogsMap`, which the module takes explicitly instead of closing over —
  // so every call site below, and ExpandedOrder's props, stay unchanged.
  const getLineItemCogs = (item: OrderLineItem) => cogsLineItem(item, productCogsMap);
  const getOrderComponentsCogs = (order: Order) => cogsOrderComponents(order);
  const getOrderCustomCostsTotal = (order: Order) => cogsCustomCosts(order);
  const getTotalAdditionalCosts = (order: Order) => cogsAdditional(order);
  const getOrderCogs = (order: Order) => cogsOrder(order, productCogsMap);

  const handleAddComponent = async (orderId: string) => {
    if (!selectedComponentId || componentQuantity <= 0) return;
    const result = await addOrderComponent(orderId, selectedComponentId, componentQuantity);
    if (result.error) { alert(result.error); } else {
      setAddingComponentTo(null);
      setSelectedComponentId("");
      setComponentQuantity(1);
      router.refresh();
    }
  };
  const handleUpdateQuantity = async (orderComponentId: string, newQuantity: number) => {
    const result = await updateOrderComponentQuantity(orderComponentId, newQuantity);
    if (result.error) alert(result.error); else router.refresh();
  };
  const handleRemoveComponent = async (orderComponentId: string) => {
    const result = await removeOrderComponent(orderComponentId);
    if (result.error) alert(result.error); else router.refresh();
  };
  const handleAddCustomCost = async (orderId: string) => {
    const amount = parseFloat(customCostAmount);
    if (!customCostDescription.trim() || isNaN(amount) || amount <= 0) return;
    const result = await addOrderCustomCost(orderId, customCostDescription, amount);
    if (result.error) { alert(result.error); } else {
      setAddingCustomCostTo(null);
      setCustomCostDescription("");
      setCustomCostAmount("");
      router.refresh();
    }
  };
  const handleRemoveCustomCost = async (customCostId: string) => {
    const result = await removeOrderCustomCost(customCostId);
    if (result.error) alert(result.error); else router.refresh();
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

  // Everything the expanded row needs, assembled once and forwarded unchanged to
  // both renderings. Same prop names, same handlers, same values as before the
  // Stage A extraction — only the call site is shared.
  const expandedProps = {
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
  };

  // From the server, over the whole period. These used to be reduced over
  // `orders`, which was correct only while that fetch was unbounded — now that
  // it is limited, summing it would report a page under a period's label.
  const totalRevenue = totals.revenue;
  const totalCogs = totals.cogs;
  const totalProfit = totals.profit;
  const avgMargin = totals.margin;

  // "1 year" reads badly inside "the last …", so say it the way a person would.
  const periodPhrase = period === "365" ? "Year" : `${period} Days`;

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
        <div className="flex items-center gap-3 flex-wrap justify-end">
          <PeriodControl
            period={period}
            onSelect={(value) => router.push(`/orders?period=${value}`)}
          />
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
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          label="Total Revenue"
          value={`$${totalRevenue.toFixed(2)}`}
          valueTestId="stat-revenue"
        />
        <StatCard
          label="Total COGS"
          value={`$${totalCogs.toFixed(2)}`}
          valueTestId="stat-cogs"
        />
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
          {/*
            The list is period-scoped now, so "No Orders Yet" would be a lie in
            the common case: the orders may exist, just outside this window.
            Nothing here distinguishes "no orders at all" from "none in range",
            so name the period and point at the way out. Search is scoped the
            same way, which is why this has to be said rather than implied.
          */}
          <h3 className="font-extrabold text-[15px] uppercase tracking-[.06em] text-espresso mb-1">
            Nothing In The Last {periodPhrase}
          </h3>
          <p className="text-[13px] text-espresso/50 font-medium">
            {period === "365"
              ? "Nothing synced this year. Hit “Sync Orders” to pull from Shopify."
              : "Try a longer period, or hit “Sync Orders” to pull from Shopify."}
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

          {/*
            Mobile card list. Stays here on purpose: deleting this duplicate
            rendering is Stage B's job (spec Criterion 11), and removing it as
            part of the Stage A extraction would move the mobile baseline and
            make a behavioural change indistinguishable from a styling one.
          */}
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
                      <ExpandedOrder order={order} {...expandedProps} />
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>

          {/* Desktop table */}
          <OrdersWorksheetTable
            filteredOrders={filteredOrders}
            expandedOrders={expandedOrders}
            toggleOrderExpanded={toggleOrderExpanded}
            getOrderCogs={getOrderCogs}
            {...expandedProps}
          />
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
                <SelectTrigger data-testid="roast-coffee-select" className="border-[2.5px] border-espresso bg-cream rounded-[10px] shadow-[3px_3px_0_#1C0F05] focus:ring-0 focus:border-tomato">
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
                testId="roast-quantity-input"
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
              testId="roast-request-submit"
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

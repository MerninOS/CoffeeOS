"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Plus,
  Trash2,
  Coffee,
  Truck,
} from "lucide-react";
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  updateOrderReadyToShip,
  assignRoastedCoffeeToOrder,
  removeRoastedCoffeeFromOrder,
} from "./actions";
import {
  addOrderCustomCost,
  removeOrderCustomCost,
  addOrderComponent,
  removeOrderComponent,
} from "../actions";

// ── Types ───────────────────────────────────────────────────────────────────

type OrderLineItem = {
  id: string;
  title: string;
  variant_title: string | null;
  sku: string | null;
  quantity: number;
  price: number;
  total_price: number;
  product_id: string | null;
  products: {
    id: string;
    title: string;
    product_components: Array<{
      id: string;
      quantity: number;
      components: { id: string; name: string; type: string; cost_per_unit: number } | null;
    }>;
  } | null;
};

type OrderComponent = {
  id: string;
  component_id: string;
  quantity: number;
  components: { id: string; name: string; type: string; cost_per_unit: number } | null;
};

type OrderCustomCost = { id: string; description: string; amount: number };

type OrderRoastedCoffee = {
  id: string;
  green_coffee_id: string;
  amount_g: number;
  assigned_at: string;
  green_coffee_inventory: { id: string; name: string } | null;
};

type Order = {
  id: string;
  order_name: string;
  created_at_shopify: string;
  financial_status: string;
  fulfillment_status: string | null;
  subtotal_price: number;
  total_tax: number;
  total_price: number;
  currency: string;
  ready_to_ship: boolean;
  order_line_items: OrderLineItem[];
  order_components: OrderComponent[];
  order_custom_costs: OrderCustomCost[];
  order_roasted_coffee: OrderRoastedCoffee[];
};

type CoffeeStock = { id: string; name: string; origin: string | null; roasted_stock_g: number };
type Component = { id: string; name: string; type: string; cost_per_unit: number };

interface OrderDetailClientProps {
  order: Order;
  coffeeStock: CoffeeStock[];
  components: Component[];
}

// ── Primitives ──────────────────────────────────────────────────────────────

function Btn({
  children,
  onClick,
  disabled,
  variant = "primary",
  size = "md",
  className = "",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md";
  className?: string;
}) {
  const base =
    "inline-flex items-center justify-center font-extrabold uppercase tracking-[.08em] transition-all duration-[120ms] border-[2.5px] cursor-pointer disabled:opacity-50 disabled:pointer-events-none";
  const sizes = { sm: "text-[11px] px-3 py-1.5 rounded-[8px]", md: "text-[12px] px-4 py-2 rounded-[10px]" };
  const variants = {
    primary: "bg-tomato text-cream border-espresso shadow-[3px_3px_0_#1C0F05] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_#1C0F05] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none",
    outline: "bg-transparent text-espresso border-espresso hover:bg-espresso hover:text-cream",
    ghost: "bg-transparent text-espresso border-transparent hover:bg-fog/50 shadow-none",
    danger: "bg-transparent text-tomato border-tomato hover:bg-tomato hover:text-cream",
  };
  return (
    <button onClick={onClick} disabled={disabled} className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}>
      {children}
    </button>
  );
}

function Panel({
  title,
  action,
  children,
  className = "",
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`bg-chalk border-[3px] border-espresso rounded-[16px] shadow-flat-md overflow-hidden ${className}`}>
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-b-2 border-espresso bg-cream">
        <div className="font-extrabold text-sm uppercase tracking-[.08em] text-espresso">{title}</div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-extrabold uppercase tracking-[.08em] text-espresso mb-1">
      {children}
    </div>
  );
}

function MerninInput({
  type = "text",
  value,
  onChange,
  placeholder,
  step,
  min,
}: {
  type?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  step?: string;
  min?: string;
}) {
  return (
    <input
      type={type}
      step={step}
      min={min}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className="w-full bg-cream border-[2.5px] border-espresso rounded-[10px] px-3 py-2 text-[13px] font-medium text-espresso placeholder:text-espresso/40 shadow-[3px_3px_0_#1C0F05] focus:outline-none focus:border-tomato focus:shadow-[3px_3px_0_#E8442A] transition-all duration-[120ms]"
    />
  );
}

function StatusPill({ status, type }: { status: string | null; type: "financial" | "fulfillment" }) {
  const s = (status || "").toLowerCase();
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
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full border-[2px] ${bg} text-[11px] font-extrabold uppercase tracking-[.06em]`}>
      {status || "Unfulfilled"}
    </span>
  );
}

// ── Component ────────────────────────────────────────────────────────────────

export function OrderDetailClient({
  order: initialOrder,
  coffeeStock: initialCoffeeStock,
  components: initialComponents,
}: OrderDetailClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [order, setOrder] = useState(initialOrder);
  const [coffeeStock] = useState(initialCoffeeStock);
  const [components] = useState(initialComponents);

  const [isAddCostOpen, setIsAddCostOpen] = useState(false);
  const [isAddCoffeeOpen, setIsAddCoffeeOpen] = useState(false);
  const [isAddComponentOpen, setIsAddComponentOpen] = useState(false);
  const [deleteAssignmentId, setDeleteAssignmentId] = useState<string | null>(null);
  const [deleteCostId, setDeleteCostId] = useState<string | null>(null);
  const [deleteComponentId, setDeleteComponentId] = useState<string | null>(null);

  const [newCostDescription, setNewCostDescription] = useState("");
  const [newCostAmount, setNewCostAmount] = useState("");
  const [selectedCoffeeId, setSelectedCoffeeId] = useState("");
  const [coffeeAmount, setCoffeeAmount] = useState("");
  const [selectedComponentId, setSelectedComponentId] = useState("");
  const [componentQuantity, setComponentQuantity] = useState("1");

  useEffect(() => { setOrder(initialOrder); }, [initialOrder]);

  const assignedCoffeeList = order.order_roasted_coffee.map((a) => ({
    id: a.id,
    greenCoffeeId: a.green_coffee_id,
    coffeeName: a.green_coffee_inventory?.name || "Unknown Coffee",
    amountG: a.amount_g,
    assignedAt: a.assigned_at,
  }));
  const totalAssignedCoffeeG = assignedCoffeeList.reduce((sum, c) => sum + c.amountG, 0);

  const calculateCOGS = () => {
    let total = 0;
    for (const lineItem of order.order_line_items) {
      const product = lineItem.products;
      if (!product) continue;
      for (const pc of product.product_components || []) {
        if (!pc.components) continue;
        total += pc.quantity * pc.components.cost_per_unit * lineItem.quantity;
      }
    }
    for (const oc of order.order_components) {
      if (oc.components) total += oc.quantity * oc.components.cost_per_unit;
    }
    for (const cost of order.order_custom_costs) {
      total += cost.amount;
    }
    return total;
  };

  const cogs = calculateCOGS();
  const profit = order.total_price - cogs;
  const margin = order.total_price > 0 ? (profit / order.total_price) * 100 : 0;
  const shipping = (order.total_price || 0) - (order.subtotal_price || 0) - (order.total_tax || 0);

  const LBS_TO_GRAMS = 453.592;
  const gramsToLbs = (g: number) => (g / LBS_TO_GRAMS).toFixed(2);

  const handleToggleReadyToShip = () => {
    startTransition(async () => {
      const result = await updateOrderReadyToShip(order.id, !order.ready_to_ship);
      if (result.success) setOrder({ ...order, ready_to_ship: !order.ready_to_ship });
    });
  };

  const handleAddCustomCost = () => {
    const amount = parseFloat(newCostAmount);
    if (!newCostDescription.trim() || isNaN(amount)) return;
    startTransition(async () => {
      const result = await addOrderCustomCost(order.id, newCostDescription, amount);
      if (result.success) {
        router.refresh();
        setIsAddCostOpen(false);
        setNewCostDescription("");
        setNewCostAmount("");
      }
    });
  };

  const handleRemoveCustomCost = (costId: string) => {
    startTransition(async () => {
      const result = await removeOrderCustomCost(costId);
      if (result.success) { router.refresh(); setDeleteCostId(null); }
    });
  };

  const handleAssignCoffee = () => {
    const amount = parseFloat(coffeeAmount);
    if (!selectedCoffeeId || isNaN(amount) || amount <= 0) return;
    startTransition(async () => {
      const result = await assignRoastedCoffeeToOrder(order.id, selectedCoffeeId, amount);
      if (result.success) {
        router.refresh();
        setIsAddCoffeeOpen(false);
        setSelectedCoffeeId("");
        setCoffeeAmount("");
      } else if (result.error) alert(result.error);
    });
  };

  const handleRemoveCoffeeAssignment = (assignmentId: string) => {
    startTransition(async () => {
      const result = await removeRoastedCoffeeFromOrder(assignmentId);
      if (result.success) { router.refresh(); setDeleteAssignmentId(null); }
    });
  };

  const handleAddComponent = () => {
    const quantity = parseInt(componentQuantity);
    if (!selectedComponentId || isNaN(quantity) || quantity <= 0) return;
    startTransition(async () => {
      const result = await addOrderComponent(order.id, selectedComponentId, quantity);
      if (result.success) {
        router.refresh();
        setIsAddComponentOpen(false);
        setSelectedComponentId("");
        setComponentQuantity("1");
      }
    });
  };

  const handleRemoveComponent = (orderComponentId: string) => {
    startTransition(async () => {
      const result = await removeOrderComponent(orderComponentId);
      if (result.success) { router.refresh(); setDeleteComponentId(null); }
    });
  };

  return (
    <div className="p-6 space-y-5 bg-cream min-h-full">
      {/* Header */}
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

      {/* Status + summary cards */}
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
            content: (
              <div>
                <div className={`text-[24px] font-extrabold leading-none ${margin >= 0 ? "text-matcha" : "text-tomato"}`}>
                  {margin.toFixed(1)}%
                </div>
                <div className={`text-[11px] font-bold mt-0.5 ${profit >= 0 ? "text-matcha" : "text-tomato"}`}>
                  ${profit.toFixed(2)} profit
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

      {/* Assigned Roasted Coffee */}
      <Panel
        title="Assigned Roasted Coffee"
        action={
          <Dialog open={isAddCoffeeOpen} onOpenChange={setIsAddCoffeeOpen}>
            <DialogTrigger asChild>
              <Btn size="sm" variant="outline">
                <Plus size={12} strokeWidth={2.5} className="mr-1" />
                Assign Coffee
              </Btn>
            </DialogTrigger>
            <DialogContent className="max-w-md p-0 gap-0 border-[3px] border-espresso rounded-[16px] overflow-hidden bg-chalk shadow-flat-lg">
              <div className="bg-cream border-b-[3px] border-espresso px-6 py-4">
                <DialogHeader>
                  <DialogTitle className="font-extrabold text-[15px] uppercase tracking-[.08em] text-espresso">
                    Assign Roasted Coffee
                  </DialogTitle>
                  <DialogDescription className="text-[12px] text-espresso/60 mt-1">
                    Deducts from your roasted stock.
                  </DialogDescription>
                </DialogHeader>
              </div>
              <div className="px-6 py-5 space-y-4">
                <div>
                  <FieldLabel>Coffee</FieldLabel>
                  <Select value={selectedCoffeeId} onValueChange={setSelectedCoffeeId}>
                    <SelectTrigger className="border-[2.5px] border-espresso bg-cream rounded-[10px] shadow-[3px_3px_0_#1C0F05] focus:ring-0 focus:border-tomato">
                      <SelectValue placeholder="Select coffee..." />
                    </SelectTrigger>
                    <SelectContent>
                      {coffeeStock.map((coffee) => (
                        <SelectItem key={coffee.id} value={coffee.id}>
                          {coffee.name} ({coffee.roasted_stock_g}g available)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <FieldLabel>Amount (grams)</FieldLabel>
                  <MerninInput
                    type="number"
                    value={coffeeAmount}
                    onChange={(e) => setCoffeeAmount(e.target.value)}
                    placeholder="Enter amount in grams"
                  />
                </div>
              </div>
              <div className="bg-cream border-t-[3px] border-espresso px-6 py-4 flex justify-end gap-2">
                <Btn variant="outline" onClick={() => setIsAddCoffeeOpen(false)}>Cancel</Btn>
                <Btn onClick={handleAssignCoffee} disabled={isPending}>Assign Coffee</Btn>
              </div>
            </DialogContent>
          </Dialog>
        }
      >
        {assignedCoffeeList.length === 0 ? (
          <div className="py-6 text-center">
            <Coffee size={28} strokeWidth={1.5} className="mx-auto mb-2 text-espresso/30" />
            <p className="text-[13px] font-medium text-espresso/50">No roasted coffee assigned yet.</p>
            {coffeeStock.length > 0 && (
              <p className="text-[11px] text-espresso/40 mt-1">Click &quot;Assign Coffee&quot; to add from your stock.</p>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {assignedCoffeeList.map((assignment) => (
              <div
                key={assignment.id}
                className="flex items-center justify-between rounded-[10px] border-[2px] border-fog bg-cream px-4 py-2.5"
              >
                <div>
                  <span className="font-bold text-[13px] text-espresso">{assignment.coffeeName}</span>
                  <div className="text-[11px] text-espresso/50 font-medium">
                    {assignment.amountG.toLocaleString()}g ({gramsToLbs(assignment.amountG)} lbs)
                  </div>
                </div>
                <button
                  onClick={() => setDeleteAssignmentId(assignment.id)}
                  className="p-1.5 rounded-[8px] text-espresso/40 hover:text-tomato hover:bg-tomato/10 transition-colors"
                >
                  <Trash2 size={14} strokeWidth={2.2} />
                </button>
              </div>
            ))}
            <div className="flex justify-between rounded-[10px] border-[2px] border-espresso bg-cream px-4 py-2.5 mt-2">
              <span className="font-extrabold text-[12px] uppercase tracking-[.06em] text-espresso">Total Assigned</span>
              <span className="font-extrabold text-[13px] text-honey">
                {totalAssignedCoffeeG.toLocaleString()}g ({gramsToLbs(totalAssignedCoffeeG)} lbs)
              </span>
            </div>
          </div>
        )}
      </Panel>

      {/* Line Items */}
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

      {/* Custom Costs */}
      <Panel
        title="Custom Costs"
        action={
          <Dialog open={isAddCostOpen} onOpenChange={setIsAddCostOpen}>
            <DialogTrigger asChild>
              <Btn size="sm">
                <Plus size={12} strokeWidth={2.5} className="mr-1" />
                Add Cost
              </Btn>
            </DialogTrigger>
            <DialogContent className="max-w-md p-0 gap-0 border-[3px] border-espresso rounded-[16px] overflow-hidden bg-chalk shadow-flat-lg">
              <div className="bg-cream border-b-[3px] border-espresso px-6 py-4">
                <DialogHeader>
                  <DialogTitle className="font-extrabold text-[15px] uppercase tracking-[.08em] text-espresso">Add Custom Cost</DialogTitle>
                  <DialogDescription className="text-[12px] text-espresso/60 mt-1">
                    Add a one-off cost like shipping or packaging.
                  </DialogDescription>
                </DialogHeader>
              </div>
              <div className="px-6 py-5 space-y-4">
                <div>
                  <FieldLabel>Description</FieldLabel>
                  <MerninInput
                    value={newCostDescription}
                    onChange={(e) => setNewCostDescription(e.target.value)}
                    placeholder="e.g., Shipping, Packaging"
                  />
                </div>
                <div>
                  <FieldLabel>Amount ($)</FieldLabel>
                  <MerninInput
                    type="number"
                    step="0.01"
                    min="0"
                    value={newCostAmount}
                    onChange={(e) => setNewCostAmount(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div className="bg-cream border-t-[3px] border-espresso px-6 py-4 flex justify-end gap-2">
                <Btn variant="outline" onClick={() => setIsAddCostOpen(false)}>Cancel</Btn>
                <Btn onClick={handleAddCustomCost} disabled={isPending}>Add Cost</Btn>
              </div>
            </DialogContent>
          </Dialog>
        }
      >
        {order.order_custom_costs.length === 0 ? (
          <p className="text-[13px] text-espresso/50 font-medium text-center py-4">
            No custom costs added yet
          </p>
        ) : (
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b-[2px] border-dashed border-fog">
                <th className="text-left py-2 font-extrabold text-[11px] uppercase tracking-[.08em] text-espresso/50">Description</th>
                <th className="text-right py-2 font-extrabold text-[11px] uppercase tracking-[.08em] text-espresso/50">Amount</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {order.order_custom_costs.map((cost) => (
                <tr key={cost.id} className="border-b border-dashed border-fog/60">
                  <td className="py-2.5 font-medium text-espresso">{cost.description}</td>
                  <td className="py-2.5 text-right font-bold text-espresso">${cost.amount.toFixed(2)}</td>
                  <td className="py-2.5 text-right">
                    <button
                      onClick={() => setDeleteCostId(cost.id)}
                      className="p-1.5 rounded-[8px] text-espresso/40 hover:text-tomato hover:bg-tomato/10 transition-colors"
                    >
                      <Trash2 size={13} strokeWidth={2.2} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      {/* Additional Components */}
      <Panel
        title="Additional Components"
        action={
          <Dialog open={isAddComponentOpen} onOpenChange={setIsAddComponentOpen}>
            <DialogTrigger asChild>
              <Btn size="sm">
                <Plus size={12} strokeWidth={2.5} className="mr-1" />
                Add Component
              </Btn>
            </DialogTrigger>
            <DialogContent className="max-w-md p-0 gap-0 border-[3px] border-espresso rounded-[16px] overflow-hidden bg-chalk shadow-flat-lg">
              <div className="bg-cream border-b-[3px] border-espresso px-6 py-4">
                <DialogHeader>
                  <DialogTitle className="font-extrabold text-[15px] uppercase tracking-[.08em] text-espresso">Add Component</DialogTitle>
                  <DialogDescription className="text-[12px] text-espresso/60 mt-1">
                    Track component costs for this order.
                  </DialogDescription>
                </DialogHeader>
              </div>
              <div className="px-6 py-5 space-y-4">
                <div>
                  <FieldLabel>Component</FieldLabel>
                  <Select value={selectedComponentId} onValueChange={setSelectedComponentId}>
                    <SelectTrigger className="border-[2.5px] border-espresso bg-cream rounded-[10px] shadow-[3px_3px_0_#1C0F05] focus:ring-0 focus:border-tomato">
                      <SelectValue placeholder="Select component" />
                    </SelectTrigger>
                    <SelectContent>
                      {components.map((comp) => (
                        <SelectItem key={comp.id} value={comp.id}>
                          {comp.name} (${comp.cost_per_unit.toFixed(2)}/unit)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <FieldLabel>Quantity</FieldLabel>
                  <MerninInput
                    type="number"
                    min="1"
                    value={componentQuantity}
                    onChange={(e) => setComponentQuantity(e.target.value)}
                  />
                </div>
              </div>
              <div className="bg-cream border-t-[3px] border-espresso px-6 py-4 flex justify-end gap-2">
                <Btn variant="outline" onClick={() => setIsAddComponentOpen(false)}>Cancel</Btn>
                <Btn onClick={handleAddComponent} disabled={isPending}>Add Component</Btn>
              </div>
            </DialogContent>
          </Dialog>
        }
      >
        {order.order_components.length === 0 ? (
          <p className="text-[13px] text-espresso/50 font-medium text-center py-4">
            No additional components added
          </p>
        ) : (
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b-[2px] border-dashed border-fog">
                <th className="text-left py-2 font-extrabold text-[11px] uppercase tracking-[.08em] text-espresso/50">Component</th>
                <th className="text-center py-2 font-extrabold text-[11px] uppercase tracking-[.08em] text-espresso/50">Qty</th>
                <th className="text-right py-2 font-extrabold text-[11px] uppercase tracking-[.08em] text-espresso/50">Unit Cost</th>
                <th className="text-right py-2 font-extrabold text-[11px] uppercase tracking-[.08em] text-espresso/50">Total</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {order.order_components.map((oc) => (
                <tr key={oc.id} className="border-b border-dashed border-fog/60">
                  <td className="py-2.5 font-bold text-espresso">{oc.components?.name || "Unknown"}</td>
                  <td className="py-2.5 text-center font-bold text-espresso">{oc.quantity}</td>
                  <td className="py-2.5 text-right font-bold text-espresso">${oc.components?.cost_per_unit.toFixed(2) || "0.00"}</td>
                  <td className="py-2.5 text-right font-bold text-espresso">${((oc.components?.cost_per_unit || 0) * oc.quantity).toFixed(2)}</td>
                  <td className="py-2.5 text-right">
                    <button
                      onClick={() => setDeleteComponentId(oc.id)}
                      className="p-1.5 rounded-[8px] text-espresso/40 hover:text-tomato hover:bg-tomato/10 transition-colors"
                    >
                      <Trash2 size={13} strokeWidth={2.2} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      {/* Cost Summary */}
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
          <div className="flex justify-between pt-1">
            <span className="text-espresso/60 font-medium">Total COGS</span>
            <span className="font-bold text-tomato">−${cogs.toFixed(2)}</span>
          </div>
          <div className={`flex justify-between border-t-[2px] border-espresso pt-2 ${profit >= 0 ? "text-matcha" : "text-tomato"}`}>
            <span className="font-extrabold text-[14px] uppercase tracking-[.06em]">Net Profit</span>
            <span className="font-extrabold text-[14px]">${profit.toFixed(2)}</span>
          </div>
        </div>
      </Panel>

      {/* Delete confirmation dialogs */}
      <AlertDialog open={!!deleteAssignmentId} onOpenChange={() => setDeleteAssignmentId(null)}>
        <AlertDialogContent className="border-[3px] border-espresso rounded-[16px] bg-chalk shadow-flat-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-extrabold text-[15px] uppercase tracking-[.06em] text-espresso">Remove Coffee Assignment?</AlertDialogTitle>
            <AlertDialogDescription className="text-[13px] text-espresso/60">
              This will return the coffee to your roasted stock.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="font-extrabold text-[11px] uppercase tracking-[.08em] border-[2px] border-espresso rounded-[8px]">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteAssignmentId && handleRemoveCoffeeAssignment(deleteAssignmentId)}
              className="bg-tomato text-cream font-extrabold text-[11px] uppercase tracking-[.08em] border-[2px] border-espresso rounded-[8px] shadow-[3px_3px_0_#1C0F05]"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteCostId} onOpenChange={() => setDeleteCostId(null)}>
        <AlertDialogContent className="border-[3px] border-espresso rounded-[16px] bg-chalk shadow-flat-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-extrabold text-[15px] uppercase tracking-[.06em] text-espresso">Delete Custom Cost?</AlertDialogTitle>
            <AlertDialogDescription className="text-[13px] text-espresso/60">This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="font-extrabold text-[11px] uppercase tracking-[.08em] border-[2px] border-espresso rounded-[8px]">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteCostId && handleRemoveCustomCost(deleteCostId)}
              className="bg-tomato text-cream font-extrabold text-[11px] uppercase tracking-[.08em] border-[2px] border-espresso rounded-[8px] shadow-[3px_3px_0_#1C0F05]"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteComponentId} onOpenChange={() => setDeleteComponentId(null)}>
        <AlertDialogContent className="border-[3px] border-espresso rounded-[16px] bg-chalk shadow-flat-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-extrabold text-[15px] uppercase tracking-[.06em] text-espresso">Remove Component?</AlertDialogTitle>
            <AlertDialogDescription className="text-[13px] text-espresso/60">This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="font-extrabold text-[11px] uppercase tracking-[.08em] border-[2px] border-espresso rounded-[8px]">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteComponentId && handleRemoveComponent(deleteComponentId)}
              className="bg-tomato text-cream font-extrabold text-[11px] uppercase tracking-[.08em] border-[2px] border-espresso rounded-[8px] shadow-[3px_3px_0_#1C0F05]"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

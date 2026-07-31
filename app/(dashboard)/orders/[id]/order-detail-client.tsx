"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { classifyOrder, getOrderCogs } from "@/lib/orders/cogs";
import { blockingReason, mayShowMargin } from "@/lib/orders/format";
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
import type { OrderDetailClientProps, ProductRow } from "./components/types";
import { OrderHeader } from "./components/OrderHeader";
import { SummaryCards } from "./components/SummaryCards";
import { RoastedCoffeePanel } from "./components/RoastedCoffeePanel";
import { Worksheet } from "./components/Worksheet";
import { AddComponentRow } from "./components/AddComponentRow";
import { AddCostRow } from "./components/AddCostRow";
import { DeleteDialogs } from "./components/DeleteDialogs";

// ── Component ────────────────────────────────────────────────────────────────

export function OrderDetailClient({
  order: initialOrder,
  products,
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

  /**
   * Each line item joined to what the product lookup knows about it.
   *
   * `linked` and `hasRecipe` stay separate because they are different failures
   * with different remedies: a line item pointing at a product that no longer
   * exists cannot be repaired by costing anything (CoffeeOS#78), while one whose
   * product simply has no recipe can. Collapsing them is the defect
   * CoffeeOS#100 fixed, and `unitCost > 0` is not a substitute for either — a
   * product costed entirely from zero-cost components is genuinely $0.00.
   */
  const rows: ProductRow[] = order.order_line_items.map((li) => {
    const product = li.product_id ? products[li.product_id] : undefined;
    return {
      id: li.id,
      title: li.title,
      variantTitle: li.variant_title,
      sku: li.sku,
      qty: li.quantity,
      price: li.price,
      unitCost: product?.cogs ?? 0,
      linked: Boolean(product),
      hasRecipe: Boolean(product?.hasRecipe),
    };
  });

  // Costed through lib/orders/cogs.ts — the one implementation /orders and the
  // Shopify packing block already share. This page used to carry its own
  // (`calculateCOGS`), which walked `lineItem.products.product_components`
  // directly and was wrong twice over: it never saw variant-level recipes (the
  // query did not even fetch them), and it skipped a line item resolving to no
  // product before dividing anyway, so an unlinked item contributed full revenue
  // and zero cost. On production that inflated the margin on 240 of 316 orders.
  //
  // A fourth implementation of this formula is not wanted. CoffeeOS#100.
  const cogs = getOrderCogs(order, products);
  const profit = order.total_price - cogs;
  const margin = order.total_price > 0 ? (profit / order.total_price) * 100 : 0;

  // Whether this order's cost is knowable at all. Same call /orders and the
  // packing block make, so the three surfaces cannot disagree about an order.
  //
  // `costed` is the ONLY status that may show a margin. Everything derived from
  // an unknown cost — profit, margin — is not "uncertain", it is invented, and
  // printing it in red would say "be careful about this number" when the honest
  // statement is "there is no number". That is how the old figure got believed.
  const costability = classifyOrder(order, products);
  const costKnown = mayShowMargin(costability.status);

  // What the operator would have to fix, named. Lives in lib/orders/format.ts so
  // the copy is asserted by tests rather than re-declared by them.
  const blockedBy = blockingReason(costability, cogs);
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
      <OrderHeader
        order={order}
        isPending={isPending}
        handleToggleReadyToShip={handleToggleReadyToShip}
      />
      {/* Status + summary cards */}
      <SummaryCards order={order} costKnown={costKnown} margin={margin} profit={profit} />
      {/* Assigned Roasted Coffee */}
      <RoastedCoffeePanel
        isAddCoffeeOpen={isAddCoffeeOpen}
        setIsAddCoffeeOpen={setIsAddCoffeeOpen}
        coffeeStock={coffeeStock}
        selectedCoffeeId={selectedCoffeeId}
        setSelectedCoffeeId={setSelectedCoffeeId}
        coffeeAmount={coffeeAmount}
        setCoffeeAmount={setCoffeeAmount}
        handleAssignCoffee={handleAssignCoffee}
        isPending={isPending}
        assignedCoffeeList={assignedCoffeeList}
        totalAssignedCoffeeG={totalAssignedCoffeeG}
        gramsToLbs={gramsToLbs}
        setDeleteAssignmentId={setDeleteAssignmentId}
      />
      {/* The worksheet — line items, order components, custom costs and the
          totals that reconcile them, on ONE set of column tracks. Replaces four
          separate panels; see Worksheet.tsx for why that is the whole point. */}
      <Worksheet
        order={order}
        rows={rows}
        cogs={cogs}
        costKnown={costKnown}
        profit={profit}
        margin={margin}
        blockedBy={blockedBy}
        shipping={shipping}
        onRemoveComponent={setDeleteComponentId}
        onRemoveCost={setDeleteCostId}
        addComponentRow={
          <AddComponentRow
            components={components}
            selectedComponentId={selectedComponentId}
            setSelectedComponentId={setSelectedComponentId}
            componentQuantity={componentQuantity}
            setComponentQuantity={setComponentQuantity}
            handleAddComponent={handleAddComponent}
            isPending={isPending}
          />
        }
        addCostRow={
          <AddCostRow
            newCostDescription={newCostDescription}
            setNewCostDescription={setNewCostDescription}
            newCostAmount={newCostAmount}
            setNewCostAmount={setNewCostAmount}
            handleAddCustomCost={handleAddCustomCost}
            isPending={isPending}
          />
        }
      />

      {/* Delete confirmation dialogs */}
      <DeleteDialogs
        deleteAssignmentId={deleteAssignmentId}
        setDeleteAssignmentId={setDeleteAssignmentId}
        handleRemoveCoffeeAssignment={handleRemoveCoffeeAssignment}
        deleteCostId={deleteCostId}
        setDeleteCostId={setDeleteCostId}
        handleRemoveCustomCost={handleRemoveCustomCost}
        deleteComponentId={deleteComponentId}
        setDeleteComponentId={setDeleteComponentId}
        handleRemoveComponent={handleRemoveComponent}
      />
    </div>
  );
}

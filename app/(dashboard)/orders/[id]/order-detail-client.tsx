"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { classifyOrder, getOrderCogs } from "@/lib/orders/cogs";
import { blockingReason, cogsLabel, mayShowMargin } from "@/lib/orders/format";
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
import { InlineBanner } from "@merninos/ui/instrument";
import { OrderHeader } from "./components/OrderHeader";
import { MarginHero } from "./components/MarginHero";
import { CoffeeBlock } from "./components/CoffeeBlock";
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

  const [error, setError] = useState<string | null>(null);
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
      // Matches classifyOrder's condition exactly (`!hasRecipe || cogs < 0`).
      // A recipe totalling negative cannot be a real cost, and rendering it as
      // one contradicts the withheld margin printed directly beneath it — and
      // disagrees with /orders, which shows `not set` for the same line.
      hasRecipe: Boolean(product?.hasRecipe) && (product?.cogs ?? 0) >= 0,
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
  /**
   * Shopify's totalPrice is net of order-level discounts while subtotalPrice is
   * not, so `total - subtotal - tax` books any discount as NEGATIVE shipping —
   * routinely rendering "$-6.00" under a Shipping label. `total_shipping` is
   * already stored (lib/orders/sync.ts), so read it and give the residual its
   * own line, which also makes the totals visibly reconcile.
   */
  const shipping = order.total_shipping ?? 0;
  const discount =
    (order.subtotal_price || 0) + shipping + (order.total_tax || 0) - (order.total_price || 0);

  const LBS_TO_GRAMS = 453.592;
  const gramsToLbs = (g: number) => (g / LBS_TO_GRAMS).toFixed(2);

  /**
   * Every mutating handler returns whether it SUCCEEDED, and reports failure.
   *
   * The inline add-rows own their open state, so they need the answer to decide
   * whether to close. Closing regardless — which is what the first version of
   * this conversion did — discards what the operator typed and hides the
   * failure entirely. The dialogs this replaced closed inside
   * `if (result.success)`, so unconditional closing was a behaviour regression,
   * not a simplification.
   */
  const run = async (
    // The actions return a UNION ({error} | {success}), not one shape.
    action: () => Promise<{ success?: boolean; error?: string }>,
    onSuccess?: () => void,
  ): Promise<boolean> => {
    const result = await action();
    if (result.success) {
      setError(null);
      onSuccess?.();
      return true;
    }
    // Every failure is surfaced. Previously only coffee assignment said
    // anything, and it did so through a browser alert().
    setError(result.error || "That did not save. Nothing has changed.");
    return false;
  };

  const handleToggleReadyToShip = () =>
    run(() => updateOrderReadyToShip(order.id, !order.ready_to_ship), () => {
      // router.refresh() rather than a local setOrder: every other handler
      // refreshes, and a stale-closure spread can clobber a concurrently
      // refreshed mutation — they share one transition.
      router.refresh();
    });

  const handleAddCustomCost = async (): Promise<boolean> => {
    const amount = parseFloat(newCostAmount);
    if (!newCostDescription.trim() || isNaN(amount)) {
      setError("Give the cost a description and an amount.");
      return false;
    }
    return run(() => addOrderCustomCost(order.id, newCostDescription, amount), () => {
      router.refresh();
      setNewCostDescription("");
      setNewCostAmount("");
    });
  };

  const handleRemoveCustomCost = (costId: string) =>
    run(() => removeOrderCustomCost(costId), () => {
      router.refresh();
      setDeleteCostId(null);
    });

  const handleAssignCoffee = async (): Promise<boolean> => {
    const amount = parseFloat(coffeeAmount);
    if (!selectedCoffeeId || isNaN(amount) || amount <= 0) {
      setError("Pick a coffee and enter an amount in grams.");
      return false;
    }
    return run(() => assignRoastedCoffeeToOrder(order.id, selectedCoffeeId, amount), () => {
      router.refresh();
      setSelectedCoffeeId("");
      setCoffeeAmount("");
    });
  };

  const handleRemoveCoffeeAssignment = (assignmentId: string) =>
    run(() => removeRoastedCoffeeFromOrder(assignmentId), () => {
      router.refresh();
      setDeleteAssignmentId(null);
    });

  const handleAddComponent = async (): Promise<boolean> => {
    const quantity = parseInt(componentQuantity);
    if (!selectedComponentId || isNaN(quantity) || quantity <= 0) {
      setError("Pick a component and enter a quantity.");
      return false;
    }
    return run(() => addOrderComponent(order.id, selectedComponentId, quantity), () => {
      router.refresh();
      setSelectedComponentId("");
      setComponentQuantity("1");
    });
  };

  const handleRemoveComponent = (orderComponentId: string) =>
    run(() => removeOrderComponent(orderComponentId), () => {
      router.refresh();
      setDeleteComponentId(null);
    });

  return (
    <div className="p-6" style={{ display: "flex", flexDirection: "column", gap: 20, minHeight: "100%" }}>
      {/* Header */}
      <OrderHeader
        order={order}
        isPending={isPending}
        handleToggleReadyToShip={handleToggleReadyToShip}
      />
      {error && (
        <InlineBanner tone="danger" title="That did not save">
          {error}
        </InlineBanner>
      )}

      {/* ONE hero figure + a ruled strip. Never a row of equal cards — the
          statuses moved to header badges, where states belong. */}
      <MarginHero
        costKnown={costKnown}
        margin={margin}
        profit={profit}
        revenue={order.total_price}
        cogsText={cogsLabel(cogs, costKnown)}
        itemCount={rows.reduce((n, r) => n + r.qty, 0)}
        reason={blockedBy}
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
        discount={discount}
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

      {/* Fulfillment, not cost — deliberately below the worksheet and outside
          it. Draws down roasted stock; never enters COGS. */}
      <CoffeeBlock
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
        isPending={isPending}
      />
    </div>
  );
}

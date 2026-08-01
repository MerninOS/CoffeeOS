"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  EmptyState,
  HeroMetric,
  Input,
  SegmentedControl,
  Select,
  StatStrip,
} from "@merninos/ui/instrument";
import { Plus, Search, Warehouse } from "lucide-react";
import { overline, money } from "@/lib/instrument/tokens";
import { gramsToLbs } from "@/lib/inventory/units";
import { stockState, totals } from "@/lib/inventory/valuation";
import { InventoryWorksheetTable } from "./components/InventoryWorksheetTable";
import { LOW_RULE } from "./components/Depletion";
import {
  AdjustStockDialog,
  DeleteLotDialog,
  LotFormDialog,
} from "./components/InventoryDialogs";
import type { CoffeeInventory } from "./components/types";
import {
  createCoffeeInventory,
  updateCoffeeInventory,
  adjustInventoryQuantity,
  deleteCoffeeInventory,
} from "./actions";


interface InventoryClientProps {
  initialInventory: CoffeeInventory[];
}

// ── Main Component ───────────────────────────────────────────────────────────

export function InventoryClient({ initialInventory }: InventoryClientProps) {
  const router = useRouter();

  /**
   * Read straight from props — NOT useState(initialInventory).
   *
   * The mutation handlers now call router.refresh() instead of
   * window.location.reload(). A refresh re-renders the server component and
   * hands down new props, but a useState initialiser runs once, so state would
   * pin the list at its first value and every figure on the page would go stale
   * after the first edit. The full reload was hiding that.
   */
  const inventory = initialInventory;
  const [searchQuery, setSearchQuery] = useState("");
  const [stockFilter, setStockFilter] = useState("all");
  const [supplierFilter, setSupplierFilter] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isAdjustDialogOpen, setIsAdjustDialogOpen] = useState(false);
  const [editingCoffee, setEditingCoffee] = useState<CoffeeInventory | null>(null);
  const [adjustingCoffee, setAdjustingCoffee] = useState<CoffeeInventory | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [adjustError, setAdjustError] = useState<string | null>(null);
  const [deletingCoffee, setDeletingCoffee] = useState<CoffeeInventory | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    origin: "",
    lot_code: "",
    supplier: "",
    price_per_lb: "",
    quantity_lbs: "",
    purchase_date: "",
    notes: "",
  });

  const [adjustmentData, setAdjustmentData] = useState({
    change_type: "manual_green_adjust" as
      | "manual_green_adjust"
      | "roast_deduct"
      | "sale_deduct",
    quantity: "",
    notes: "",
  });

  const suppliers = Array.from(
    new Set(inventory.map((c) => c.supplier).filter(Boolean) as string[]),
  ).sort();

  const filteredInventory = inventory
    .filter((coffee) => {
      if (stockFilter === "all") return true;
      return stockState(gramsToLbs(coffee.current_green_quantity_g)) ===
        (stockFilter === "in" ? "ok" : stockFilter);
    })
    .filter((coffee) => !supplierFilter || coffee.supplier === supplierFilter)
    .filter((coffee) =>
      [coffee.name, coffee.origin, coffee.supplier, coffee.lot_code].some((v) =>
        (v ?? "").toLowerCase().includes(searchQuery.toLowerCase()),
      ),
    );

  /**
   * TWO SCOPES, deliberately. The strip describes the whole catalogue; the
   * worksheet footer totals only the rows on screen.
   *
   * Before this, both read the catalogue and the footer rendered inside the
   * filtered table, so any search left the footer totalling lots it was not
   * showing (spec Criterion 12). Passing the list in makes the scope a call
   * site's choice rather than a hidden coupling.
   */
  const catalogue = totals(inventory);
  const visible = totals(filteredInventory);
  const needsAttention = inventory.filter(
    (c) => stockState(gramsToLbs(c.current_green_quantity_g)) !== "ok",
  ).length;

  const resetForm = () => {
    setFormError(null);
    setFormData({
      name: "",
      origin: "",
      lot_code: "",
      supplier: "",
      price_per_lb: "",
      quantity_lbs: "",
      purchase_date: "",
      notes: "",
    });
    setEditingCoffee(null);
  };

  const handleAddOrEdit = async () => {
    setIsSubmitting(true);
    try {
      if (editingCoffee) {
        const result = await updateCoffeeInventory(editingCoffee.id, {
          name: formData.name,
          origin: formData.origin,
          lot_code: formData.lot_code || undefined,
          supplier: formData.supplier || undefined,
          price_per_lb: parseFloat(formData.price_per_lb),
          notes: formData.notes || undefined,
        });
        if (result.error) {
          setFormError(result.error);
        } else {
          setIsAddDialogOpen(false);
          resetForm();
          router.refresh();
        }
      } else {
        const result = await createCoffeeInventory({
          name: formData.name,
          origin: formData.origin,
          lot_code: formData.lot_code || undefined,
          supplier: formData.supplier || undefined,
          price_per_lb: parseFloat(formData.price_per_lb),
          quantity_lbs: parseFloat(formData.quantity_lbs),
          purchase_date: formData.purchase_date || undefined,
          notes: formData.notes || undefined,
        });
        if (result.error) {
          setFormError(result.error);
        } else {
          setIsAddDialogOpen(false);
          resetForm();
          router.refresh();
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAdjustQuantity = async () => {
    if (!adjustingCoffee) return;
    setIsSubmitting(true);
    try {
      const quantity = parseFloat(adjustmentData.quantity);
      const actualChange =
        adjustmentData.change_type === "manual_green_adjust"
          ? quantity
          : -Math.abs(quantity);

      const result = await adjustInventoryQuantity(
        adjustingCoffee.id,
        adjustmentData.change_type,
        actualChange,
        adjustmentData.notes || undefined
      );

      if (result.error) {
        setAdjustError(result.error);
      } else {
        setIsAdjustDialogOpen(false);
        setAdjustingCoffee(null);
        setAdjustmentData({
          change_type: "manual_green_adjust",
          quantity: "",
          notes: "",
        });
        router.refresh();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  /** Opens the confirmation dialog; the delete itself happens on confirm. */
  const handleDelete = (id: string) => {
    setDeletingCoffee(inventory.find((c) => c.id === id) ?? null);
  };

  const confirmDelete = async () => {
    if (!deletingCoffee) return;
    setIsDeleting(true);
    try {
      const result = await deleteCoffeeInventory(deletingCoffee.id);
      if (result.error) {
        // No dialog of its own: the row is still there and the operator can
        // retry. Surfacing it in the confirm dialog would fight the close.
        setFormError(result.error);
      }
      setDeletingCoffee(null);
      router.refresh();
    } finally {
      setIsDeleting(false);
    }
  };

  const openEditDialog = (coffee: CoffeeInventory) => {
    setEditingCoffee(coffee);
    setFormData({
      name: coffee.name,
      origin: coffee.origin,
      lot_code: coffee.lot_code || "",
      supplier: coffee.supplier || "",
      price_per_lb: coffee.price_per_lb.toString(),
      quantity_lbs: gramsToLbs(coffee.initial_quantity_g).toFixed(2),
      purchase_date: coffee.purchase_date || "",
      notes: coffee.notes || "",
    });
    setIsAddDialogOpen(true);
  };

  const openAdjustDialog = (coffee: CoffeeInventory) => {
    setAdjustError(null);
    setAdjustingCoffee(coffee);
    setAdjustmentData({
      change_type: "manual_green_adjust",
      quantity: "",
      notes: "",
    });
    setIsAdjustDialogOpen(true);
  };

  return (
    <div className="p-6" style={{ maxWidth: "var(--content-max)", margin: "0 auto" }}>
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-6">
        <div>
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontVariationSettings: "var(--display-settings)",
              fontWeight: "var(--display-weight)" as unknown as number,
              letterSpacing: "var(--display-tracking)",
              fontSize: "var(--fs-display)",
              textTransform: "uppercase",
              color: "var(--ink)",
              margin: 0,
            }}
          >
            Green inventory
          </h1>
          <p
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "var(--fs-body)",
              color: "var(--ink-muted)",
              marginTop: 6,
            }}
          >
            Every lot in the warehouse, what it cost, and where it went.
          </p>
        </div>
        <LotFormDialog
          open={isAddDialogOpen}
          onOpenChange={(open) => {
            setIsAddDialogOpen(open);
            if (!open) resetForm();
          }}
          editingCoffee={editingCoffee}
          values={formData}
          onChange={setFormData}
          error={formError}
          isSubmitting={isSubmitting}
          onSubmit={handleAddOrEdit}
        />
      </div>

      {/*
        ONE hero figure over a ruled strip, not a row of equal cards. Inventory
        value carries the page because it is the figure that ties this screen to
        cost; green, roasted, lot count and the attention count are supporting.

        The figure TEXT is unchanged from the loud version ("35.0 lbs",
        "$979.44") so the Stage 1 capability tests still assert the same strings
        — hence `value` carries the unit rather than StatStrip's `unit` prop, and
        the hero does not use toLocaleString (which would insert a comma).

        The test ids ride on nested spans because neither component forwards
        unknown props.
      */}
      <div className="flex flex-wrap gap-6 items-end mb-6">
        <div style={{ flex: "0 0 260px" }}>
          <HeroMetric
            label="Inventory value"
            value={<span data-testid="stat-value">{money(catalogue.value)}</span>}
            note="green coffee at cost"
          />
        </div>
        <div style={{ flex: "1 1 480px", minWidth: 0 }}>
          <StatStrip
            stats={[
              {
                label: "Green stock",
                value: (
                  <span data-testid="stat-green">
                    {catalogue.greenLbs.toFixed(1)} lbs
                  </span>
                ),
              },
              {
                label: "Roasted stock",
                value: (
                  <span data-testid="stat-roasted">
                    {catalogue.roastedLbs.toFixed(1)} lbs
                  </span>
                ),
              },
              { label: "Lots tracked", value: String(inventory.length) },
              {
                /*
                  Coloured directly rather than via StatStrip's `tone`, whose only
                  red is `tone="live"` — banned in CoffeeOS, because there is no
                  realtime layer for it to mean anything. `--danger` carries
                  body-size red; `--brand` is the live register.
                */
                label: "Low or out",
                value: (
                  <span
                    data-testid="stat-attention"
                    style={{ color: needsAttention > 0 ? "var(--danger)" : undefined }}
                  >
                    {needsAttention}
                  </span>
                ),
              },
            ]}
          />
        </div>
      </div>

      {/* Filter bar — a genuinely modular bordered container, one of the few
          places the design system allows one. */}
      <div
        className="flex items-center gap-3 flex-wrap mb-4"
        style={{
          padding: 10,
          background: "var(--surface-sunken)",
          border: "1px solid var(--hairline)",
          borderRadius: "var(--r-md)",
        }}
      >
        <div style={{ flex: "1 1 220px", minWidth: 180, maxWidth: 300 }}>
          <Input
            size="sm"
            mono
            leading={<Search size={14} strokeWidth={1.5} />}
            placeholder="Name, origin, supplier, lot"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <SegmentedControl
          size="sm"
          value={stockFilter}
          onChange={setStockFilter}
          options={[
            { value: "all", label: "All" },
            { value: "in", label: "In stock" },
            { value: "low", label: "Low" },
            { value: "out", label: "Out" },
          ]}
        />
        <div style={{ width: 170 }}>
          <Select
            size="sm"
            value={supplierFilter}
            onChange={(e) => setSupplierFilter(e.target.value)}
          >
            <option value="">Any supplier</option>
            {suppliers.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </div>
        {/* The rule stated next to the filter that applies it. It was a bare
            `5` inline in the row renderer with nothing on screen saying so. */}
        <span style={overline} className="ml-auto">
          {LOW_RULE}
        </span>
      </div>

      {/* Worksheet */}
      {filteredInventory.length === 0 ? (
        <EmptyState
          icon={<Warehouse size={28} strokeWidth={1.5} />}
          title="No lots match"
          description="Try clearing the search or switching the stock filter."
          action={
            <Button
              variant="secondary"
              onClick={() => {
                setSearchQuery("");
                setStockFilter("all");
                setSupplierFilter("");
              }}
            >
              Clear filters
            </Button>
          }
        />
      ) : (
        <InventoryWorksheetTable
          rows={filteredInventory}
          totalGreenLbs={visible.greenLbs}
          totalRoastedLbs={visible.roastedLbs}
          totalValue={visible.value}
          onAdjust={openAdjustDialog}
          onEdit={openEditDialog}
          onDelete={handleDelete}
        />
      )}

      <div className="flex items-center justify-between mt-4">
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "var(--fs-caption)",
            color: "var(--ink-muted)",
          }}
        >
          {filteredInventory.length} of {inventory.length} lots
        </span>
      </div>

      <AdjustStockDialog
        open={isAdjustDialogOpen}
        onOpenChange={setIsAdjustDialogOpen}
        coffee={adjustingCoffee}
        values={adjustmentData}
        onChange={setAdjustmentData}
        error={adjustError}
        isSubmitting={isSubmitting}
        onSubmit={handleAdjustQuantity}
      />

      <DeleteLotDialog
        open={!!deletingCoffee}
        onOpenChange={(open) => !open && setDeletingCoffee(null)}
        coffee={deletingCoffee}
        isDeleting={isDeleting}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

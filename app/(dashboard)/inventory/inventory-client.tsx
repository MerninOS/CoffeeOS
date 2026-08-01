"use client";

import { useState } from "react";
import { Edit, Trash2, Search, Scale, Warehouse } from "lucide-react";
import { gramsToLbs } from "@/lib/inventory/units";
import { lotValue, stockState, totals } from "@/lib/inventory/valuation";
import { InventoryWorksheetTable } from "./components/InventoryWorksheetTable";
import { AdjustStockDialog, LotFormDialog } from "./components/InventoryDialogs";
import { Panel, StatCard } from "./components/primitives";
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

// ── Primitives ──────────────────────────────────────────────────────────────
// ── Main Component ───────────────────────────────────────────────────────────

export function InventoryClient({ initialInventory }: InventoryClientProps) {
  const [inventory, setInventory] = useState(initialInventory);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isAdjustDialogOpen, setIsAdjustDialogOpen] = useState(false);
  const [editingCoffee, setEditingCoffee] = useState<CoffeeInventory | null>(null);
  const [adjustingCoffee, setAdjustingCoffee] = useState<CoffeeInventory | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const filteredInventory = inventory.filter(
    (coffee) =>
      coffee.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      coffee.origin.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (coffee.supplier?.toLowerCase().includes(searchQuery.toLowerCase()) ??
        false)
  );

  // Totals over the WHOLE CATALOGUE, which is what this page does today even
  // though the footer renders inside the filtered table. That mismatch is a real
  // defect (spec Criterion 12) but fixing it here would move pixels, and this
  // stage has to prove it changed nothing. Stage 4 passes the visible rows to
  // the footer and leaves the strip on the catalogue.
  const { greenLbs: totalGreenLbs, roastedLbs: totalRoastedLbs, value: totalValue } =
    totals(inventory);

  const resetForm = () => {
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
          alert(result.error);
        } else {
          setIsAddDialogOpen(false);
          resetForm();
          window.location.reload();
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
          alert(result.error);
        } else {
          setIsAddDialogOpen(false);
          resetForm();
          window.location.reload();
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
        alert(result.error);
      } else {
        setIsAdjustDialogOpen(false);
        setAdjustingCoffee(null);
        setAdjustmentData({
          change_type: "manual_green_adjust",
          quantity: "",
          notes: "",
        });
        window.location.reload();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (
      !confirm(
        "Are you sure you want to delete this coffee? This cannot be undone."
      )
    )
      return;
    const result = await deleteCoffeeInventory(id);
    if (result.error) {
      alert(result.error);
    } else {
      window.location.reload();
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
    setAdjustingCoffee(coffee);
    setAdjustmentData({
      change_type: "manual_green_adjust",
      quantity: "",
      notes: "",
    });
    setIsAdjustDialogOpen(true);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[28px] md:text-[36px] font-extrabold uppercase tracking-tight leading-none text-espresso">
            Coffee Inventory
          </h1>
          <p className="text-[13px] text-espresso/60 font-medium mt-1">
            Manage your green and roasted coffee stock
          </p>
        </div>

        <LotFormDialog
          isAddDialogOpen={isAddDialogOpen}
          setIsAddDialogOpen={setIsAddDialogOpen}
          resetForm={resetForm}
          editingCoffee={editingCoffee}
          formData={formData}
          setFormData={setFormData}
          isSubmitting={isSubmitting}
          handleAddOrEdit={handleAddOrEdit}
        />
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Total Green Stock"
          value={`${totalGreenLbs.toFixed(1)} lbs`}
          sub={`${inventory.length} coffees tracked`}
          testId="stat-green"
        />
        <StatCard
          label="Total Roasted Stock"
          value={`${totalRoastedLbs.toFixed(1)} lbs`}
          testId="stat-roasted"
        />
        <StatCard
          label="Total Inventory Value"
          value={`$${totalValue.toFixed(2)}`}
          sub="Green coffee at cost"
          testId="stat-value"
        />
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search
          size={15}
          strokeWidth={2.2}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-espresso/40"
        />
        <input
          type="text"
          placeholder="Search by name, origin, or supplier..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-cream border-[2.5px] border-espresso rounded-[10px] pl-9 pr-3 py-2 text-[13px] font-medium text-espresso placeholder:text-espresso/40 shadow-[3px_3px_0_#1C0F05] focus:outline-none focus:border-tomato focus:shadow-[3px_3px_0_#E8442A] transition-all duration-[120ms]"
        />
      </div>

      {/* Inventory table */}
      <Panel title="Green Coffee" subtitle={`${filteredInventory.length} coffees`}>
        <InventoryWorksheetTable
          filteredInventory={filteredInventory}
          searchQuery={searchQuery}
          totalGreenLbs={totalGreenLbs}
          totalRoastedLbs={totalRoastedLbs}
          totalValue={totalValue}
          openAdjustDialog={openAdjustDialog}
          openEditDialog={openEditDialog}
          handleDelete={handleDelete}
        />

        {/* Mobile card layout */}
        <div className="md:hidden -mx-5 -mb-5 divide-y-[2px] divide-dashed divide-fog">
          {filteredInventory.length === 0 ? (
            <div className="px-5 py-10 text-center text-espresso/50 font-medium flex flex-col items-center gap-2">
              <Warehouse size={28} strokeWidth={1.5} className="text-espresso/30" />
              {searchQuery
                ? "No coffees match your search."
                : "Nothing here yet. Add your first coffee."}
            </div>
          ) : (
            <>
              {filteredInventory.map((coffee) => {
                const greenLbs = gramsToLbs(coffee.current_green_quantity_g);
                const roastedLbs = gramsToLbs(coffee.roasted_stock_g || 0);
                const totalCoffeeValue = lotValue(coffee);
                const isLow = stockState(greenLbs) === "low";
                return (
                  <div key={coffee.id} className="px-5 py-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-bold text-espresso">
                          {coffee.name}
                        </div>
                        <div className="text-[12px] text-espresso/60 font-medium">
                          {coffee.origin}
                          {coffee.supplier ? ` · ${coffee.supplier}` : ""}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => openAdjustDialog(coffee)}
                          className="p-1.5 rounded-[8px] text-espresso/60 hover:text-espresso hover:bg-fog/50 transition-colors"
                        >
                          <Scale size={15} strokeWidth={2.2} />
                        </button>
                        <button
                          onClick={() => openEditDialog(coffee)}
                          className="p-1.5 rounded-[8px] text-espresso/60 hover:text-espresso hover:bg-fog/50 transition-colors"
                        >
                          <Edit size={15} strokeWidth={2.2} />
                        </button>
                        <button
                          onClick={() => handleDelete(coffee.id)}
                          className="p-1.5 rounded-[8px] text-espresso/60 hover:text-tomato hover:bg-tomato/10 transition-colors"
                        >
                          <Trash2 size={15} strokeWidth={2.2} />
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <div className="text-[10px] font-extrabold uppercase tracking-[.08em] text-espresso/50 mb-0.5">
                          Price/lb
                        </div>
                        <div className="font-bold text-espresso text-[13px]">
                          ${coffee.price_per_lb.toFixed(2)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] font-extrabold uppercase tracking-[.08em] text-espresso/50 mb-0.5">
                          Value
                        </div>
                        <div className="font-bold text-espresso text-[13px]">
                          ${totalCoffeeValue.toFixed(2)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] font-extrabold uppercase tracking-[.08em] text-espresso/50 mb-0.5">
                          Green Stock
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-espresso text-[13px]">
                            {greenLbs.toFixed(1)} lbs
                          </span>
                          {isLow && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full border-[2px] border-espresso bg-sun text-espresso text-[9px] font-extrabold uppercase">
                              Low
                            </span>
                          )}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] font-extrabold uppercase tracking-[.08em] text-espresso/50 mb-0.5">
                          Roasted Stock
                        </div>
                        <div className="font-bold text-espresso text-[13px]">
                          {roastedLbs.toFixed(1)} lbs
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              {/* Mobile totals */}
              <div className="px-5 py-4 bg-cream border-t-[2px] border-espresso">
                <div className="text-[10px] font-extrabold uppercase tracking-[.08em] text-espresso/50 mb-2">
                  Totals
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <div className="text-[10px] font-extrabold uppercase tracking-[.08em] text-espresso/40 mb-0.5">
                      Green
                    </div>
                    <div className="font-extrabold text-espresso text-[13px]">
                      {totalGreenLbs.toFixed(1)} lbs
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-extrabold uppercase tracking-[.08em] text-espresso/40 mb-0.5">
                      Roasted
                    </div>
                    <div className="font-extrabold text-espresso text-[13px]">
                      {totalRoastedLbs.toFixed(1)} lbs
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-extrabold uppercase tracking-[.08em] text-espresso/40 mb-0.5">
                      Value
                    </div>
                    <div className="font-extrabold text-espresso text-[13px]">
                      ${totalValue.toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </Panel>

      {/* Adjust Quantity Dialog */}
      {/* Adjust Quantity Dialog */}
      <AdjustStockDialog
        isAdjustDialogOpen={isAdjustDialogOpen}
        setIsAdjustDialogOpen={setIsAdjustDialogOpen}
        adjustingCoffee={adjustingCoffee}
        adjustmentData={adjustmentData}
        setAdjustmentData={setAdjustmentData}
        isSubmitting={isSubmitting}
        handleAdjustQuantity={handleAdjustQuantity}
      />
    </div>
  );
}

"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Scale, TrendingDown } from "lucide-react";
import { gramsToLbs } from "@/lib/inventory/units";
import { Btn, FieldLabel, MerninInput, MerninTextarea } from "./primitives";
import type { CoffeeInventory } from "./types";

/**
 * The add/edit and adjust dialogs, moved verbatim out of inventory-client.tsx
 * (CoffeeOS#72 Stage 3).
 *
 * EXTRACTION ONLY — the markup is byte-identical and /inventory's baselines do
 * not move. As with the worksheet table, the props keep the CALLER'S names so
 * the moved JSX needed no edits; Stage 4 renames them when it rewrites this.
 *
 * RADIX STAYS in Stage 4, rather than becoming instrument's Modal: that Modal
 * renders no `role="dialog"` and could not be driven by the capability tests
 * these extractions are proved against. `/products` documented the same call at
 * products/components/ProductDialogs.tsx. What Stage 4 must add is
 * `data-surface="app"` on each DialogContent — Radix portals these to <body>,
 * outside the subtree that scopes the instrument tokens, so without it every
 * var(--token) inside resolves to nothing.
 */

export function LotFormDialog({
  isAddDialogOpen,
  setIsAddDialogOpen,
  resetForm,
  editingCoffee,
  formData,
  setFormData,
  isSubmitting,
  handleAddOrEdit,
}: {
  isAddDialogOpen: boolean;
  setIsAddDialogOpen: (open: boolean) => void;
  resetForm: () => void;
  editingCoffee: CoffeeInventory | null;
  formData: {
    name: string;
    origin: string;
    lot_code: string;
    supplier: string;
    price_per_lb: string;
    quantity_lbs: string;
    purchase_date: string;
    notes: string;
  };
  setFormData: (data: LotFormDialogProps["formData"]) => void;
  isSubmitting: boolean;
  handleAddOrEdit: () => void;
}) {
  return (
        <Dialog
          open={isAddDialogOpen}
          onOpenChange={(open) => {
            setIsAddDialogOpen(open);
            if (!open) resetForm();
          }}
        >
          <DialogTrigger asChild>
            <Btn>
              <Plus size={14} strokeWidth={2.5} className="mr-1.5" />
              Add Coffee
            </Btn>
          </DialogTrigger>

          <DialogContent data-testid="lot-form-dialog" className="max-w-2xl p-0 gap-0 border-[3px] border-espresso rounded-[16px] overflow-hidden bg-chalk shadow-flat-lg">
            {/* Dialog header */}
            <div className="bg-cream border-b-[3px] border-espresso px-6 py-4">
              <DialogHeader>
                <DialogTitle className="font-extrabold text-[15px] uppercase tracking-[.08em] text-espresso">
                  {editingCoffee ? "Edit Coffee" : "Add New Coffee"}
                </DialogTitle>
              </DialogHeader>
            </div>

            {/* Dialog body */}
            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <FieldLabel>Name *</FieldLabel>
                  <MerninInput
                    id="name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="Ethiopia Yirgacheffe"
                  />
                </div>
                <div>
                  <FieldLabel>Origin *</FieldLabel>
                  <MerninInput
                    id="origin"
                    value={formData.origin}
                    onChange={(e) =>
                      setFormData({ ...formData, origin: e.target.value })
                    }
                    placeholder="Ethiopia"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <FieldLabel>Lot Code</FieldLabel>
                  <MerninInput
                    id="lot_code"
                    value={formData.lot_code}
                    onChange={(e) =>
                      setFormData({ ...formData, lot_code: e.target.value })
                    }
                    placeholder="12345"
                  />
                </div>
                <div>
                  <FieldLabel>Supplier</FieldLabel>
                  <MerninInput
                    id="supplier"
                    value={formData.supplier}
                    onChange={(e) =>
                      setFormData({ ...formData, supplier: e.target.value })
                    }
                    placeholder="Supplier Name"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <FieldLabel>Price per lb ($) *</FieldLabel>
                  <MerninInput
                    id="price_per_lb"
                    type="number"
                    step="0.01"
                    value={formData.price_per_lb}
                    onChange={(e) =>
                      setFormData({ ...formData, price_per_lb: e.target.value })
                    }
                    placeholder="6.50"
                  />
                </div>
                <div>
                  <FieldLabel>Initial Qty (lbs) *</FieldLabel>
                  <MerninInput
                    id="quantity_lbs"
                    type="number"
                    step="0.01"
                    value={formData.quantity_lbs}
                    onChange={(e) =>
                      setFormData({ ...formData, quantity_lbs: e.target.value })
                    }
                    placeholder="50"
                  />
                </div>
                <div>
                  <FieldLabel>Purchase Date</FieldLabel>
                  <MerninInput
                    id="purchase_date"
                    type="date"
                    value={formData.purchase_date}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        purchase_date: e.target.value,
                      })
                    }
                  />
                </div>
              </div>
              <div>
                <FieldLabel>Notes</FieldLabel>
                <MerninTextarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData({ ...formData, notes: e.target.value })
                  }
                  placeholder="Tasting notes, supplier info, etc."
                  rows={3}
                />
              </div>
            </div>

            {/* Dialog footer */}
            <div className="bg-cream border-t-[3px] border-espresso px-6 py-4 flex justify-end gap-2">
              <Btn
                variant="outline"
                onClick={() => {
                  setIsAddDialogOpen(false);
                  resetForm();
                }}
              >
                Cancel
              </Btn>
              <Btn
                onClick={handleAddOrEdit}
                disabled={
                  isSubmitting ||
                  !formData.name ||
                  !formData.origin ||
                  !formData.price_per_lb ||
                  (!editingCoffee && !formData.quantity_lbs)
                }
              >
                {isSubmitting
                  ? "Saving..."
                  : editingCoffee
                  ? "Save Changes"
                  : "Add Coffee"}
              </Btn>
            </div>
          </DialogContent>
        </Dialog>
  );
}

type LotFormDialogProps = Parameters<typeof LotFormDialog>[0];

export function AdjustStockDialog({
  isAdjustDialogOpen,
  setIsAdjustDialogOpen,
  adjustingCoffee,
  adjustmentData,
  setAdjustmentData,
  isSubmitting,
  handleAdjustQuantity,
}: {
  isAdjustDialogOpen: boolean;
  setIsAdjustDialogOpen: (open: boolean) => void;
  adjustingCoffee: CoffeeInventory | null;
  adjustmentData: {
    change_type: "manual_green_adjust" | "roast_deduct" | "sale_deduct";
    quantity: string;
    notes: string;
  };
  setAdjustmentData: (data: AdjustStockDialogProps["adjustmentData"]) => void;
  isSubmitting: boolean;
  handleAdjustQuantity: () => void;
}) {
  return (
      <Dialog open={isAdjustDialogOpen} onOpenChange={setIsAdjustDialogOpen}>
        <DialogContent data-testid="adjust-dialog" className="max-w-md p-0 gap-0 border-[3px] border-espresso rounded-[16px] overflow-hidden bg-chalk shadow-flat-lg">
          <div className="bg-cream border-b-[3px] border-espresso px-6 py-4">
            <DialogHeader>
              <DialogTitle className="font-extrabold text-[15px] uppercase tracking-[.08em] text-espresso">
                Adjust: {adjustingCoffee?.name}
              </DialogTitle>
            </DialogHeader>
          </div>

          <div className="px-6 py-5 space-y-4">
            <div>
              <FieldLabel>Adjustment Type</FieldLabel>
              <Select
                value={adjustmentData.change_type}
                onValueChange={(value) =>
                  setAdjustmentData({
                    ...adjustmentData,
                    change_type: value as typeof adjustmentData.change_type,
                  })
                }
              >
                <SelectTrigger className="border-[2.5px] border-espresso bg-cream rounded-[10px] shadow-[3px_3px_0_#1C0F05] focus:ring-0 focus:border-tomato">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual_green_adjust">
                    <div className="flex items-center gap-2">
                      <Scale size={14} strokeWidth={2.2} className="text-espresso/60" />
                      Manual Adjustment (+/-)
                    </div>
                  </SelectItem>
                  <SelectItem value="roast_deduct">
                    <div className="flex items-center gap-2">
                      <TrendingDown size={14} strokeWidth={2.2} className="text-honey" />
                      Roast (Deduct Stock)
                    </div>
                  </SelectItem>
                  <SelectItem value="sale_deduct">
                    <div className="flex items-center gap-2">
                      <TrendingDown size={14} strokeWidth={2.2} className="text-tomato" />
                      Sale (Deduct Stock)
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <FieldLabel>Quantity (lbs)</FieldLabel>
              <MerninInput
                id="adjust_quantity"
                type="number"
                step="0.01"
                value={adjustmentData.quantity}
                onChange={(e) =>
                  setAdjustmentData({ ...adjustmentData, quantity: e.target.value })
                }
                placeholder="Enter amount"
              />
              {adjustmentData.quantity && (
                <p className="mt-1.5 text-[11px] font-medium text-espresso/60">
                  Current:{" "}
                  {gramsToLbs(
                    adjustingCoffee?.current_green_quantity_g || 0
                  ).toFixed(1)}{" "}
                  lbs →{" "}
                  <span className="font-extrabold text-espresso">
                    {adjustmentData.change_type === "manual_green_adjust"
                      ? (
                          gramsToLbs(
                            adjustingCoffee?.current_green_quantity_g || 0
                          ) + (parseFloat(adjustmentData.quantity) || 0)
                        ).toFixed(1)
                      : (
                          gramsToLbs(
                            adjustingCoffee?.current_green_quantity_g || 0
                          ) - Math.abs(parseFloat(adjustmentData.quantity) || 0)
                        ).toFixed(1)}{" "}
                    lbs
                  </span>{" "}
                  after adjustment
                </p>
              )}
            </div>

            <div>
              <FieldLabel>Notes (optional)</FieldLabel>
              <MerninTextarea
                id="adjust_notes"
                value={adjustmentData.notes}
                onChange={(e) =>
                  setAdjustmentData({ ...adjustmentData, notes: e.target.value })
                }
                placeholder="Reason for adjustment..."
                rows={2}
              />
            </div>
          </div>

          <div className="bg-cream border-t-[3px] border-espresso px-6 py-4 flex justify-end gap-2">
            <Btn
              variant="outline"
              onClick={() => setIsAdjustDialogOpen(false)}
            >
              Cancel
            </Btn>
            <Btn
              onClick={handleAdjustQuantity}
              disabled={isSubmitting || !adjustmentData.quantity}
            >
              {isSubmitting ? "Saving..." : "Apply Adjustment"}
            </Btn>
          </div>
        </DialogContent>
      </Dialog>
  );
}

type AdjustStockDialogProps = Parameters<typeof AdjustStockDialog>[0];

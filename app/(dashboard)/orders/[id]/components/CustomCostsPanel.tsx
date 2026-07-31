"use client";

import { Plus, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Btn, FieldLabel, MerninInput, Panel } from "./primitives";
import type { Order } from "./types";

/** One-off charges against this order. Moved byte-for-byte (Stage A). */
export function CustomCostsPanel({
  isAddCostOpen,
  setIsAddCostOpen,
  newCostDescription,
  setNewCostDescription,
  newCostAmount,
  setNewCostAmount,
  handleAddCustomCost,
  isPending,
  order,
  setDeleteCostId,
}: {
  isAddCostOpen: boolean;
  setIsAddCostOpen: (v: boolean) => void;
  newCostDescription: string;
  setNewCostDescription: (v: string) => void;
  newCostAmount: string;
  setNewCostAmount: (v: string) => void;
  handleAddCustomCost: () => void;
  isPending: boolean;
  order: Order;
  setDeleteCostId: (id: string | null) => void;
}) {
  return (
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

  );
}

"use client";

import { Plus, Trash2 } from "lucide-react";
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
import { Btn, FieldLabel, MerninInput, Panel } from "./primitives";
import type { Component, Order } from "./types";

/** Packaging and per-order materials. Moved byte-for-byte (Stage A). */
export function ComponentsPanel({
  isAddComponentOpen,
  setIsAddComponentOpen,
  components,
  selectedComponentId,
  setSelectedComponentId,
  componentQuantity,
  setComponentQuantity,
  handleAddComponent,
  isPending,
  order,
  setDeleteComponentId,
}: {
  isAddComponentOpen: boolean;
  setIsAddComponentOpen: (v: boolean) => void;
  components: Component[];
  selectedComponentId: string;
  setSelectedComponentId: (v: string) => void;
  componentQuantity: string;
  setComponentQuantity: (v: string) => void;
  handleAddComponent: () => void;
  isPending: boolean;
  order: Order;
  setDeleteComponentId: (id: string | null) => void;
}) {
  return (
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

  );
}

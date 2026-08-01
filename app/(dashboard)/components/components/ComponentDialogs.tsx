"use client";

/**
 * The create/edit dialog and the delete confirm.
 *
 * CoffeeOS#73 Stage A: lifted out of components-client.tsx with every class
 * string unchanged. Stage B retokenizes these onto Instrument; Stage C adds the
 * usage counts to the delete confirm.
 *
 * Radix stays through both. Instrument's own Modal may not render
 * `role="dialog"`, which is what the capability specs drive against — verify
 * against the built @merninos/ui/instrument package before ever swapping it.
 */

import React from "react";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2 } from "lucide-react";
import { Btn, FieldLabel, MerninInput, MerninTextarea } from "./LoudPrimitives";
import {
  COMPONENT_TYPES,
  UNITS,
  type Component,
  type ComponentFormData,
} from "./types";

export function ComponentFormDialog({
  open,
  onOpenChange,
  editingComponent,
  formData,
  setFormData,
  isLoading,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingComponent: Component | null;
  formData: ComponentFormData;
  setFormData: (data: ComponentFormData) => void;
  isLoading: boolean;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 gap-0 border-[3px] border-espresso rounded-[16px] overflow-hidden bg-chalk shadow-[8px_8px_0_#1C0F05]">
        <div className="bg-cream border-b-[3px] border-espresso px-6 py-4">
          <DialogHeader>
            <DialogTitle className="font-body font-extrabold uppercase tracking-widest text-espresso text-sm">
              {editingComponent ? "Edit Component" : "New Component"}
            </DialogTitle>
          </DialogHeader>
        </div>
        <form onSubmit={onSubmit}>
          <div className="px-6 py-5 space-y-4">
            <div>
              <FieldLabel htmlFor="name">Name</FieldLabel>
              <MerninInput
                id="name"
                placeholder="e.g., 12oz Kraft Bag"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <FieldLabel htmlFor="category">Type</FieldLabel>
                <Select
                  value={formData.category}
                  onValueChange={(v) => setFormData({ ...formData, category: v })}
                  required
                >
                  <SelectTrigger className="border-[2.5px] border-espresso rounded-xl bg-chalk shadow-[3px_3px_0_#1C0F05] font-body text-sm">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {COMPONENT_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <FieldLabel htmlFor="unit">Unit</FieldLabel>
                <Select
                  value={formData.unit}
                  onValueChange={(v) => setFormData({ ...formData, unit: v })}
                  required
                >
                  <SelectTrigger className="border-[2.5px] border-espresso rounded-xl bg-chalk shadow-[3px_3px_0_#1C0F05] font-body text-sm">
                    <SelectValue placeholder="Select unit" />
                  </SelectTrigger>
                  <SelectContent>
                    {UNITS.map((u) => (
                      <SelectItem key={u} value={u}>
                        {u}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <FieldLabel htmlFor="costPerUnit">Cost per Unit ($)</FieldLabel>
              <MerninInput
                id="costPerUnit"
                type="number"
                step="0.00000001"
                min="0"
                placeholder="0.00"
                value={formData.costPerUnit}
                onChange={(e) => setFormData({ ...formData, costPerUnit: e.target.value })}
                required
              />
            </div>
            <div>
              <FieldLabel htmlFor="description">Description (optional)</FieldLabel>
              <MerninTextarea
                id="description"
                placeholder="Additional details about this component"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={2}
              />
            </div>
          </div>
          <div className="bg-cream border-t-[3px] border-espresso px-6 py-4 flex justify-end gap-2">
            <Btn
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Btn>
            <Btn type="submit" disabled={isLoading}>
              {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              {editingComponent ? "Save Changes" : "Create"}
            </Btn>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteComponentDialog({
  open,
  onOpenChange,
  isLoading,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: () => void;
  isLoading: boolean;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-sm p-0 gap-0 border-[3px] border-espresso rounded-[16px] overflow-hidden bg-chalk shadow-[8px_8px_0_#1C0F05]">
        <div className="bg-cream border-b-[3px] border-espresso px-6 py-4">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-body font-extrabold uppercase tracking-widest text-espresso text-sm">
              Delete Component
            </AlertDialogTitle>
            <AlertDialogDescription className="font-body text-sm text-espresso/60 mt-1">
              This can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
        </div>
        <AlertDialogFooter className="px-6 py-4 flex justify-end gap-2">
          <AlertDialogCancel
            disabled={isLoading}
            className="inline-flex items-center justify-center font-body font-extrabold uppercase tracking-widest text-[0.7rem] px-4 py-2 bg-transparent text-espresso border-[2.5px] border-espresso rounded-full shadow-[3px_3px_0_#1C0F05] hover:bg-espresso hover:text-cream transition-all cursor-pointer"
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isLoading}
            className="inline-flex items-center justify-center gap-1.5 font-body font-extrabold uppercase tracking-widest text-[0.7rem] px-4 py-2 bg-tomato text-cream border-[2.5px] border-espresso rounded-full shadow-[3px_3px_0_#1C0F05] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_#1C0F05] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer"
          >
            {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

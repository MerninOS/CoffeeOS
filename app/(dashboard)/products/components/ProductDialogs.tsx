"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { Loader2, Plus } from "lucide-react";
import { Btn, MerninInput, MerninTextarea, FieldLabel } from "./primitives";

export interface NewProduct {
  title: string;
  description: string;
  sku: string;
  price: string;
}

/**
 * The two dialogs, moved out of products-client.tsx unchanged (CoffeeOS#69
 * Stage A). Both are Radix, and both portal to <body> — outside
 * [data-surface="app"] — so Stage B must set data-surface on the content roots
 * or every instrument token inside resolves to nothing (Criterion 22).
 *
 * Kept as Radix rather than instrument's Modal in Stage B: instrument's Modal
 * renders no role="dialog", which these need to stay driveable from tests.
 */

export function AddProductDialog({
  open,
  onOpenChange,
  value,
  onChange,
  onCreate,
  isCreating,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: NewProduct;
  onChange: (next: NewProduct) => void;
  onCreate: () => void;
  isCreating: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Btn variant="outline" size="sm">
          <Plus size={14} strokeWidth={2.5} />
          <span className="hidden sm:inline">Add Product</span>
          <span className="sm:hidden">Add</span>
        </Btn>
      </DialogTrigger>
      <DialogContent className="border-[3px] border-espresso rounded-[20px] shadow-flat-lg bg-chalk p-0 overflow-hidden gap-0">
        <DialogHeader className="px-6 py-5 border-b-[3px] border-espresso bg-cream">
          <DialogTitle className="font-extrabold text-[18px] uppercase tracking-[.06em] text-espresso">
            Add New Product
          </DialogTitle>
          <DialogDescription className="text-[13px] text-muted-foreground mt-0.5">
            Create a product manually without Shopify
          </DialogDescription>
        </DialogHeader>
        <div className="px-6 py-5 flex flex-col gap-4">
          <div>
            <FieldLabel htmlFor="title">Product Title *</FieldLabel>
            <MerninInput
              id="title"
              value={value.title}
              onChange={(e) => onChange({ ...value, title: e.target.value })}
              placeholder="e.g., Ethiopia Yirgacheffe 12oz"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <FieldLabel htmlFor="sku">SKU</FieldLabel>
              <MerninInput
                id="sku"
                value={value.sku}
                onChange={(e) => onChange({ ...value, sku: e.target.value })}
                placeholder="COFFEE-ETH-12"
              />
            </div>
            <div>
              <FieldLabel htmlFor="price">Selling Price ($) *</FieldLabel>
              <MerninInput
                id="price"
                type="number"
                step="0.01"
                value={value.price}
                onChange={(e) => onChange({ ...value, price: e.target.value })}
                placeholder="18.00"
              />
            </div>
          </div>
          <div>
            <FieldLabel htmlFor="description">Description</FieldLabel>
            <MerninTextarea
              id="description"
              value={value.description}
              onChange={(e) => onChange({ ...value, description: e.target.value })}
              placeholder="Product description..."
              rows={3}
            />
          </div>
        </div>
        <DialogFooter className="px-6 py-4 border-t-[3px] border-espresso bg-cream flex gap-2">
          <Btn variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Btn>
          <Btn size="sm" onClick={onCreate} disabled={isCreating || !value.title || !value.price}>
            {isCreating && <Loader2 size={13} className="animate-spin" />}
            Create Product
          </Btn>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteProductDialog({
  open,
  onOpenChange,
  onConfirm,
  isDeleting,
}: {
  open: boolean;
  onOpenChange: () => void;
  onConfirm: () => void;
  isDeleting: boolean;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="border-[3px] border-espresso rounded-[20px] shadow-flat-lg bg-chalk p-0 overflow-hidden gap-0">
        <AlertDialogHeader className="px-6 py-5 border-b-[3px] border-espresso bg-cream">
          <AlertDialogTitle className="font-extrabold text-[18px] uppercase tracking-[.06em] text-espresso">
            Delete Product
          </AlertDialogTitle>
          <AlertDialogDescription className="text-[13px] text-muted-foreground mt-0.5">
            This can&apos;t be undone. All associated COGS data will be removed.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="px-6 py-4 border-t-[3px] border-espresso bg-cream flex gap-2">
          <AlertDialogCancel
            disabled={isDeleting}
            className="inline-flex items-center gap-2 font-extrabold uppercase tracking-[.08em] rounded-full h-[30px] px-3.5 text-[11px] bg-transparent text-espresso border-[2.5px] border-espresso shadow-[3px_3px_0_#1C0F05] hover:-translate-x-[1.5px] hover:-translate-y-[1.5px] hover:shadow-[4px_4px_0_#1C0F05] transition-all duration-100"
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isDeleting}
            className="inline-flex items-center gap-2 font-extrabold uppercase tracking-[.08em] rounded-full h-[30px] px-3.5 text-[11px] bg-tomato text-cream border-[2.5px] border-espresso shadow-[3px_3px_0_#1C0F05] hover:-translate-x-[1.5px] hover:-translate-y-[1.5px] active:translate-x-[2.5px] active:translate-y-[2.5px] active:shadow-none transition-all duration-100"
          >
            {isDeleting && <Loader2 size={13} className="animate-spin" />}
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

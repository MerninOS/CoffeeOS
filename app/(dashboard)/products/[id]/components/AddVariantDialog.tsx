"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DollarSign, Loader2 } from "lucide-react";
import { Btn, FieldLabel, MerninInput } from "./primitives";
import type { ProductVariant, SelectedComponent } from "./types";

/**
 * The add-variant dialog, moved out of product-detail-client.tsx unchanged
 * (CoffeeOS#69 Stage A). Radix, and it portals to <body> — outside
 * [data-surface="app"] — so Stage B must set data-surface on the content root or
 * every instrument token inside resolves to nothing (Criterion 22), exactly as
 * noted for the list page's dialogs in ../../components/ProductDialogs.tsx.
 *
 * Note there is no DialogTrigger here: the parent opens this from the Variants
 * panel's action button, which lives in a different subtree. That is why `open`
 * and `onOpenChange` are props rather than the trigger pattern the list page uses.
 *
 * Preserved as-is:
 *  - `defaultSelectedComponents` is passed in whole only to test `.length > 0`
 *    for whether the "Current product COGS" option appears — kept as the array
 *    rather than a boolean so the JSX condition is character-for-character
 *  - the "Copy COGS From" select offers every variant including ones created
 *    moments ago in this same dialog
 *  - Add Variant is disabled only on `isAddingVariant`, not on an empty title,
 *    so the required-field error surfaces as a toast after the click
 */
export function AddVariantDialog({
  open,
  onOpenChange,
  newVariantTitle,
  onNewVariantTitleChange,
  newVariantSku,
  onNewVariantSkuChange,
  newVariantPrice,
  onNewVariantPriceChange,
  newVariantCopySource,
  onNewVariantCopySourceChange,
  defaultSelectedComponents,
  variants,
  onAddVariant,
  isAddingVariant,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  newVariantTitle: string;
  onNewVariantTitleChange: (value: string) => void;
  newVariantSku: string;
  onNewVariantSkuChange: (value: string) => void;
  newVariantPrice: string;
  onNewVariantPriceChange: (value: string) => void;
  newVariantCopySource: string;
  onNewVariantCopySourceChange: (value: string) => void;
  defaultSelectedComponents: SelectedComponent[];
  variants: ProductVariant[];
  onAddVariant: () => void;
  isAddingVariant: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-[3px] border-espresso rounded-[20px] shadow-flat-lg bg-chalk p-0 overflow-hidden gap-0">
        <DialogHeader className="px-6 py-5 border-b-[3px] border-espresso bg-cream">
          <DialogTitle className="font-extrabold text-[18px] uppercase tracking-[.06em] text-espresso">Add Variant</DialogTitle>
          <DialogDescription className="text-[13px] text-muted-foreground mt-0.5">
            Create a new variant and optionally copy COGS from an existing source.
          </DialogDescription>
        </DialogHeader>
        <div className="px-6 py-5 flex flex-col gap-4">
          <div>
            <FieldLabel htmlFor="new-variant-title">Variant Title *</FieldLabel>
            <MerninInput id="new-variant-title" placeholder="e.g. 12oz Bag" value={newVariantTitle} onChange={(e) => onNewVariantTitleChange(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <FieldLabel htmlFor="new-variant-sku">SKU (optional)</FieldLabel>
              <MerninInput id="new-variant-sku" placeholder="SKU" value={newVariantSku} onChange={(e) => onNewVariantSkuChange(e.target.value)} />
            </div>
            <div>
              <FieldLabel htmlFor="new-variant-price">Price (optional)</FieldLabel>
              <MerninInput id="new-variant-price" type="number" step="0.01" min="0" placeholder="0.00" value={newVariantPrice} onChange={(e) => onNewVariantPriceChange(e.target.value)} prefix={<DollarSign size={15} strokeWidth={2} />} />
            </div>
          </div>
          <div>
            <FieldLabel>Copy COGS From</FieldLabel>
            <Select value={newVariantCopySource} onValueChange={onNewVariantCopySourceChange}>
              <SelectTrigger className="border-[2.5px] border-espresso rounded-[10px] h-10 text-[13px] font-bold shadow-[3px_3px_0_#1C0F05]">
                <SelectValue placeholder="Copy COGS from..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Don&apos;t copy COGS</SelectItem>
                {defaultSelectedComponents.length > 0 && <SelectItem value="product">Current product COGS</SelectItem>}
                {variants.map((v) => <SelectItem key={`copy-${v.id}`} value={`variant:${v.id}`}>Variant: {v.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter className="px-6 py-4 border-t-[3px] border-espresso bg-cream flex gap-2">
          <Btn variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={isAddingVariant}>Cancel</Btn>
          <Btn size="sm" onClick={onAddVariant} disabled={isAddingVariant}>
            {isAddingVariant && <Loader2 size={13} className="animate-spin" />}
            Add Variant
          </Btn>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

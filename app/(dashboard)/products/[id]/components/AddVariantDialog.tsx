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
import { Button, Field, Input } from "@merninos/ui/instrument";
import { Loader2 } from "lucide-react";
import { mono, sans } from "@/lib/instrument/tokens";
import { SELECT_CONTENT, SELECT_ITEM, SELECT_TRIGGER } from "./selectStyles";
import type { ProductVariant, SelectedComponent } from "./types";

/**
 * The add-variant dialog, retokenized onto instrument (CoffeeOS#69 Stage B).
 * Same fields, same handlers, same disabled logic.
 *
 * `data-surface="app"` ON THE CONTENT ROOTS IS LOAD-BEARING, not defensive:
 * Radix portals both the dialog and the select listbox to <body>, i.e. OUTSIDE
 * the AppShell subtree that scopes the instrument token layer, so without it
 * every `var(--token)` inside resolves to nothing and the dialog renders
 * unstyled (Criterion 22).
 *
 * Radix is kept rather than instrument's `Modal`, which renders no
 * `role="dialog"` and so cannot be driven from a test.
 *
 * There is no DialogTrigger here: the parent opens this from the Variants
 * section's action button, which lives in a different subtree.
 *
 * Preserved as-is:
 *  - `defaultSelectedComponents` is passed in whole only to test `.length > 0`
 *    for whether the "Current product recipe" option appears
 *  - "Copy recipe from" offers every variant, including ones created moments ago
 *  - Add variant is disabled only on `isAddingVariant`, not on an empty title,
 *    so the required-field error surfaces as a toast after the click
 */

const PANEL: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--hairline)",
  borderRadius: "var(--r-lg)",
  boxShadow: "var(--shadow-modal)",
  padding: 0,
  overflow: "hidden",
  gap: 0,
};

const HEAD: React.CSSProperties = {
  padding: "var(--space-5) var(--space-6)",
  borderBottom: "1px solid var(--hairline)",
  background: "var(--surface-sunken)",
};

const FOOT: React.CSSProperties = {
  padding: "var(--space-4) var(--space-6)",
  borderTop: "1px solid var(--hairline)",
  background: "var(--surface-sunken)",
  display: "flex",
  gap: 8,
  justifyContent: "flex-end",
};

const TITLE: React.CSSProperties = {
  fontFamily: "var(--font-display)",
  fontVariationSettings: "var(--display-settings)",
  fontWeight: "var(--display-weight)" as unknown as number,
  letterSpacing: "var(--display-tracking)",
  fontSize: "var(--fs-title)",
  textTransform: "uppercase",
  color: "var(--ink)",
};

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
      <DialogContent data-surface="app" style={PANEL}>
        <DialogHeader style={HEAD}>
          <DialogTitle style={TITLE}>Add variant</DialogTitle>
          <DialogDescription
            style={{ ...sans, fontSize: "var(--fs-caption)", color: "var(--ink-muted)", marginTop: 4 }}
          >
            Create a variant and optionally copy an existing recipe onto it.
          </DialogDescription>
        </DialogHeader>

        <div
          style={{
            padding: "var(--space-5) var(--space-6)",
            display: "flex",
            flexDirection: "column",
            gap: "var(--gap-stack)",
          }}
        >
          <Field label="Variant title" htmlFor="new-variant-title" required>
            <Input
              id="new-variant-title"
              value={newVariantTitle}
              onChange={(e) => onNewVariantTitleChange(e.target.value)}
              placeholder="12oz Bag"
            />
          </Field>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--gap-stack)" }}>
            <Field label="SKU" htmlFor="new-variant-sku" optional>
              <Input
                id="new-variant-sku"
                mono
                value={newVariantSku}
                onChange={(e) => onNewVariantSkuChange(e.target.value)}
                placeholder="ETH-YIR-12"
              />
            </Field>
            <Field label="Price" htmlFor="new-variant-price" optional>
              <Input
                id="new-variant-price"
                mono
                type="number"
                step="0.01"
                min="0"
                value={newVariantPrice}
                onChange={(e) => onNewVariantPriceChange(e.target.value)}
                placeholder="0.00"
                leading={<span style={{ ...mono, fontSize: "var(--fs-body)" }}>$</span>}
              />
            </Field>
          </div>

          <Field label="Copy recipe from" htmlFor="new-variant-copy-source">
            <Select value={newVariantCopySource} onValueChange={onNewVariantCopySourceChange}>
              <SelectTrigger id="new-variant-copy-source" style={{ ...SELECT_TRIGGER, height: 34 }}>
                <SelectValue placeholder="Copy recipe from…" />
              </SelectTrigger>
              <SelectContent data-surface="app" style={SELECT_CONTENT}>
                <SelectItem value="none" style={SELECT_ITEM}>
                  Start empty
                </SelectItem>
                {defaultSelectedComponents.length > 0 && (
                  <SelectItem value="product" style={SELECT_ITEM}>
                    Current product recipe
                  </SelectItem>
                )}
                {variants.map((v) => (
                  <SelectItem key={`copy-${v.id}`} value={`variant:${v.id}`} style={SELECT_ITEM}>
                    Variant: {v.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <DialogFooter style={FOOT}>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isAddingVariant}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={onAddVariant}
            disabled={isAddingVariant}
            iconLeft={isAddingVariant ? <Loader2 size={13} className="animate-spin" /> : undefined}
          >
            Add variant
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

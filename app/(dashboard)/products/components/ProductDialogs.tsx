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
import { Button, Field, Input, Textarea } from "@merninos/ui/instrument";
import { sans } from "@/lib/instrument/tokens";

export interface NewProduct {
  title: string;
  description: string;
  sku: string;
  price: string;
}

/**
 * Both dialogs, on instrument (CoffeeOS#69 Stage B).
 *
 * `data-surface="app"` ON THE CONTENT ROOTS IS LOAD-BEARING, not defensive.
 * Radix portals these to <body>, i.e. OUTSIDE the AppShell subtree that scopes
 * the instrument token layer — so without it every `var(--token)` inside
 * resolves to nothing and the dialog renders unstyled. It cost real time to find
 * on /orders; Criterion 22 asserts it here.
 *
 * Radix is kept rather than instrument's Modal on purpose: instrument's Modal
 * renders no `role="dialog"`, so it cannot be driven from a test.
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

export function AddProductDialog({
  open,
  onOpenChange,
  value,
  onChange,
  onCreate,
  isCreating,
  trigger,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: NewProduct;
  onChange: (next: NewProduct) => void;
  onCreate: () => void;
  isCreating: boolean;
  trigger: React.ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent data-surface="app" style={PANEL}>
        <DialogHeader style={HEAD}>
          <DialogTitle style={TITLE}>Add product</DialogTitle>
          <DialogDescription
            style={{ ...sans, fontSize: "var(--fs-caption)", color: "var(--ink-muted)", marginTop: 4 }}
          >
            Create a product by hand, without Shopify.
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
          <Field label="Product title" htmlFor="title" required>
            <Input
              id="title"
              value={value.title}
              onChange={(e) => onChange({ ...value, title: e.target.value })}
              placeholder="Ethiopia Yirgacheffe 12oz"
            />
          </Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--gap-stack)" }}>
            <Field label="SKU" htmlFor="sku" optional>
              <Input
                id="sku"
                mono
                value={value.sku}
                onChange={(e) => onChange({ ...value, sku: e.target.value })}
                placeholder="ETH-YIR-12"
              />
            </Field>
            <Field label="Selling price" htmlFor="price" required>
              <Input
                id="price"
                mono
                type="number"
                step="0.01"
                value={value.price}
                onChange={(e) => onChange({ ...value, price: e.target.value })}
                placeholder="18.00"
              />
            </Field>
          </div>
          <Field label="Description" htmlFor="description" optional>
            <Textarea
              id="description"
              rows={3}
              value={value.description}
              onChange={(e) => onChange({ ...value, description: e.target.value })}
              placeholder="Floral and citrus-forward single origin."
            />
          </Field>
        </div>
        <DialogFooter style={FOOT}>
          <Button variant="secondary" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={onCreate}
            disabled={isCreating || !value.title || !value.price}
          >
            {isCreating ? "Creating…" : "Create product"}
          </Button>
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
      <AlertDialogContent data-surface="app" style={PANEL}>
        <AlertDialogHeader style={HEAD}>
          <AlertDialogTitle style={TITLE}>Delete product</AlertDialogTitle>
          <AlertDialogDescription
            style={{ ...sans, fontSize: "var(--fs-caption)", color: "var(--ink-muted)", marginTop: 4 }}
          >
            This can&apos;t be undone. Its recipe and COGS data go with it.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter style={FOOT}>
          {/* Destructive fill is `--danger`, NOT `--brand`. Brand red is the live
              register on this system and never fills a control (Criterion 6);
              --danger is deliberately a darker, desaturated red so the two do not
              read as the same signal. */}
          <AlertDialogCancel disabled={isDeleting} asChild>
            <Button variant="secondary" size="sm">
              Cancel
            </Button>
          </AlertDialogCancel>
          <AlertDialogAction disabled={isDeleting} onClick={onConfirm} asChild>
            <Button variant="destructive" size="sm">
              {isDeleting ? "Deleting…" : "Delete product"}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

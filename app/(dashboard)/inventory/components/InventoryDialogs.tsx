"use client";

import {
  Dialog,
  DialogContent,
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
import { Button, Field, InlineBanner, Input, Select, Textarea } from "@merninos/ui/instrument";
import { Plus } from "lucide-react";
import { mono, overline, sans } from "@/lib/instrument/tokens";
import { gramsToLbs } from "@/lib/inventory/units";
import type { CoffeeInventory } from "./types";

/**
 * The green-inventory dialogs, on instrument (CoffeeOS#72 Stage 4).
 *
 * `data-surface="app"` ON EVERY PORTALLED CONTENT ROOT IS LOAD-BEARING, not
 * defensive. Radix portals these to <body>, i.e. OUTSIDE the AppShell subtree
 * that scopes the instrument token layer — so without it every `var(--token)`
 * inside resolves to nothing and the dialog renders unstyled. It cost real time
 * to find on /orders, /products asserts it, and spec Criterion 4 asserts it here.
 *
 * RADIX IS KEPT rather than instrument's `Modal`: that Modal renders no
 * `role="dialog"`, so it cannot be driven from a test — and these dialogs are
 * exactly what the Stage 1 capability tests drive to prove the conversion
 * preserved behaviour. Same call /products documented.
 *
 * instrument's `Select` IS used here, unlike on /orders. It is a native
 * <select>, which failed there because the options needed icons and two-column
 * layout; the three adjustment reasons are plain text, so the native control is
 * sufficient and one Radix dependency drops.
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

const BODY: React.CSSProperties = {
  padding: "var(--space-5) var(--space-6)",
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-4)",
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

export interface LotFormValues {
  name: string;
  origin: string;
  lot_code: string;
  supplier: string;
  price_per_lb: string;
  quantity_lbs: string;
  purchase_date: string;
  notes: string;
}

export function LotFormDialog({
  open,
  onOpenChange,
  editingCoffee,
  values,
  onChange,
  error,
  isSubmitting,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingCoffee: CoffeeInventory | null;
  values: LotFormValues;
  onChange: (next: LotFormValues) => void;
  error: string | null;
  isSubmitting: boolean;
  onSubmit: () => void;
}) {
  const set = (patch: Partial<LotFormValues>) => onChange({ ...values, ...patch });
  const editing = !!editingCoffee;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        {/* Primary action fills `--action` (ink), never `--brand`. Red is the
            live register on this system and never fills a control. */}
        <Button variant="primary" iconLeft={<Plus size={14} strokeWidth={1.5} />}>
          Add coffee
        </Button>
      </DialogTrigger>
      <DialogContent
        data-surface="app"
        data-testid="lot-form-dialog"
        style={{ ...PANEL, maxWidth: 680 }}
      >
        <DialogHeader style={HEAD}>
          <DialogTitle style={TITLE}>{editing ? "Edit lot" : "Add lot"}</DialogTitle>
        </DialogHeader>

        <div style={BODY}>
          {/* Server errors render HERE, in the open dialog with the operator's
              input intact — not in a window.alert that discards the context
              (Criterion 18). */}
          {error && <InlineBanner tone="danger" title={error} />}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Name" required>
              <Input
                id="name"
                value={values.name}
                onChange={(e) => set({ name: e.target.value })}
                placeholder="Ethiopia Yirgacheffe"
              />
            </Field>
            <Field label="Origin" required>
              <Input
                id="origin"
                value={values.origin}
                onChange={(e) => set({ origin: e.target.value })}
                placeholder="Ethiopia"
              />
            </Field>
            <Field label="Lot code" help="Must be unique across green inventory.">
              <Input
                id="lot_code"
                mono
                value={values.lot_code}
                onChange={(e) => set({ lot_code: e.target.value })}
                placeholder="LOT-2416"
              />
            </Field>
            <Field label="Supplier">
              <Input
                id="supplier"
                value={values.supplier}
                onChange={(e) => set({ supplier: e.target.value })}
                placeholder="Cafe Imports"
              />
            </Field>
            <Field label="Cost" required help="Per pound.">
              <Input
                id="price_per_lb"
                mono
                type="number"
                step="0.01"
                value={values.price_per_lb}
                onChange={(e) => set({ price_per_lb: e.target.value })}
                placeholder="6.50"
              />
            </Field>
            {/* Quantity is create-only: on an edit the figure is owned by the
                adjustment log, and letting it be typed over here would silently
                bypass the change row that explains where the coffee went. That
                is the existing behaviour, preserved. */}
            {!editing && (
              <Field label="Quantity" required help="Pounds received.">
                <Input
                  id="quantity_lbs"
                  mono
                  type="number"
                  step="0.01"
                  value={values.quantity_lbs}
                  onChange={(e) => set({ quantity_lbs: e.target.value })}
                  placeholder="50"
                />
              </Field>
            )}
            {!editing && (
              <Field label="Purchased">
                <Input
                  id="purchase_date"
                  mono
                  type="date"
                  value={values.purchase_date}
                  onChange={(e) => set({ purchase_date: e.target.value })}
                />
              </Field>
            )}
          </div>

          <Field label="Notes" optional>
            <Textarea
              id="notes"
              rows={3}
              value={values.notes}
              onChange={(e) => set({ notes: e.target.value })}
              placeholder="Cupping notes, contract, supplier detail"
            />
          </Field>
        </div>

        <div style={FOOT}>
          <Button variant="secondary" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={onSubmit}
            disabled={
              isSubmitting ||
              !values.name ||
              !values.origin ||
              !values.price_per_lb ||
              (!editing && !values.quantity_lbs)
            }
          >
            {isSubmitting ? "Saving…" : editing ? "Save changes" : "Add coffee"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export interface AdjustmentValues {
  change_type: "manual_green_adjust" | "roast_deduct" | "sale_deduct";
  quantity: string;
  notes: string;
}

export function AdjustStockDialog({
  open,
  onOpenChange,
  coffee,
  values,
  onChange,
  error,
  isSubmitting,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  coffee: CoffeeInventory | null;
  values: AdjustmentValues;
  onChange: (next: AdjustmentValues) => void;
  error: string | null;
  isSubmitting: boolean;
  onSubmit: () => void;
}) {
  const currentLbs = gramsToLbs(coffee?.current_green_quantity_g || 0);
  const entered = parseFloat(values.quantity) || 0;
  /* The sign inversion is the behaviour under test: anything that is not a
     manual adjust deducts, whatever sign the operator typed. */
  const afterLbs =
    values.change_type === "manual_green_adjust"
      ? currentLbs + entered
      : currentLbs - Math.abs(entered);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-surface="app"
        data-testid="adjust-dialog"
        style={{ ...PANEL, maxWidth: 460 }}
      >
        <DialogHeader style={HEAD}>
          <DialogTitle style={TITLE}>Adjust {coffee?.name}</DialogTitle>
        </DialogHeader>

        <div style={BODY}>
          {error && <InlineBanner tone="danger" title={error} />}

          <Field label="Reason">
            <Select
              value={values.change_type}
              onChange={(e) =>
                onChange({
                  ...values,
                  change_type: e.target.value as AdjustmentValues["change_type"],
                })
              }
            >
              <option value="manual_green_adjust">Manual adjust (+/−)</option>
              <option value="roast_deduct">Roast — deduct green</option>
              <option value="sale_deduct">Sale — deduct green</option>
            </Select>
          </Field>

          <Field
            label="Quantity"
            help="Pounds. Deductions are applied as a negative change."
          >
            <Input
              id="adjust_quantity"
              mono
              type="number"
              step="0.01"
              value={values.quantity}
              onChange={(e) => onChange({ ...values, quantity: e.target.value })}
              placeholder="0.0"
            />
          </Field>

          {coffee && values.quantity !== "" && (
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 10,
                padding: "12px 14px",
                background: "var(--surface-sunken)",
                borderRadius: "var(--r-md)",
              }}
            >
              <span style={{ ...mono, fontSize: "var(--fs-data)", color: "var(--ink-muted)" }}>
                {currentLbs.toFixed(1)} lbs
              </span>
              <span style={{ color: "var(--ink-subtle)" }}>→</span>
              <span
                style={{
                  ...mono,
                  fontSize: "var(--fs-h3)",
                  color: afterLbs < 0 ? "var(--danger)" : "var(--ink)",
                }}
              >
                {Math.max(afterLbs, 0).toFixed(1)} lbs
              </span>
              <span style={{ ...overline, marginLeft: "auto" }}>After</span>
            </div>
          )}

          {/* Told BEFORE submitting, not after the server refuses. The server
              guard stays authoritative — this only saves a round trip. */}
          {afterLbs < 0 && (
            <InlineBanner tone="danger" title="Not enough green in this lot.">
              {`Deducting ${values.quantity} lb would leave ${afterLbs.toFixed(1)} lb. `}
              Reduce the quantity or reconcile the lot first.
            </InlineBanner>
          )}

          <Field label="Notes" optional>
            <Textarea
              id="adjust_notes"
              rows={2}
              value={values.notes}
              onChange={(e) => onChange({ ...values, notes: e.target.value })}
              placeholder="Why this changed"
            />
          </Field>
        </div>

        <div style={FOOT}>
          <Button variant="secondary" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={onSubmit}
            disabled={isSubmitting || !values.quantity}
          >
            {isSubmitting ? "Saving…" : "Apply adjustment"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Deletion confirmed in a dialog rather than `window.confirm` (Criterion 19).
 *
 * Destructive fill is `--danger`, NOT `--brand`: brand red is the live register
 * and never fills a control, and `--danger` is deliberately darker and
 * desaturated so the two do not read as the same signal.
 */
export function DeleteLotDialog({
  open,
  onOpenChange,
  coffee,
  isDeleting,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  coffee: CoffeeInventory | null;
  isDeleting: boolean;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent data-surface="app" data-testid="delete-dialog" style={PANEL}>
        <AlertDialogHeader style={HEAD}>
          <AlertDialogTitle style={TITLE}>Delete lot</AlertDialogTitle>
          <AlertDialogDescription
            style={{
              ...sans,
              fontSize: "var(--fs-caption)",
              color: "var(--ink-muted)",
              marginTop: 4,
            }}
          >
            {coffee?.name} and its movement history go with it. This can&apos;t be
            undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter style={FOOT}>
          <AlertDialogCancel disabled={isDeleting} asChild>
            <Button variant="secondary" size="sm">
              Cancel
            </Button>
          </AlertDialogCancel>
          <AlertDialogAction disabled={isDeleting} onClick={onConfirm} asChild>
            <Button variant="destructive" size="sm">
              {isDeleting ? "Deleting…" : "Delete lot"}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

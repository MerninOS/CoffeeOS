"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { Button, Field, Input, Select, Textarea } from "@merninos/ui/instrument";
import { sans } from "@/lib/instrument/tokens";
import {
  COMPONENT_TYPES,
  UNITS,
  type Component,
  type ComponentFormData,
} from "./types";

/**
 * Both dialogs, on instrument (CoffeeOS#73 Stage B).
 *
 * `data-surface="app"` ON THE CONTENT ROOTS IS LOAD-BEARING, not defensive.
 * Radix portals these to <body>, i.e. OUTSIDE the AppShell subtree that scopes
 * the instrument token layer — so without it every `var(--token)` inside
 * resolves to nothing and the dialog renders unstyled. It cost real time to find
 * on /orders and /products asserts it as a criterion; the same assertion lives
 * in tests/unit/components-tokens.spec.ts here.
 *
 * Radix Dialog is kept rather than instrument's Modal on purpose: instrument's
 * Modal renders no `role="dialog"`, so it cannot be driven from a test.
 *
 * The two Selects DO move to instrument's — it is a native `<select>`, which is
 * the better control for a four-item list and needs no portal. That changes how
 * the capability spec DRIVES the form (`selectOption` rather than clicking a
 * Radix listbox) but not a single thing it ASSERTS. Drivers may follow the
 * markup; assertions may not, which is the whole point of writing them at A.5.
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

const BODY: React.CSSProperties = {
  padding: "var(--space-5) var(--space-6)",
  display: "flex",
  flexDirection: "column",
  gap: "var(--gap-stack)",
};

const CAPTION: React.CSSProperties = {
  ...sans,
  fontSize: "var(--fs-caption)",
  color: "var(--ink-muted)",
  marginTop: 4,
};

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
  const editing = !!editingComponent;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="component-dialog" data-surface="app" style={PANEL}>
        <DialogHeader style={HEAD}>
          <DialogTitle style={TITLE}>
            {editing ? "Edit component" : "New component"}
          </DialogTitle>
          <DialogDescription style={CAPTION}>
            {editing
              ? "Changes apply to every product recipe using this component."
              : "Components are the atoms of product cost. Every figure here feeds order margin."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit}>
          <div style={BODY}>
            <Field label="Name" htmlFor="name" required>
              <Input
                id="name"
                data-testid="field-name"
                placeholder="12oz Kraft Bag"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </Field>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "var(--gap-stack)",
              }}
            >
              <Field label="Type" htmlFor="category" required>
                <Select
                  id="category"
                  data-testid="field-type"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  required
                >
                  <option value="" disabled>
                    Select type
                  </option>
                  {COMPONENT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Unit" htmlFor="unit" required>
                <Select
                  id="unit"
                  data-testid="field-unit"
                  value={formData.unit}
                  onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                  required
                >
                  <option value="" disabled>
                    Select unit
                  </option>
                  {UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            {/* The help line is new. This dialog is the only place an uncosted
                component can be created, and the form gave no signal that 0 and
                "I don't know yet" are different claims — precisely the confusion
                the worksheet's `not set` rendering exists to undo. */}
            <Field
              label="Cost per unit"
              htmlFor="costPerUnit"
              required
              help="Full precision — the worksheet rounds for reading, this is the stored figure. A component left at 0 shows as “not set” until you price it."
            >
              <Input
                id="costPerUnit"
                data-testid="field-cost"
                type="number"
                step="0.00000001"
                min="0"
                mono
                placeholder="0.00"
                value={formData.costPerUnit}
                onChange={(e) =>
                  setFormData({ ...formData, costPerUnit: e.target.value })
                }
                required
              />
            </Field>

            <Field label="Notes" htmlFor="description" optional>
              <Textarea
                id="description"
                data-testid="field-notes"
                rows={2}
                placeholder="Supplier, lot, or anything the next person needs"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
              />
            </Field>
          </div>

          <DialogFooter style={FOOT}>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              data-testid="dialog-save"
              disabled={isLoading}
            >
              {isLoading ? "Saving…" : editing ? "Save changes" : "Add component"}
            </Button>
          </DialogFooter>
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
      <AlertDialogContent data-testid="delete-dialog" data-surface="app" style={PANEL}>
        <AlertDialogHeader style={HEAD}>
          <AlertDialogTitle style={TITLE}>Delete component</AlertDialogTitle>
          <AlertDialogDescription style={CAPTION}>
            This can&apos;t be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter style={FOOT}>
          {/* Destructive fill is `--danger`, NOT `--brand`. Brand red is the live
              register on this system and never fills a control; --danger is
              deliberately a darker, desaturated red so the two do not read as the
              same signal. */}
          <AlertDialogCancel disabled={isLoading} asChild>
            <Button variant="secondary" size="sm">
              Cancel
            </Button>
          </AlertDialogCancel>
          <AlertDialogAction disabled={isLoading} onClick={onConfirm} asChild>
            <Button variant="destructive" size="sm" data-testid="delete-confirm">
              {isLoading ? "Deleting…" : "Delete component"}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

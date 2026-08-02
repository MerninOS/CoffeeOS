"use client";

import type { CSSProperties } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { RoastRequest, CoffeeInventory, RoastPriority } from "./types";
import { Btn, FieldLabel, MerninInput, MerninTextarea } from "./primitives";

/**
 * Retokenized onto instrument (CoffeeOS#71), same fields/handlers as before.
 *
 * Radix Dialog and Select are KEPT rather than swapped for instrument's own
 * `Modal`/`Select`: instrument's Modal renders no `role="dialog"`, and its
 * Select is a native `<select>` — both would change what the capability spec
 * (`field-coffee`, `field-priority`, `request-dialog`) can drive.
 *
 * `data-surface="app"` on DialogContent and every SelectContent is
 * load-bearing, not defensive: Radix portals both to <body>, outside the
 * AppShell subtree the instrument token layer is scoped to, so without it
 * every `var(--token)` here resolves to nothing (see ProductDialogs.tsx).
 */

const PANEL: CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--hairline)",
  borderRadius: "var(--r-lg)",
  boxShadow: "var(--shadow-modal)",
  padding: 0,
  overflow: "hidden",
  gap: 0,
};

const HEAD: CSSProperties = {
  padding: "var(--space-5) var(--space-6)",
  borderBottom: "1px solid var(--hairline)",
  background: "var(--surface-sunken)",
};

const FOOT: CSSProperties = {
  padding: "var(--space-4) var(--space-6)",
  borderTop: "1px solid var(--hairline)",
  background: "var(--surface-sunken)",
  display: "flex",
  gap: 8,
  justifyContent: "flex-end",
};

const TITLE: CSSProperties = {
  fontFamily: "var(--font-display)",
  fontVariationSettings: "var(--display-settings)",
  fontWeight: "var(--display-weight)" as unknown as number,
  letterSpacing: "var(--display-tracking)",
  fontSize: "var(--fs-title)",
  textTransform: "uppercase",
  color: "var(--ink)",
};

const SELECT_TRIGGER: CSSProperties = {
  width: "100%",
  height: 36,
  padding: "0 10px",
  background: "var(--surface)",
  border: "1px solid var(--hairline-strong)",
  borderRadius: "var(--r-sm)",
  boxShadow: "none",
  fontFamily: "var(--font-sans)",
  fontSize: "var(--fs-body)",
  color: "var(--ink)",
};

const SELECT_CONTENT: CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--hairline-strong)",
  borderRadius: "var(--r-md)",
  boxShadow: "var(--shadow-pop)",
  color: "var(--ink)",
};

const SELECT_ITEM: CSSProperties = {
  fontFamily: "var(--font-sans)",
  fontSize: "var(--fs-body)",
  color: "var(--ink)",
  borderRadius: "var(--r-sm)",
};

interface RequestDialogFormData {
  greenCoffeeId: string;
  quantityG: string;
  priority: RoastPriority;
  dueDate: string;
  notes: string;
}

interface RequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingRequest: RoastRequest | null;
  coffeeInventory: CoffeeInventory[];
  formData: RequestDialogFormData;
  setFormData: (next: RequestDialogFormData) => void;
  isSubmitting: boolean;
  onSubmit: () => void;
}

export function RequestDialog({
  open,
  onOpenChange,
  editingRequest,
  coffeeInventory,
  formData,
  setFormData,
  isSubmitting,
  onSubmit,
}: RequestDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-surface="app" data-testid="request-dialog" className="max-w-md" style={PANEL}>
        <div style={HEAD}>
          <DialogHeader>
            <DialogTitle style={TITLE}>
              {editingRequest ? "Edit Roast Request" : "New Roast Request"}
            </DialogTitle>
          </DialogHeader>
        </div>
        <div
          className="max-h-[70vh] overflow-y-auto"
          style={{ padding: "var(--space-5) var(--space-6)", display: "flex", flexDirection: "column", gap: "var(--gap-stack)" }}
        >
          <div>
            <FieldLabel>Coffee</FieldLabel>
            <Select
              value={formData.greenCoffeeId}
              onValueChange={(value) => setFormData({ ...formData, greenCoffeeId: value })}
              disabled={!!editingRequest}
            >
              <SelectTrigger data-testid="field-coffee" style={SELECT_TRIGGER}>
                <SelectValue placeholder="Select coffee" />
              </SelectTrigger>
              <SelectContent data-surface="app" style={SELECT_CONTENT}>
                {coffeeInventory.map((coffee) => (
                  <SelectItem key={coffee.id} value={coffee.id} style={SELECT_ITEM}>
                    <div className="flex items-center justify-between gap-4">
                      <span>{coffee.name}</span>
                      <span style={{ color: "var(--ink-subtle)", fontSize: "var(--fs-caption)" }}>
                        {coffee.current_green_quantity_g.toLocaleString()}g available
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <FieldLabel>Quantity (grams)</FieldLabel>
            <MerninInput
              type="number"
              step="1"
              value={formData.quantityG}
              onChange={(e) => setFormData({ ...formData, quantityG: e.target.value })}
              data-testid="field-quantity"
              placeholder="Enter quantity in grams"
            />
          </div>

          <div>
            <FieldLabel>Priority</FieldLabel>
            <Select
              value={formData.priority}
              onValueChange={(value: "low" | "normal" | "high" | "urgent") =>
                setFormData({ ...formData, priority: value })
              }
            >
              <SelectTrigger data-testid="field-priority" style={SELECT_TRIGGER}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent data-surface="app" style={SELECT_CONTENT}>
                <SelectItem value="low" style={SELECT_ITEM}>Low</SelectItem>
                <SelectItem value="normal" style={SELECT_ITEM}>Normal</SelectItem>
                <SelectItem value="high" style={SELECT_ITEM}>High</SelectItem>
                <SelectItem value="urgent" style={SELECT_ITEM}>Urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <FieldLabel>Due Date (optional)</FieldLabel>
            <MerninInput
              type="date"
              value={formData.dueDate}
              onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
            />
          </div>

          <div>
            <FieldLabel>Notes (optional)</FieldLabel>
            <MerninTextarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Add any notes..."
              rows={3}
            />
          </div>
        </div>
        <div style={FOOT}>
          <Btn variant="outline" onClick={() => onOpenChange(false)}>Cancel</Btn>
          <Btn
            data-testid="dialog-submit"
            onClick={onSubmit}
            disabled={isSubmitting || !formData.greenCoffeeId || !formData.quantityG}
          >
            {isSubmitting ? "Saving..." : editingRequest ? "Update" : "Create"}
          </Btn>
        </div>
      </DialogContent>
    </Dialog>
  );
}

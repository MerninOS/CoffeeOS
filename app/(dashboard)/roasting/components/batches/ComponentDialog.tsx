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
import { SegmentedControl } from "@merninos/ui/instrument";
import { lb } from "../../units";
import type { Batch, ExistingComponent } from "./types";
import { COST_PER_UNIT_DECIMALS } from "./costing";
import { Btn, FieldLabel, MerninInput } from "./primitives";

const UNITS = ["g", "oz", "lb", "kg"];

/**
 * Retokenized onto instrument (CoffeeOS#71), same fields/handlers as before.
 *
 * Radix Dialog and Select are KEPT rather than swapped for instrument's own
 * `Modal`/`Select` — see ../requests/RequestDialog.tsx, which makes the same
 * call for the same reason (no `role="dialog"`, native `<select>` only).
 *
 * `data-surface="app"` on DialogContent and every SelectContent is
 * load-bearing: Radix portals both to <body>, outside the instrument token
 * scope.
 *
 * The mode toggle ("Create New" / "Add to Existing") moves onto instrument's
 * `SegmentedControl` rather than staying two hand-rolled buttons — that is
 * exactly the "view toggle between mutually-exclusive options" case the
 * component's own doc comment names.
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

const SUMMARY: CSSProperties = {
  borderRadius: "var(--r-md)",
  border: "1px solid var(--hairline)",
  background: "var(--surface-sunken)",
  padding: "12px 16px",
  display: "flex",
  flexDirection: "column",
  gap: 4,
};

interface ComponentFormData {
  name: string;
  costPerUnit: string;
  unit: string;
}

interface ComponentDialogProps {
  createComponentBatch: Batch | null;
  existingComponents: ExistingComponent[];
  componentMode: "new" | "existing";
  setComponentMode: (mode: "new" | "existing") => void;
  selectedComponentId: string;
  setSelectedComponentId: (id: string) => void;
  componentFormData: ComponentFormData;
  setComponentFormData: (data: ComponentFormData) => void;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: () => void;
}

export function ComponentDialog({
  createComponentBatch,
  existingComponents,
  componentMode,
  setComponentMode,
  selectedComponentId,
  setSelectedComponentId,
  componentFormData,
  setComponentFormData,
  isSubmitting,
  onClose,
  onSubmit,
}: ComponentDialogProps) {
  return (
    <Dialog open={!!createComponentBatch} onOpenChange={onClose}>
      <DialogContent data-surface="app" data-testid="component-dialog" className="max-w-md" style={PANEL}>
        <div style={HEAD}>
          <DialogHeader>
            <DialogTitle style={TITLE}>Add Roasted Coffee to Component</DialogTitle>
          </DialogHeader>
        </div>
        <div
          className="max-h-[70vh] overflow-y-auto"
          style={{ padding: "var(--space-5) var(--space-6)", display: "flex", flexDirection: "column", gap: "var(--space-4)" }}
        >
          {/* Mode toggle — only shown when existing components exist */}
          {existingComponents.length > 0 && (
            <div>
              <FieldLabel>What would you like to do?</FieldLabel>
              <SegmentedControl
                options={[
                  { value: "new", label: "Create New" },
                  { value: "existing", label: "Add to Existing" },
                ]}
                value={componentMode}
                onChange={(value) => setComponentMode(value as "new" | "existing")}
              />
            </div>
          )}

          {/* Existing component select */}
          {componentMode === "existing" && existingComponents.length > 0 && (
            <div>
              <FieldLabel>Select Component</FieldLabel>
              <Select value={selectedComponentId} onValueChange={setSelectedComponentId}>
                <SelectTrigger data-testid="field-existing-component" style={SELECT_TRIGGER}>
                  <SelectValue placeholder="Choose a component..." />
                </SelectTrigger>
                <SelectContent data-surface="app" style={SELECT_CONTENT}>
                  {existingComponents.map((comp) => (
                    <SelectItem key={comp.id} value={comp.id} style={SELECT_ITEM}>
                      <div className="flex items-center justify-between gap-4">
                        <span>{comp.name}</span>
                        <span style={{ color: "var(--ink-subtle)", fontSize: "var(--fs-caption)" }}>
                          ${comp.cost_per_unit.toFixed(COST_PER_UNIT_DECIMALS)}/{comp.unit}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedComponentId && (
                <p style={{ fontSize: "var(--fs-caption)", color: "var(--ink-muted)", marginTop: 6 }}>
                  Current price will be averaged with this batch&apos;s cost per gram
                </p>
              )}
            </div>
          )}

          {/* New component fields */}
          {componentMode === "new" && (
            <>
              <div>
                <FieldLabel>Component Name</FieldLabel>
                <MerninInput
                  data-testid="field-component-name"
                  id="componentName"
                  value={componentFormData.name}
                  onChange={(e) => setComponentFormData({ ...componentFormData, name: e.target.value })}
                  placeholder="e.g., Roasted Ethiopia Yirgacheffe"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <FieldLabel>Cost per Unit</FieldLabel>
                  <MerninInput
                    data-testid="field-cost-per-unit"
                    id="costPerUnit"
                    type="number"
                    step="0.00000001"
                    value={componentFormData.costPerUnit}
                    onChange={(e) => setComponentFormData({ ...componentFormData, costPerUnit: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <FieldLabel>Unit</FieldLabel>
                  <Select
                    value={componentFormData.unit}
                    onValueChange={(value) => setComponentFormData({ ...componentFormData, unit: value })}
                  >
                    <SelectTrigger data-testid="field-unit" style={SELECT_TRIGGER}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent data-surface="app" style={SELECT_CONTENT}>
                      {UNITS.map((unit) => (
                        <SelectItem key={unit} value={unit} style={SELECT_ITEM}>{unit}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>
          )}

          {/* Batch summary */}
          {createComponentBatch && (
            <div style={SUMMARY}>
              <p style={{ fontSize: "var(--fs-overline)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--ink-muted)", marginBottom: 4 }}>
                Batch Details
              </p>
              {[
                { label: "Coffee", value: createComponentBatch.coffee_name },
                { label: "Lot", value: createComponentBatch.lot_code || "N/A" },
                { label: "Sellable Weight", value: `${lb(createComponentBatch.sellable_g)} lb` },
                { label: "Loss", value: `${createComponentBatch.loss_percent.toFixed(1)}%` },
              ].map((row) => (
                <div key={row.label} className="flex justify-between" style={{ fontSize: "var(--fs-caption)" }}>
                  <span style={{ color: "var(--ink-muted)" }}>{row.label}</span>
                  <span style={{ fontWeight: 600, color: "var(--ink)" }}>{row.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={FOOT}>
          <Btn variant="outline" onClick={onClose}>Cancel</Btn>
          <Btn
            data-testid="dialog-submit"
            onClick={onSubmit}
            disabled={
              isSubmitting ||
              (componentMode === "new" && (!componentFormData.name || !componentFormData.costPerUnit)) ||
              (componentMode === "existing" && !selectedComponentId)
            }
          >
            {isSubmitting
              ? componentMode === "existing" ? "Adding..." : "Creating..."
              : componentMode === "existing" ? "Add to Component" : "Create Component"}
          </Btn>
        </div>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import type { CSSProperties } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SegmentedControl } from "@merninos/ui/instrument";
import { Btn, FieldLabel, MerninInput, MerninTextarea } from "./primitives";

/**
 * Retokenized onto instrument (CoffeeOS#71), same fields/handlers as before.
 *
 * Radix Dialog is KEPT rather than swapped for instrument's own `Modal`: the
 * capability spec drives this through `role="dialog"`, which `Modal` does not
 * render — same reasoning as RequestDialog.tsx.
 *
 * `data-surface="app"` on DialogContent is load-bearing, not defensive: Radix
 * portals it to <body>, outside the AppShell subtree the instrument token
 * layer is scoped to, so without it every `var(--token)` here resolves to
 * nothing (see ProductDialogs.tsx).
 *
 * The cost-mode toggle moves from three hand-rolled buttons to instrument's
 * `SegmentedControl` — a single-select control over ≤4 mutually exclusive
 * options is exactly what it's for, and it removes the last hand-rolled
 * "active pill" styling in this file.
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

const COST_MODES = [
  { value: "toll_roasting", label: "Toll Roasting" },
  { value: "power_usage", label: "Power Usage" },
  { value: "co_roasting", label: "Co-Roasting" },
] as const;

export interface SessionFormData {
  sessionDate: string;
  vendorName: string;
  costMode: "toll_roasting" | "power_usage" | "co_roasting";
  ratePerHour: string;
  ratePerLb: string;
  machineEnergyKwhPerHour: string;
  kwhRate: string;
  setupMinutes: string;
  cleanupMinutes: string;
  billingGranularityMinutes: string;
  allocationMode: string;
  notes: string;
}

interface SessionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formData: SessionFormData;
  setFormData: (next: SessionFormData) => void;
  isSubmitting: boolean;
  onSubmit: () => void;
}

export function SessionDialog({
  open,
  onOpenChange,
  formData,
  setFormData,
  isSubmitting,
  onSubmit,
}: SessionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-surface="app" data-testid="session-dialog" className="max-w-lg" style={PANEL}>
        <div style={HEAD}>
          <DialogHeader>
            <DialogTitle style={TITLE}>Create Roasting Session</DialogTitle>
          </DialogHeader>
        </div>
        <div
          className="max-h-[70vh] overflow-y-auto"
          style={{ padding: "var(--space-5) var(--space-6)", display: "flex", flexDirection: "column", gap: "var(--gap-stack)" }}
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <FieldLabel>Session Date</FieldLabel>
              <MerninInput
                id="sessionDate"
                data-testid="field-date"
                type="date"
                value={formData.sessionDate}
                onChange={(e) => setFormData({ ...formData, sessionDate: e.target.value })}
                required
              />
            </div>
            <div>
              <FieldLabel>Vendor / Roastery Name</FieldLabel>
              <MerninInput
                id="vendorName"
                data-testid="field-vendor"
                value={formData.vendorName}
                onChange={(e) => setFormData({ ...formData, vendorName: e.target.value })}
                placeholder="e.g., Mill City Roasters"
                required
              />
            </div>
          </div>

          <div>
            <FieldLabel>Roasting Cost Method</FieldLabel>
            <SegmentedControl
              options={COST_MODES.map((m) => ({ value: m.value, label: m.label }))}
              value={formData.costMode}
              onChange={(value) =>
                setFormData({ ...formData, costMode: value as SessionFormData["costMode"] })
              }
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {formData.costMode === "toll_roasting" && (
              <div>
                <FieldLabel>Rate per Hour ($)</FieldLabel>
                <MerninInput
                  id="ratePerHour"
                  type="number"
                  step="0.01"
                  min="0"
                  data-testid="field-rate"
                  value={formData.ratePerHour}
                  onChange={(e) => setFormData({ ...formData, ratePerHour: e.target.value })}
                  placeholder="e.g., 75.00"
                  required
                />
              </div>
            )}
            {formData.costMode === "power_usage" && (
              <>
                <div>
                  <FieldLabel>Machine Usage (kWh/hr)</FieldLabel>
                  <MerninInput
                    id="machineEnergyKwhPerHour"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.machineEnergyKwhPerHour}
                    onChange={(e) => setFormData({ ...formData, machineEnergyKwhPerHour: e.target.value })}
                    placeholder="e.g., 6.5"
                    required
                  />
                </div>
                <div>
                  <FieldLabel>Cost per kWh ($)</FieldLabel>
                  <MerninInput
                    id="kwhRate"
                    type="number"
                    step="0.0001"
                    min="0"
                    value={formData.kwhRate}
                    onChange={(e) => setFormData({ ...formData, kwhRate: e.target.value })}
                    placeholder="e.g., 0.1350"
                    required
                  />
                </div>
              </>
            )}
            {formData.costMode === "co_roasting" && (
              <div>
                <FieldLabel>Rate per Pound – Green ($)</FieldLabel>
                <MerninInput
                  id="ratePerLb"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.ratePerLb}
                  onChange={(e) => setFormData({ ...formData, ratePerLb: e.target.value })}
                  placeholder="e.g., 2.50"
                  required
                />
              </div>
            )}
          </div>

          {formData.costMode !== "co_roasting" && (
            <>
              <div>
                <FieldLabel>Billing Granularity (min)</FieldLabel>
                <MerninInput
                  id="billingGranularityMinutes"
                  type="number"
                  min="1"
                  value={formData.billingGranularityMinutes}
                  onChange={(e) => setFormData({ ...formData, billingGranularityMinutes: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <FieldLabel>Setup Time (min)</FieldLabel>
                  <MerninInput
                    id="setupMinutes"
                    type="number"
                    min="0"
                    value={formData.setupMinutes}
                    onChange={(e) => setFormData({ ...formData, setupMinutes: e.target.value })}
                  />
                </div>
                <div>
                  <FieldLabel>Cleanup Time (min)</FieldLabel>
                  <MerninInput
                    id="cleanupMinutes"
                    type="number"
                    min="0"
                    value={formData.cleanupMinutes}
                    onChange={(e) => setFormData({ ...formData, cleanupMinutes: e.target.value })}
                  />
                </div>
              </div>
            </>
          )}

          <div>
            <FieldLabel>Notes (optional)</FieldLabel>
            <MerninTextarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Any notes for this session..."
              rows={2}
            />
          </div>
        </div>
        <div style={FOOT}>
          <Btn variant="outline" onClick={() => onOpenChange(false)}>Cancel</Btn>
          <Btn data-testid="dialog-submit" onClick={onSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Creating..." : "Create Session"}
          </Btn>
        </div>
      </DialogContent>
    </Dialog>
  );
}

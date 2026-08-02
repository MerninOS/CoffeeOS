"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Btn, FieldLabel, MerninInput, MerninTextarea } from "./primitives";

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
      <DialogContent data-testid="session-dialog" className="max-w-lg p-0 gap-0 border-[3px] border-espresso rounded-[16px] overflow-hidden bg-chalk shadow-flat-lg max-h-[90vh]">
        <div className="bg-cream border-b-[3px] border-espresso px-6 py-4">
          <DialogHeader>
            <DialogTitle className="font-extrabold text-[15px] uppercase tracking-[.08em] text-espresso">
              Create Roasting Session
            </DialogTitle>
          </DialogHeader>
        </div>
        <div className="px-6 py-5 space-y-4 overflow-y-auto">
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

          {/* Cost Mode toggle */}
          <div>
            <FieldLabel>Roasting Cost Method</FieldLabel>
            <div className="flex gap-1.5">
              {COST_MODES.map((mode) => (
                <button
                  key={mode.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, costMode: mode.value })}
                  className={`flex-1 py-1.5 rounded-[8px] border-[2px] font-extrabold text-[10px] uppercase tracking-[.07em] transition-all duration-[120ms] ${
                    formData.costMode === mode.value
                      ? "bg-espresso text-cream border-espresso"
                      : "bg-transparent text-espresso border-fog hover:border-espresso/40"
                  }`}
                >
                  {mode.label}
                </button>
              ))}
            </div>
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
        <div className="bg-cream border-t-[3px] border-espresso px-6 py-4 flex justify-end gap-2">
          <Btn variant="outline" onClick={() => onOpenChange(false)}>Cancel</Btn>
          <Btn data-testid="dialog-submit" onClick={onSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Creating..." : "Create Session"}
          </Btn>
        </div>
      </DialogContent>
    </Dialog>
  );
}

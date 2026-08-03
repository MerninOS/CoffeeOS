"use client";

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
import type { Batch, ExistingComponent } from "./types";
import { COST_PER_UNIT_DECIMALS } from "./costing";
import { Btn, FieldLabel, MerninInput } from "./primitives";

const UNITS = ["g", "oz", "lb", "kg"];

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
      <DialogContent data-testid="component-dialog" className="max-w-md p-0 gap-0 border-[3px] border-espresso rounded-[16px] overflow-hidden bg-chalk shadow-flat-lg">
        <div className="bg-cream border-b-[3px] border-espresso px-6 py-4">
          <DialogHeader>
            <DialogTitle className="font-extrabold text-[15px] uppercase tracking-[.08em] text-espresso">
              Add Roasted Coffee to Component
            </DialogTitle>
          </DialogHeader>
        </div>
        <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Mode toggle — only shown when existing components exist */}
          {existingComponents.length > 0 && (
            <div>
              <FieldLabel>What would you like to do?</FieldLabel>
              <div className="flex gap-1.5">
                {[
                  { value: "new", label: "Create New" },
                  { value: "existing", label: "Add to Existing" },
                ].map((mode) => (
                  <button
                    key={mode.value}
                    type="button"
                    onClick={() => setComponentMode(mode.value as "new" | "existing")}
                    className={`flex-1 py-1.5 rounded-[8px] border-[2px] font-extrabold text-[10px] uppercase tracking-[.07em] transition-all duration-[120ms] ${
                      componentMode === mode.value
                        ? "bg-espresso text-cream border-espresso"
                        : "bg-transparent text-espresso border-fog hover:border-espresso/40"
                    }`}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Existing component select */}
          {componentMode === "existing" && existingComponents.length > 0 && (
            <div>
              <FieldLabel>Select Component</FieldLabel>
              <Select value={selectedComponentId} onValueChange={setSelectedComponentId}>
                <SelectTrigger data-testid="field-existing-component" className="border-[2.5px] border-espresso bg-cream text-espresso font-medium text-[13px] rounded-[8px] shadow-[2px_2px_0_#1C0F05]">
                  <SelectValue placeholder="Choose a component..." />
                </SelectTrigger>
                <SelectContent>
                  {existingComponents.map((comp) => (
                    <SelectItem key={comp.id} value={comp.id}>
                      <div className="flex items-center justify-between gap-4">
                        <span>{comp.name}</span>
                        <span className="text-muted-foreground text-xs">
                          ${comp.cost_per_unit.toFixed(COST_PER_UNIT_DECIMALS)}/{comp.unit}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedComponentId && (
                <p className="text-[11px] text-espresso/50 font-medium mt-1.5">
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
                    <SelectTrigger data-testid="field-unit" className="border-[2.5px] border-espresso bg-cream text-espresso font-medium text-[13px] rounded-[8px] shadow-[2px_2px_0_#1C0F05]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {UNITS.map((unit) => (
                        <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>
          )}

          {/* Batch summary */}
          {createComponentBatch && (
            <div className="rounded-[10px] border-[2px] border-fog bg-cream px-4 py-3 space-y-1">
              <p className="text-[10px] font-extrabold uppercase tracking-[.08em] text-espresso/50 mb-2">
                Batch Details
              </p>
              {[
                { label: "Coffee", value: createComponentBatch.coffee_name },
                { label: "Lot", value: createComponentBatch.lot_code || "N/A" },
                { label: "Sellable Weight", value: `${createComponentBatch.sellable_g.toFixed(0)}g` },
                { label: "Loss", value: `${createComponentBatch.loss_percent.toFixed(1)}%` },
              ].map((row) => (
                <div key={row.label} className="flex justify-between text-[12px]">
                  <span className="text-espresso/50 font-medium">{row.label}</span>
                  <span className="font-bold text-espresso">{row.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="bg-cream border-t-[3px] border-espresso px-6 py-4 flex justify-end gap-2">
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

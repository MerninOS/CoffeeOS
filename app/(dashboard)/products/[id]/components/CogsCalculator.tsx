"use client";

import Link from "next/link";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Package, Plus, Save, Trash2 } from "lucide-react";
import { Btn, FieldLabel, MerninInput, Panel, fmt } from "./primitives";
import type { Component, SelectedComponent } from "./types";

/**
 * The recipe editor — both empty states, the mobile stacked cards, the desktop
 * table and the save footer — moved out of product-detail-client.tsx unchanged
 * (CoffeeOS#69 Stage A).
 *
 * The two renderings of the same rows are kept side by side, mobile first then
 * desktop, in that order, with `sm:hidden` / `hidden sm:block` doing the
 * switching. Collapsing them into one responsive rendering is exactly the kind
 * of "improvement" Stage A forbids: it would change the DOM and therefore the
 * baselines, and it would change which control the keyboard reaches first.
 *
 * Preserved as-is:
 *  - the desktop quantity `<input>` does NOT use MerninInput; it has its own
 *    `border-[2px]` / `rounded-[8px]` class string, so the two viewports render
 *    visibly different inputs for the same field
 *  - both renderings key rows on the array index, so removing a middle row
 *    remounts everything below it and discards any in-flight `<Select>` state
 *  - `parseFloat(e.target.value) || 0` turns an emptied quantity field into 0
 *    rather than letting it be empty, so the field fights the user mid-edit
 *  - "Add Component" is disabled once every available component is used, which
 *    is also what prevents ever adding the same component twice — quantity is
 *    the only way to express "two of these"
 *  - line totals go through `fmt`, i.e. THREE decimals (see primitives.tsx)
 */
export function CogsCalculator({
  availableComponents,
  selectedComponents,
  isVariantMode,
  selectedVariantId,
  isSaving,
  onAddComponent,
  onRemoveComponent,
  onUpdateComponent,
  onSaveComponents,
}: {
  availableComponents: Component[];
  selectedComponents: SelectedComponent[];
  isVariantMode: boolean;
  selectedVariantId: string;
  isSaving: boolean;
  onAddComponent: () => void;
  onRemoveComponent: (i: number) => void;
  onUpdateComponent: (i: number, field: keyof SelectedComponent, value: string | number) => void;
  onSaveComponents: () => void;
}) {
  return (
    <Panel
      title="COGS Calculator"
      subtitle="Add cost components to calculate total COGS"
      action={
        <Btn
          data-testid="recipe-add"
          onClick={onAddComponent}
          disabled={availableComponents.length === 0 || selectedComponents.length >= availableComponents.length}
          size="sm"
        >
          <Plus size={13} strokeWidth={2.5} />
          Add Component
        </Btn>
      }
    >
      {availableComponents.length === 0 ? (
        <div className="flex flex-col items-center py-10 text-center">
          <Package size={32} strokeWidth={1.5} className="text-fog mb-3" />
          <p className="font-extrabold uppercase text-[13px] tracking-wide text-espresso">No components available</p>
          <p className="text-[12px] text-muted-foreground mt-1">
            <Link href="/components" className="text-tomato underline font-bold">Create components first</Link> to calculate COGS.
          </p>
        </div>
      ) : selectedComponents.length === 0 ? (
        <div className="flex flex-col items-center py-10 text-center">
          <Package size={32} strokeWidth={1.5} className="text-fog mb-3" />
          <p className="font-extrabold uppercase text-[13px] tracking-wide text-espresso">No components added</p>
          <p className="text-[12px] text-muted-foreground mt-1">Click &quot;Add Component&quot; to start building your COGS.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {/* Mobile: stacked cards */}
          <div className="flex flex-col gap-3 sm:hidden">
            {selectedComponents.map((sc, idx) => {
              const comp = availableComponents.find((c) => c.id === sc.componentId);
              const lineTotal = comp ? sc.quantity * comp.cost_per_unit : 0;
              return (
                <div key={idx} data-testid="recipe-row" className="rounded-[12px] border-[2.5px] border-espresso bg-cream p-3">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex-1">
                      <FieldLabel>Component</FieldLabel>
                      <Select value={sc.componentId} onValueChange={(v) => onUpdateComponent(idx, "componentId", v)}>
                        <SelectTrigger className="border-[2px] border-espresso rounded-[8px] h-9 text-[12px] font-bold">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {availableComponents.map((c) => (
                            <SelectItem key={c.id} value={c.id}>{c.name} ({c.unit})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <button data-testid="recipe-remove" onClick={() => onRemoveComponent(idx)} className="w-8 h-8 mt-5 inline-flex items-center justify-center rounded-full text-tomato hover:bg-tomato/10 transition-colors">
                      <Trash2 size={14} strokeWidth={2} />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <FieldLabel>Quantity</FieldLabel>
                      <MerninInput data-testid="recipe-qty" type="number" min="0" step="0.01" value={sc.quantity} onChange={(e) => onUpdateComponent(idx, "quantity", parseFloat(e.target.value) || 0)} />
                    </div>
                    <div className="rounded-[10px] bg-fog/50 border-[2px] border-fog p-3">
                      <div className="text-[9.5px] font-extrabold uppercase tracking-wide text-muted-foreground">Line total</div>
                      <div data-testid="recipe-line-total" className="font-extrabold text-[15px] text-espresso mt-0.5 tabular-nums">{fmt(lineTotal)}</div>
                      <div data-testid="recipe-unit-cost" className="text-[10px] text-muted-foreground mt-0.5">{comp ? `${fmt(comp.cost_per_unit)}/${comp.unit}` : "—"}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop: table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="border-b-2 border-espresso">
                  {["Component", "Quantity", "Unit Cost", "Total", ""].map((h, i) => (
                    <th key={i} className={`py-2.5 text-[9.5px] font-extrabold uppercase tracking-[.1em] text-muted-foreground ${i > 0 ? "text-right" : "text-left"} ${i === 4 ? "w-10" : ""}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {selectedComponents.map((sc, idx) => {
                  const comp = availableComponents.find((c) => c.id === sc.componentId);
                  const lineTotal = comp ? sc.quantity * comp.cost_per_unit : 0;
                  return (
                    <tr key={idx} data-testid="recipe-row" className="border-b border-dashed border-fog last:border-0">
                      <td className="py-3 pr-4">
                        <Select value={sc.componentId} onValueChange={(v) => onUpdateComponent(idx, "componentId", v)}>
                          <SelectTrigger className="border-[2px] border-espresso rounded-[8px] h-9 text-[12px] font-bold">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {availableComponents.map((c) => (
                              <SelectItem key={c.id} value={c.id}>{c.name} ({c.unit})</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="py-3 pr-4">
                        <input
                          data-testid="recipe-qty"
                          type="number" min="0" step="0.01" value={sc.quantity}
                          onChange={(e) => onUpdateComponent(idx, "quantity", parseFloat(e.target.value) || 0)}
                          className="w-24 bg-chalk border-[2px] border-espresso rounded-[8px] px-3 py-2 text-[13px] font-bold text-espresso outline-none focus:border-tomato text-right tabular-nums"
                        />
                      </td>
                      <td data-testid="recipe-unit-cost" className="py-3 text-right font-mono text-[12px] text-muted-foreground">
                        {comp ? `${fmt(comp.cost_per_unit)}/${comp.unit}` : "—"}
                      </td>
                      <td data-testid="recipe-line-total" className="py-3 text-right font-bold text-espresso tabular-nums">{fmt(lineTotal)}</td>
                      <td className="py-3 pl-3">
                        <button data-testid="recipe-remove" onClick={() => onRemoveComponent(idx)} className="w-7 h-7 inline-flex items-center justify-center rounded-full text-tomato hover:bg-tomato/10 transition-colors">
                          <Trash2 size={13} strokeWidth={2} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end pt-2 border-t-2 border-fog">
            <Btn data-testid="recipe-save" onClick={onSaveComponents} disabled={isSaving || (isVariantMode && !selectedVariantId)}>
              {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} strokeWidth={2} />}
              {isVariantMode ? "Save Variant COGS" : "Save Components"}
            </Btn>
          </div>
        </div>
      )}
    </Panel>
  );
}

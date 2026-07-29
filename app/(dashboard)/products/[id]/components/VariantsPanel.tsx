"use client";

import { Loader2, Plus } from "lucide-react";
import { Btn, Panel } from "./primitives";
import type { ProductVariant } from "./types";

/**
 * The variant picker — pill row, selected-variant strip and Remove Variant —
 * moved out of product-detail-client.tsx unchanged (CoffeeOS#69 Stage A). Every
 * class string is byte-identical.
 *
 * Preserved as-is and revisited in later stages:
 *  - the pill row is a bare `<button>` list with no `role="tablist"`, no
 *    `aria-selected` and no roving focus, so the selected variant is conveyed by
 *    colour alone
 *  - the strip's left-hand text says "Select a variant to edit its COGS."
 *    whenever the selected variant has no SKU — but the strip only renders when
 *    a variant IS selected, so that copy is unreachable-as-written and instead
 *    reads as a stale instruction on any SKU-less variant
 *  - Remove Variant is a `window.confirm` in the parent, not a dialog; Stage B
 *    leaves that alone too so the pixel diff stays clean
 */
export function VariantsPanel({
  variants,
  selectedVariantId,
  selectedVariant,
  onSelectVariant,
  onOpenAddVariant,
  onRemoveVariant,
  isRemovingVariant,
}: {
  variants: ProductVariant[];
  selectedVariantId: string;
  selectedVariant: ProductVariant | null;
  onSelectVariant: (id: string) => void;
  onOpenAddVariant: () => void;
  onRemoveVariant: () => void;
  isRemovingVariant: boolean;
}) {
  return (
    <Panel
      title="Variants"
      subtitle="Add variants, then edit COGS per variant."
      action={
        <Btn variant="outline" size="sm" onClick={onOpenAddVariant}>
          <Plus size={13} strokeWidth={2.5} />
          Add Variant
        </Btn>
      }
    >
      {variants.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">
          No variants yet. Add one to get started.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            {variants.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => onSelectVariant(v.id)}
                className={`inline-flex items-center h-[30px] px-4 rounded-full border-[2.5px] text-[11px] font-extrabold uppercase tracking-[.08em] transition-all duration-100 ${
                  v.id === selectedVariantId
                    ? "bg-tomato text-cream border-espresso shadow-[3px_3px_0_#1C0F05]"
                    : "bg-transparent text-espresso border-espresso hover:bg-fog/40"
                }`}
              >
                {v.title}
              </button>
            ))}
          </div>
          {selectedVariant && (
            <div className="flex items-center justify-between rounded-[10px] border-[2px] border-dashed border-fog bg-cream p-3">
              <span className="text-[12px] text-muted-foreground font-bold">
                {selectedVariant.sku ? `SKU: ${selectedVariant.sku}` : "Select a variant to edit its COGS."}
              </span>
              <Btn
                variant="ghost"
                size="sm"
                onClick={onRemoveVariant}
                disabled={!selectedVariant || isRemovingVariant}
                className="text-tomato hover:bg-tomato/10 !border-transparent"
              >
                {isRemovingVariant && <Loader2 size={12} className="animate-spin" />}
                Remove Variant
              </Btn>
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}

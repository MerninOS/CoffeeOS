"use client";

import { Switch } from "@/components/ui/switch";
import { DollarSign, Loader2, Plus, Save, Store, Trash2 } from "lucide-react";
import { Btn, FieldLabel, MerninInput, Panel } from "./primitives";

/**
 * The wholesale block — enable switch, base price / min qty fields, the volume
 * tier list and the save footer — moved out of product-detail-client.tsx
 * unchanged (CoffeeOS#69 Stage A).
 *
 * The tier row's two inline `onChange` bodies are copied across character for
 * character, including the `const u = [...priceTiers]` copy-then-splice shape.
 * They are not hoisted into named handlers, because a named handler would have
 * to close over `priceTiers` differently and Stage A is not the place to
 * discover whether that matters.
 *
 * Preserved as-is:
 *  - the "Profit: $…" line is `toFixed(2)` while every other money figure on
 *    this page is `fmt`'s THREE decimals — the same screen disagrees with itself
 *  - the tier margin thresholds are 20/10 (matcha/honey/tomato), NOT the 30/15
 *    used by the stat tiles and the list page's MarginPill; three sets of
 *    thresholds now exist for the same concept
 *  - tiers key on array index, so deleting a middle tier remounts the rest
 *  - nothing validates that tiers ascend by `min_quantity` or descend by price,
 *    and nothing stops two tiers sharing a `min_quantity`
 *  - `parseInt(wholesaleMinQty) || 1` in the parent silently rewrites a blank or
 *    zero minimum to 1 on save without telling the user
 */
export function WholesalePanel({
  wholesaleEnabled,
  onWholesaleEnabledChange,
  wholesalePrice,
  onWholesalePriceChange,
  wholesaleMinQty,
  onWholesaleMinQtyChange,
  wholesalePriceValue,
  wholesaleMargin,
  calculatedCogs,
  priceTiers,
  onPriceTiersChange,
  onAddPriceTier,
  onSaveWholesale,
  isWholesaleSaving,
}: {
  wholesaleEnabled: boolean;
  onWholesaleEnabledChange: (checked: boolean) => void;
  wholesalePrice: string;
  onWholesalePriceChange: (value: string) => void;
  wholesaleMinQty: string;
  onWholesaleMinQtyChange: (value: string) => void;
  wholesalePriceValue: number;
  wholesaleMargin: number;
  calculatedCogs: number;
  priceTiers: Array<{ min_quantity: number; price: number }>;
  onPriceTiersChange: (tiers: Array<{ min_quantity: number; price: number }>) => void;
  onAddPriceTier: () => void;
  onSaveWholesale: () => void;
  isWholesaleSaving: boolean;
}) {
  // Local alias so the three moved inline handlers below stay byte-identical to
  // what they were when `setPriceTiers` was this file's own useState setter.
  const setPriceTiers = onPriceTiersChange;
  return (
    <Panel
      title="Wholesale Pricing"
      subtitle="Set up volume discounts for wholesale customers"
      action={
        <div className="flex items-center gap-2">
          <label htmlFor="wholesale-enabled" className="text-[10.5px] font-extrabold uppercase tracking-[.1em] text-espresso cursor-pointer">
            Enable
          </label>
          <Switch id="wholesale-enabled" checked={wholesaleEnabled} onCheckedChange={onWholesaleEnabledChange} />
        </div>
      }
    >
      {!wholesaleEnabled ? (
        <div className="flex flex-col items-center py-10 text-center">
          <Store size={32} strokeWidth={1.5} className="text-fog mb-3" />
          <p className="font-extrabold uppercase text-[13px] tracking-wide text-espresso">Wholesale Disabled</p>
          <p className="text-[12px] text-muted-foreground mt-1">Enable the toggle to set up volume discounts.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <FieldLabel htmlFor="wholesale-price">Base Wholesale Price</FieldLabel>
              <MerninInput
                id="wholesale-price"
                type="number" step="0.01" min="0"
                value={wholesalePrice}
                onChange={(e) => onWholesalePriceChange(e.target.value)}
                placeholder="12.00"
                prefix={<DollarSign size={15} strokeWidth={2} />}
              />
              {wholesalePriceValue > 0 && (
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  Margin: {wholesaleMargin.toFixed(1)}% · Profit: ${(wholesalePriceValue - calculatedCogs).toFixed(2)}
                </p>
              )}
            </div>
            <div>
              <FieldLabel htmlFor="wholesale-min-qty">Min Order Quantity</FieldLabel>
              <MerninInput
                id="wholesale-min-qty"
                type="number" min="1"
                value={wholesaleMinQty}
                onChange={(e) => onWholesaleMinQtyChange(e.target.value)}
                placeholder="12"
              />
            </div>
          </div>

          {/* Price tiers */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="text-[10.5px] font-extrabold uppercase tracking-[.1em] text-espresso">
                Volume Price Tiers
              </div>
              <Btn variant="outline" size="sm" onClick={onAddPriceTier}>
                <Plus size={12} strokeWidth={2.5} />
                Add Tier
              </Btn>
            </div>

            {priceTiers.length === 0 ? (
              <p className="text-[12px] text-muted-foreground text-center py-4 border-2 border-dashed border-fog rounded-[10px]">
                No price tiers configured.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {priceTiers.map((tier, idx) => {
                  const tierMargin = tier.price > 0 ? ((tier.price - calculatedCogs) / tier.price) * 100 : 0;
                  return (
                    <div key={idx} className="flex items-center gap-3 rounded-[12px] border-[2.5px] border-espresso bg-cream p-3">
                      <div className="flex-1 grid grid-cols-2 gap-3">
                        <div>
                          <FieldLabel>Min Qty</FieldLabel>
                          <MerninInput type="number" min="1" value={tier.min_quantity} onChange={(e) => { const u = [...priceTiers]; u[idx] = { ...u[idx], min_quantity: parseInt(e.target.value) || 1 }; setPriceTiers(u); }} />
                        </div>
                        <div>
                          <FieldLabel>Price / Unit</FieldLabel>
                          <MerninInput type="number" step="0.01" min="0" value={tier.price} onChange={(e) => { const u = [...priceTiers]; u[idx] = { ...u[idx], price: parseFloat(e.target.value) || 0 }; setPriceTiers(u); }} prefix={<DollarSign size={15} strokeWidth={2} />} />
                        </div>
                      </div>
                      <div className="text-right min-w-[64px]">
                        <div className="text-[9.5px] font-extrabold uppercase tracking-wide text-muted-foreground">Margin</div>
                        <div className={`text-[13px] font-extrabold mt-0.5 ${tierMargin >= 20 ? "text-matcha" : tierMargin >= 10 ? "text-honey" : "text-tomato"}`}>
                          {tierMargin.toFixed(1)}%
                        </div>
                      </div>
                      <button onClick={() => setPriceTiers(priceTiers.filter((_, i) => i !== idx))} className="w-8 h-8 inline-flex items-center justify-center rounded-full text-tomato hover:bg-tomato/10 transition-colors shrink-0">
                        <Trash2 size={14} strokeWidth={2} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex justify-end pt-2 border-t-2 border-fog">
            <Btn onClick={onSaveWholesale} disabled={isWholesaleSaving}>
              {isWholesaleSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} strokeWidth={2} />}
              Save Wholesale Pricing
            </Btn>
          </div>
        </div>
      )}
    </Panel>
  );
}

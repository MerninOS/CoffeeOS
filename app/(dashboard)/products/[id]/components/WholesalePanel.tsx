"use client";

import { Badge, Button, EmptyState, Field, IconButton, Input, Switch } from "@merninos/ui/instrument";
import { Loader2, Plus, Save, Store, Trash2 } from "lucide-react";
import { mono, overline, sans, money3 } from "@/lib/instrument/tokens";
import { Section } from "./Section";

/**
 * Wholesale pricing on instrument (CoffeeOS#69 Stage B): the enable switch moves
 * into the Section's action slot, the base fields become `Field` + `Input`, and
 * the stack of bordered tier cards becomes a worksheet table with the same
 * metrics as RecipeTable — 34px header cells, 40px body rows, hairline rules, no
 * zebra, ONE rendering for both viewports.
 *
 * PRECISION, AND THE ONE INCONSISTENCY THIS COMMIT DOES FIX
 *
 * The loud page rendered its "Profit: $…" line at TWO decimals while every other
 * money figure on the same screen used three, so the page disagreed with itself
 * about what a cent was. Unit economics on this page are three decimals on
 * purpose: `components.cost_per_unit` is `DECIMAL(18,8)` and a line at
 * $0.085/each rounds to $0.09 at two, which makes a five-line recipe visibly
 * disagree with its own total. Profit and price-per-unit here are unit
 * economics, so they go through `money3` like the rest. This is the whole of the
 * numeric change in this file — no threshold, no computation and no handler
 * moved.
 *
 * Preserved as-is:
 *  - the tier margin thresholds are 20/10, NOT the 30/15 the hero strip and the
 *    list page use. Three threshold sets for one concept still exist.
 *  - the two inline tier `onChange` bodies keep their copy-then-splice shape
 *  - tiers key on array index, so deleting a middle tier remounts the rest
 *  - nothing validates that tiers ascend by `min_quantity` or descend by price,
 *    and nothing stops two tiers sharing a `min_quantity`
 *  - `parseInt(wholesaleMinQty) || 1` in the parent silently rewrites a blank or
 *    zero minimum to 1 on save without telling the user
 */

/** Min qty | Tier | Price/unit | Margin | remove */
const GRID = "110px minmax(0,1fr) 150px 120px 40px";
const ROW = "flex flex-col min-[900px]:grid";
const CELL = "flex items-center px-3 py-1.5 min-[900px]:py-0 min-[900px]:h-10";
const CELL_R = `${CELL} justify-between min-[900px]:justify-end`;

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
  // Local alias so the two moved inline handlers below stay recognisable against
  // what they were when `setPriceTiers` was this file's own useState setter.
  const setPriceTiers = onPriceTiersChange;
  const figure: React.CSSProperties = { ...mono, fontSize: "var(--fs-data)" };

  return (
    <Section
      title="Wholesale"
      note={wholesaleEnabled ? "Volume tiers quoted against the unit COGS above." : undefined}
      action={
        <Switch
          id="wholesale-enabled"
          label="Enabled"
          checked={wholesaleEnabled}
          onChange={(e) => onWholesaleEnabledChange(e.target.checked)}
        />
      }
    >
      {!wholesaleEnabled ? (
        <EmptyState
          compact
          icon={<Store size={20} strokeWidth={1.5} />}
          title="Wholesale off"
          description="Turn it on to set a base wholesale price and volume tiers for this product."
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "var(--gap-stack)",
              maxWidth: 620,
            }}
          >
            <Field
              label="Base wholesale price"
              htmlFor="wholesale-price"
              help={
                wholesalePriceValue > 0
                  ? // Three decimals, like every other unit-economics figure on
                    // this page. See the precision note at the top of the file.
                    `Margin ${wholesaleMargin.toFixed(1)}% · profit ${money3(
                      wholesalePriceValue - calculatedCogs
                    )}`
                  : undefined
              }
            >
              <Input
                id="wholesale-price"
                mono
                type="number"
                step="0.01"
                min="0"
                value={wholesalePrice}
                onChange={(e) => onWholesalePriceChange(e.target.value)}
                placeholder="12.00"
                leading={<span style={{ ...mono, fontSize: "var(--fs-body)" }}>$</span>}
              />
            </Field>
            <Field label="Min order quantity" htmlFor="wholesale-min-qty">
              <Input
                id="wholesale-min-qty"
                mono
                type="number"
                min="1"
                value={wholesaleMinQty}
                onChange={(e) => onWholesaleMinQtyChange(e.target.value)}
                placeholder="12"
              />
            </Field>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <span style={{ ...overline, color: "var(--ink-muted)" }}>Volume tiers</span>
              <Button
                size="sm"
                variant="secondary"
                iconLeft={<Plus size={14} strokeWidth={2} />}
                onClick={onAddPriceTier}
              >
                Add tier
              </Button>
            </div>

            {priceTiers.length === 0 ? (
              <EmptyState
                compact
                title="No tiers"
                description="Without a tier, every wholesale order is billed at the base price."
              />
            ) : (
              <div
                style={{
                  border: "1px solid var(--hairline)",
                  borderRadius: "var(--r-md)",
                  overflow: "hidden",
                  background: "var(--surface)",
                }}
              >
                <div
                  className="hidden min-[900px]:grid"
                  style={{
                    gridTemplateColumns: GRID,
                    ...overline,
                    color: "var(--ink-muted)",
                    background: "var(--surface-sunken)",
                    borderBottom: "1px solid var(--hairline-strong)",
                  }}
                >
                  <div className="flex items-center px-3 h-[34px]">Min qty</div>
                  <div className="flex items-center px-3 h-[34px]">Tier</div>
                  <div className="flex items-center justify-end px-3 h-[34px]">Price / unit</div>
                  <div className="flex items-center justify-end px-3 h-[34px]">Margin</div>
                  <div className="h-[34px]" />
                </div>

                {priceTiers.map((tier, idx) => {
                  const tierMargin =
                    tier.price > 0 ? ((tier.price - calculatedCogs) / tier.price) * 100 : 0;
                  const tone = tierMargin >= 20 ? "success" : tierMargin >= 10 ? "warning" : "danger";
                  return (
                    <div
                      key={idx}
                      className={`${ROW} py-2 min-[900px]:py-0`}
                      style={{
                        gridTemplateColumns: GRID,
                        fontFamily: "var(--font-sans)",
                        fontSize: "var(--fs-body)",
                        color: "var(--ink)",
                        borderBottom:
                          idx < priceTiers.length - 1 ? "1px solid var(--hairline)" : "none",
                      }}
                    >
                      <div className={CELL_R}>
                        <span style={overline} className="min-[900px]:hidden">
                          Min qty
                        </span>
                        <Input
                          size="sm"
                          mono
                          type="number"
                          min="1"
                          value={tier.min_quantity}
                          onChange={(e) => {
                            const u = [...priceTiers];
                            u[idx] = { ...u[idx], min_quantity: parseInt(e.target.value) || 1 };
                            setPriceTiers(u);
                          }}
                          aria-label={`Tier ${idx + 1} minimum quantity`}
                          style={{ width: 88, textAlign: "right" }}
                        />
                      </div>

                      <div className={CELL}>
                        <span style={{ ...sans, color: "var(--ink-muted)" }}>
                          Tier {idx + 1} · {tier.min_quantity}+ units
                        </span>
                      </div>

                      <div className={CELL_R}>
                        <span style={overline} className="min-[900px]:hidden">
                          Price / unit
                        </span>
                        <Input
                          size="sm"
                          mono
                          type="number"
                          step="0.01"
                          min="0"
                          value={tier.price}
                          onChange={(e) => {
                            const u = [...priceTiers];
                            u[idx] = { ...u[idx], price: parseFloat(e.target.value) || 0 };
                            setPriceTiers(u);
                          }}
                          aria-label={`Tier ${idx + 1} price per unit`}
                          leading={<span style={{ ...mono, fontSize: "var(--fs-body)" }}>$</span>}
                          style={{ width: 118, textAlign: "right" }}
                        />
                      </div>

                      <div className={CELL_R}>
                        <span style={overline} className="min-[900px]:hidden">
                          Margin
                        </span>
                        <Badge tone={tone} variant="soft" mono>
                          {tierMargin.toFixed(1)}%
                        </Badge>
                      </div>

                      <div className={`${CELL} justify-end min-[900px]:justify-center`}>
                        <IconButton
                          size="sm"
                          icon={<Trash2 size={14} strokeWidth={2} />}
                          aria-label={`Remove tier ${idx + 1}`}
                          onClick={() => setPriceTiers(priceTiers.filter((_, i) => i !== idx))}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Button
              size="sm"
              variant="primary"
              iconLeft={
                isWholesaleSaving ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Save size={14} strokeWidth={2} />
                )
              }
              onClick={onSaveWholesale}
              disabled={isWholesaleSaving}
            >
              Save wholesale
            </Button>
          </div>
        </div>
      )}
    </Section>
  );
}

"use client";

import { Edit, Scale, Trash2, Warehouse } from "lucide-react";
import { gramsToLbs } from "@/lib/inventory/units";
import { lotValue, stockState } from "@/lib/inventory/valuation";
import type { CoffeeInventory } from "./types";

/**
 * The desktop lot table, moved verbatim out of inventory-client.tsx
 * (CoffeeOS#72 Stage 3).
 *
 * EXTRACTION ONLY — the markup below is byte-identical to what shipped, and the
 * proof is that /inventory's baselines do not move. Stage 4 restyles it to the
 * Instrument worksheet; doing both at once would make a broken behaviour and a
 * changed pixel indistinguishable, which is the discipline /orders established
 * (CoffeeOS#65).
 *
 * The props deliberately keep the CALLER'S names (`filteredInventory`,
 * `openAdjustDialog`, ...) rather than better ones. Renaming them would have
 * meant editing the moved JSX, and an extraction that edits what it moves
 * cannot claim to be an extraction. Stage 4 rewrites this file wholesale and
 * names them properly then.
 *
 * The `md:hidden` card rendering is NOT here: it is a second, duplicate
 * implementation of this same table that Stage 4 deletes outright.
 */
export function InventoryWorksheetTable({
  filteredInventory,
  searchQuery,
  totalGreenLbs,
  totalRoastedLbs,
  totalValue,
  openAdjustDialog,
  openEditDialog,
  handleDelete,
}: {
  filteredInventory: CoffeeInventory[];
  searchQuery: string;
  totalGreenLbs: number;
  totalRoastedLbs: number;
  totalValue: number;
  openAdjustDialog: (coffee: CoffeeInventory) => void;
  openEditDialog: (coffee: CoffeeInventory) => void;
  handleDelete: (id: string) => void;
}) {
  return (
    // Fragment only because the moved block leads with a comment node; it adds
    // no DOM, which is what keeps this extraction pixel-neutral.
    <>
        {/* Desktop */}
        <div className="hidden md:block -mx-5 -mb-5">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b-[2px] border-dashed border-fog">
                <th className="text-left px-5 py-2.5 font-extrabold text-[11px] uppercase tracking-[.08em] text-espresso/60">
                  Coffee
                </th>
                <th className="text-left px-3 py-2.5 font-extrabold text-[11px] uppercase tracking-[.08em] text-espresso/60">
                  Origin
                </th>
                <th className="text-left px-3 py-2.5 font-extrabold text-[11px] uppercase tracking-[.08em] text-espresso/60">
                  Supplier
                </th>
                <th className="text-right px-3 py-2.5 font-extrabold text-[11px] uppercase tracking-[.08em] text-espresso/60">
                  $/lb
                </th>
                <th className="text-right px-3 py-2.5 font-extrabold text-[11px] uppercase tracking-[.08em] text-espresso/60">
                  Green
                </th>
                <th className="text-right px-3 py-2.5 font-extrabold text-[11px] uppercase tracking-[.08em] text-espresso/60">
                  Roasted
                </th>
                <th className="text-right px-3 py-2.5 font-extrabold text-[11px] uppercase tracking-[.08em] text-espresso/60">
                  Value
                </th>
                <th className="w-[100px]" />
              </tr>
            </thead>
            <tbody>
              {filteredInventory.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-5 py-10 text-center text-espresso/50 font-medium"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <Warehouse size={28} strokeWidth={1.5} className="text-espresso/30" />
                      {searchQuery
                        ? "No coffees match your search."
                        : "Nothing here yet. Add your first coffee to get started."}
                    </div>
                  </td>
                </tr>
              ) : (
                <>
                  {filteredInventory.map((coffee, i) => {
                    const greenLbs = gramsToLbs(coffee.current_green_quantity_g);
                    const roastedLbs = gramsToLbs(coffee.roasted_stock_g || 0);
                    const totalCoffeeValue = lotValue(coffee);
                    const isLow = stockState(greenLbs) === "low";
                    return (
                      <tr
                        key={coffee.id}
                        data-testid="lot-row"
                        data-lot-name={coffee.name}
                        className={`border-b border-dashed border-fog/70 hover:bg-cream/60 transition-colors ${
                          i === filteredInventory.length - 1
                            ? "border-b-0"
                            : ""
                        }`}
                      >
                        <td className="px-5 py-3 font-bold text-espresso">
                          {coffee.name}
                        </td>
                        <td className="px-3 py-3 text-espresso/70">
                          {coffee.origin}
                        </td>
                        <td className="px-3 py-3 text-espresso/50">
                          {coffee.supplier || "—"}
                        </td>
                        <td className="px-3 py-3 text-right font-bold text-espresso">
                          ${coffee.price_per_lb.toFixed(2)}
                        </td>
                        <td className="px-3 py-3 text-right">
                          <span
                            data-testid="lot-green"
                            className="font-bold text-espresso"
                          >
                            {greenLbs.toFixed(1)} lbs
                          </span>
                          {isLow && (
                            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full border-[2px] border-espresso bg-sun text-espresso text-[10px] font-extrabold uppercase tracking-[.06em]">
                              Low
                            </span>
                          )}
                        </td>
                        <td
                          data-testid="lot-roasted"
                          className="px-3 py-3 text-right font-bold text-espresso"
                        >
                          {roastedLbs.toFixed(1)} lbs
                        </td>
                        <td
                          data-testid="lot-value"
                          className="px-3 py-3 text-right font-bold text-espresso"
                        >
                          ${totalCoffeeValue.toFixed(2)}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => openAdjustDialog(coffee)}
                              title="Adjust quantity"
                              className="p-1.5 rounded-[8px] text-espresso/60 hover:text-espresso hover:bg-fog/50 transition-colors"
                            >
                              <Scale size={15} strokeWidth={2.2} />
                            </button>
                            <button
                              onClick={() => openEditDialog(coffee)}
                              title="Edit"
                              className="p-1.5 rounded-[8px] text-espresso/60 hover:text-espresso hover:bg-fog/50 transition-colors"
                            >
                              <Edit size={15} strokeWidth={2.2} />
                            </button>
                            <button
                              onClick={() => handleDelete(coffee.id)}
                              title="Delete"
                              className="p-1.5 rounded-[8px] text-espresso/60 hover:text-tomato hover:bg-tomato/10 transition-colors"
                            >
                              <Trash2 size={15} strokeWidth={2.2} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {/* Totals row */}
                  <tr className="bg-cream border-t-[2px] border-espresso">
                    <td
                      colSpan={4}
                      className="px-5 py-3 font-extrabold text-[11px] uppercase tracking-[.08em] text-espresso/60 text-right"
                    >
                      Totals
                    </td>
                    <td
                      data-testid="total-green"
                      className="px-3 py-3 text-right font-extrabold text-espresso"
                    >
                      {totalGreenLbs.toFixed(1)} lbs
                    </td>
                    <td
                      data-testid="total-roasted"
                      className="px-3 py-3 text-right font-extrabold text-espresso"
                    >
                      {totalRoastedLbs.toFixed(1)} lbs
                    </td>
                    <td
                      data-testid="total-value"
                      className="px-3 py-3 text-right font-extrabold text-espresso"
                    >
                      ${totalValue.toFixed(2)}
                    </td>
                    <td />
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
    </>
  );
}

"use client";

/**
 * The grouped component list — desktop grid and mobile card list.
 *
 * CoffeeOS#73 Stage A: lifted out of components-client.tsx with every class
 * string unchanged, so the baseline check at the end of Stage A means what it
 * says. Stage B replaces this file with Worksheet.tsx.
 *
 * Two renderings of the same rows (a `md:hidden` card list and a `hidden
 * md:block` table) is the pattern /products carried before its conversion and
 * deleted during it; the same deletion happens here in Stage B.
 */

import React from "react";
import { Pencil, Trash2, Layers } from "lucide-react";
import { Btn, TypePill } from "./LoudPrimitives";
import { COST_PER_UNIT_DECIMALS, type Component } from "./types";

export function ComponentsTable({
  groupedComponents,
  totalCount,
  onEdit,
  onDelete,
}: {
  groupedComponents: Record<string, Component[]>;
  totalCount: number;
  onEdit: (component: Component) => void;
  onDelete: (id: string) => void;
}) {
  if (Object.keys(groupedComponents).length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-fog/40 border-[3px] border-espresso flex items-center justify-center mb-4">
          <Layers className="h-7 w-7 text-espresso/50" />
        </div>
        <p className="font-body font-extrabold text-sm uppercase tracking-widest text-espresso">
          Nothing here yet
        </p>
        <p className="mt-1 text-xs text-espresso/50 font-body">
          {totalCount === 0
            ? "Add your first component to start tracking costs"
            : "Try adjusting your search"}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {Object.entries(groupedComponents).map(([type, items]) => (
        <div key={type}>
          {/* Group header */}
          <div className="flex items-center gap-2 mb-3">
            <TypePill type={type} />
            <span className="text-xs text-espresso/50 font-body font-bold">
              {items.length}
            </span>
          </div>

          {/* Mobile cards */}
          <div className="space-y-2 md:hidden">
            {items.map((component) => (
              <div
                key={component.id}
                className="bg-cream border-[2.5px] border-espresso rounded-[16px] shadow-[3px_3px_0_#1C0F05] p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-body font-extrabold text-sm text-espresso">
                      {component.name}
                    </p>
                    {component.notes && (
                      <p className="mt-0.5 text-xs text-espresso/50 font-body line-clamp-2">
                        {component.notes}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Btn
                      variant="ghost"
                      size="sm"
                      onClick={() => onEdit(component)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Btn>
                    <Btn
                      variant="ghost"
                      size="sm"
                      onClick={() => onDelete(component.id)}
                      className="text-tomato hover:text-tomato"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Btn>
                  </div>
                </div>
                <p className="mt-2 text-sm font-extrabold font-body text-espresso">
                  ${component.cost_per_unit.toFixed(COST_PER_UNIT_DECIMALS)}/{component.unit}
                </p>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <div className="min-w-[560px]">
              {/* Table header */}
              <div className="grid grid-cols-[minmax(160px,1fr)_minmax(200px,2fr)_160px_80px] gap-x-4 px-4 py-2 border-b-[2px] border-espresso">
                {["Name", "Description", "Cost / Unit", ""].map((h) => (
                  <span
                    key={h}
                    className={`text-[0.6rem] font-extrabold uppercase tracking-widest text-espresso/60 font-body ${h === "Cost / Unit" ? "text-right" : h === "" ? "text-right" : ""}`}
                  >
                    {h}
                  </span>
                ))}
              </div>
              {/* Table rows */}
              {items.map((component, i) => (
                <div
                  key={component.id}
                  className={`grid grid-cols-[minmax(160px,1fr)_minmax(200px,2fr)_160px_80px] gap-x-4 px-4 py-3 items-center ${i < items.length - 1 ? "border-b-[1.5px] border-dashed border-fog" : ""} hover:bg-cream/60 transition-colors`}
                >
                  <span className="font-body font-extrabold text-sm text-espresso truncate">
                    {component.name}
                  </span>
                  <span className="font-body text-sm text-espresso/60 truncate">
                    {component.notes || "—"}
                  </span>
                  <span className="font-body font-extrabold text-sm text-espresso text-right tabular-nums">
                    ${component.cost_per_unit.toFixed(COST_PER_UNIT_DECIMALS)}/{component.unit}
                  </span>
                  <div className="flex items-center justify-end gap-1">
                    <Btn
                      variant="ghost"
                      size="sm"
                      onClick={() => onEdit(component)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Btn>
                    <Btn
                      variant="ghost"
                      size="sm"
                      onClick={() => onDelete(component.id)}
                      className="text-tomato hover:text-tomato"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Btn>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

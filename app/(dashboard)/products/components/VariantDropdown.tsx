"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown } from "lucide-react";
import { calcMargin, MarginPill } from "./margin";
import type { Product } from "./types";

/**
 * Per-variant COGS and margin, moved out of products-client.tsx unchanged
 * (CoffeeOS#69 Stage A). Rendered by both the mobile card list and the desktop
 * table.
 *
 * Was a `renderVariantDropdown(product)` method on the client component; it is a
 * component here because it takes only a product and holds no parent state.
 * Markup is byte-identical.
 *
 * Radix DropdownMenu portals to <body>, i.e. OUTSIDE [data-surface="app"], so
 * when Stage B retokenises this every `var(--token)` inside will resolve to
 * nothing unless the content root carries data-surface="app" (Criterion 22).
 */
export function VariantDropdown({ product }: { product: Product }) {
  const variants = product.variants || [];
  if (variants.length === 0)
    return (
      <span className="text-[11px] text-muted-foreground font-bold uppercase tracking-wide">
        No variants
      </span>
    );
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="inline-flex items-center gap-1.5 h-[28px] px-3 rounded-full border-[2px] border-espresso text-espresso text-[11px] font-extrabold uppercase tracking-[.08em] bg-transparent hover:bg-fog/40 transition-colors">
          {variants.length} variant{variants.length !== 1 ? "s" : ""}
          <ChevronDown size={12} strokeWidth={2.5} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-80 border-[2px] border-espresso rounded-[12px] shadow-flat-md bg-chalk p-0 overflow-hidden"
      >
        <DropdownMenuLabel className="px-4 py-3 border-b-2 border-espresso font-extrabold text-[11px] uppercase tracking-[.1em] bg-cream">
          Variant COGS &amp; Margin
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="hidden" />
        <div className="max-h-80 overflow-y-auto p-3 space-y-2">
          {variants.map((variant) => {
            const margin = calcMargin(variant.price, variant.total_cogs);
            return (
              <div
                key={variant.id}
                className="rounded-[10px] border-[2px] border-espresso bg-cream p-3"
              >
                <p className="text-[13px] font-bold text-espresso">{variant.title}</p>
                {variant.sku && (
                  <p className="font-mono text-[10px] text-muted-foreground mt-0.5">{variant.sku}</p>
                )}
                <div className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
                  <div>
                    <p className="text-muted-foreground font-bold uppercase tracking-wide text-[9px]">
                      Price
                    </p>
                    <p className="font-bold text-espresso">
                      {variant.price ? `$${variant.price.toFixed(2)}` : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground font-bold uppercase tracking-wide text-[9px]">
                      COGS
                    </p>
                    <p className="font-bold text-espresso">
                      {variant.total_cogs ? `$${variant.total_cogs.toFixed(2)}` : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground font-bold uppercase tracking-wide text-[9px]">
                      Margin
                    </p>
                    <div className="mt-0.5">
                      <MarginPill margin={margin} />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

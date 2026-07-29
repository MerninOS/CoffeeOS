"use client";

import Link from "next/link";
import Image from "next/image";
import { Package, Trash2, ExternalLink } from "lucide-react";
import { Btn } from "./primitives";
import { calcMargin, MarginPill } from "./margin";
import { VariantDropdown } from "./VariantDropdown";
import type { Product } from "./types";

/**
 * The desktop table, moved out of products-client.tsx unchanged (CoffeeOS#69
 * Stage A). Paired with ProductsMobileList, which renders the same rows again
 * for narrow viewports — see the note there.
 *
 * Preserved as-is and replaced in Stage B:
 *  - zebra striping via `idx % 2`, which the instrument worksheet drops
 *    outright ("no zebra — hairlines only")
 *  - a `—` in the COGS column for both "no recipe" and "$0 recipe", which
 *    Criteria 2 and 4 split into `not set` (--danger) and a real figure
 *  - the Avg Margin column falling back to `calcMargin(product.price, …)` while
 *    the column beside it shows `min_selling_price`, so the two can disagree for
 *    any product whose variants are priced below `products.price`
 */
export function ProductsTable({
  products,
  onDelete,
}: {
  products: Product[];
  onDelete: (id: string) => void;
}) {
  return (
    <div className="hidden md:block overflow-x-auto">
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr className="border-b-2 border-espresso bg-cream/60">
            {["Product", "SKU", "Min Price", "COGS", "Avg Margin", "Variants", ""].map((h, i) => (
              <th
                key={i}
                className={`py-3 px-4 text-[9.5px] font-extrabold uppercase tracking-[.1em] text-muted-foreground ${
                  i > 1 ? "text-right" : "text-left"
                } ${i === 6 ? "w-20" : ""}`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {products.map((product, idx) => {
            const margin = product.average_margin ?? calcMargin(product.price, product.total_cogs);
            return (
              <tr
                key={product.id}
                className={`border-b border-dashed border-fog last:border-0 hover:bg-cream/60 transition-colors ${
                  idx % 2 === 0 ? "" : "bg-chalk/40"
                }`}
              >
                <td className="py-3 px-4">
                  <div className="flex items-center gap-3">
                    {product.image_url ? (
                      <Image
                        src={product.image_url}
                        alt={product.title}
                        width={36}
                        height={36}
                        className="rounded-[8px] border-[2px] border-espresso object-cover shrink-0"
                      />
                    ) : (
                      <div className="w-9 h-9 shrink-0 rounded-[8px] border-[2px] border-espresso bg-fog flex items-center justify-center">
                        <Package size={15} className="text-muted-foreground" />
                      </div>
                    )}
                    <Link
                      href={`/products/${product.id}`}
                      className="font-bold text-espresso hover:text-tomato transition-colors"
                    >
                      {product.title}
                    </Link>
                  </div>
                </td>
                <td className="py-3 px-4 font-mono text-[12px] text-muted-foreground">
                  {product.sku || "—"}
                </td>
                <td className="py-3 px-4 text-right font-bold text-espresso">
                  {product.min_selling_price != null
                    ? `$${product.min_selling_price.toFixed(2)}`
                    : "—"}
                </td>
                <td className="py-3 px-4 text-right font-bold text-espresso">
                  {product.total_cogs ? `$${product.total_cogs.toFixed(2)}` : "—"}
                </td>
                <td className="py-3 px-4 text-right">
                  <MarginPill margin={margin} />
                </td>
                <td className="py-3 px-4 text-right">
                  <VariantDropdown product={product} />
                </td>
                <td className="py-3 px-4">
                  <div className="flex items-center justify-end gap-1">
                    <Btn
                      variant="ghost"
                      size="sm"
                      href={`/products/${product.id}`}
                      className="!px-2 !h-8"
                    >
                      <ExternalLink size={14} strokeWidth={2} />
                    </Btn>
                    <button
                      onClick={() => onDelete(product.id)}
                      className="inline-flex items-center justify-center w-8 h-8 rounded-full border-[2px] border-transparent text-tomato hover:bg-tomato/10 transition-colors"
                    >
                      <Trash2 size={14} strokeWidth={2} />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

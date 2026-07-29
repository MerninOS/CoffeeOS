"use client";

import Link from "next/link";
import Image from "next/image";
import { Package, Trash2, ExternalLink } from "lucide-react";
import { Btn } from "./primitives";
import { calcMargin, MarginPill } from "./margin";
import { VariantDropdown } from "./VariantDropdown";
import type { Product } from "./types";

/**
 * The `md:hidden` card rendering, moved out of products-client.tsx unchanged
 * (CoffeeOS#69 Stage A).
 *
 * This is a COMPLETE SECOND RENDERING of every row — same data, same actions,
 * different markup from ProductsTable. Seven pages in this app ship a duplicate
 * like it. Criterion 21 deletes it in Stage B in favour of one responsive
 * rendering; extracting it first makes that deletion a file removal rather than
 * a careful excision from the middle of a 766-line component.
 *
 * Its existence is also why the /products/[id] baseline reads the row link's
 * href instead of clicking it: the name matches in both renderings, and the
 * hidden one is not clickable.
 */
export function ProductsMobileList({
  products,
  onDelete,
}: {
  products: Product[];
  onDelete: (id: string) => void;
}) {
  return (
    <div className="md:hidden divide-y-2 divide-fog">
      {products.map((product) => {
        const margin = product.average_margin ?? calcMargin(product.price, product.total_cogs);
        return (
          <div key={product.id} className="p-4 flex flex-col gap-3">
            <div className="flex items-start gap-3">
              {product.image_url ? (
                <Image
                  src={product.image_url}
                  alt={product.title}
                  width={44}
                  height={44}
                  className="shrink-0 rounded-[10px] border-[2px] border-espresso object-cover"
                />
              ) : (
                <div className="w-11 h-11 shrink-0 rounded-[10px] border-[2px] border-espresso bg-fog flex items-center justify-center">
                  <Package size={18} className="text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <Link
                  href={`/products/${product.id}`}
                  className="font-bold text-[14px] text-espresso hover:text-tomato transition-colors leading-snug"
                >
                  {product.title}
                </Link>
                {product.sku && (
                  <p className="font-mono text-[10px] text-muted-foreground mt-0.5">{product.sku}</p>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Btn variant="ghost" size="sm" href={`/products/${product.id}`} className="!px-2 !h-8">
                  <ExternalLink size={14} strokeWidth={2} />
                </Btn>
                <button
                  onClick={() => onDelete(product.id)}
                  className="inline-flex items-center justify-center w-8 h-8 rounded-full border-[2px] border-transparent text-tomato hover:bg-tomato/10 transition-colors"
                >
                  <Trash2 size={14} strokeWidth={2} />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-[12px]">
              <div>
                <span className="text-[9.5px] font-extrabold uppercase tracking-wide text-muted-foreground">
                  Min Price
                </span>
                <p className="font-bold text-espresso mt-0.5">
                  {product.min_selling_price != null
                    ? `$${product.min_selling_price.toFixed(2)}`
                    : "—"}
                </p>
              </div>
              <div>
                <span className="text-[9.5px] font-extrabold uppercase tracking-wide text-muted-foreground">
                  COGS
                </span>
                <p className="font-bold text-espresso mt-0.5">
                  {product.total_cogs ? `$${product.total_cogs.toFixed(2)}` : "—"}
                </p>
              </div>
              <div>
                <span className="text-[9.5px] font-extrabold uppercase tracking-wide text-muted-foreground">
                  Avg Margin
                </span>
                <div className="mt-0.5">
                  <MarginPill margin={margin} />
                </div>
              </div>
            </div>
            <div>
              <VariantDropdown product={product} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

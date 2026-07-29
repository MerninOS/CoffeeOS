"use client";

import Image from "next/image";
import { DollarSign, Loader2, Package, Save } from "lucide-react";
import { Btn, FieldLabel, MerninInput, Panel } from "./primitives";
import type { Product, ProductVariant } from "./types";

/**
 * Product image, the selected-variant mini card and the price editor, moved out
 * of product-detail-client.tsx unchanged (CoffeeOS#69 Stage A). Class strings,
 * icon sizes and stroke widths are byte-identical.
 *
 * `sellingPrice` deliberately stays owned by the parent: a `useEffect` there
 * re-seeds it from the selected variant whenever the variant changes, and that
 * effect must not be split away from the state it drives.
 *
 * Preserved as-is:
 *  - the price `<input>` is uncontrolled-ish in spirit — it holds a raw string
 *    and only validates on save, so a typo sits in the field looking committed
 *  - the save button is icon-only with no accessible name (`<Save>` renders a
 *    bare svg), so screen readers announce it as an unlabelled button
 *  - `priority={false}` is passed explicitly even though it is the default
 */
export function ProductDetailsPanel({
  product,
  isVariantMode,
  selectedVariant,
  sellingPrice,
  onSellingPriceChange,
  onUpdatePrice,
  isPriceUpdating,
}: {
  product: Product;
  isVariantMode: boolean;
  selectedVariant: ProductVariant | null;
  sellingPrice: string;
  onSellingPriceChange: (value: string) => void;
  onUpdatePrice: () => void;
  isPriceUpdating: boolean;
}) {
  return (
    <Panel title="Product Details">
      <div className="flex flex-col gap-4">
        <div className="relative w-full overflow-hidden rounded-[12px] border-[3px] border-espresso bg-fog aspect-[4/3] sm:aspect-square">
          {product.image_url ? (
            <Image
              src={product.image_url}
              alt={product.title}
              fill
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="object-cover"
              priority={false}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Package size={36} strokeWidth={1.5} className="text-muted-foreground" />
            </div>
          )}
        </div>

        {isVariantMode && selectedVariant && (
          <div className="rounded-[10px] border-[2px] border-fog bg-cream p-3">
            <div className="text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground">
              Selected Variant
            </div>
            <div className="font-bold text-[14px] text-espresso mt-0.5">{selectedVariant.title}</div>
            {selectedVariant.sku && (
              <div className="font-mono text-[11px] text-muted-foreground">{selectedVariant.sku}</div>
            )}
          </div>
        )}

        <div>
          <FieldLabel htmlFor="sellingPrice">
            {isVariantMode ? "Variant Price" : "Selling Price"}
          </FieldLabel>
          <div className="flex gap-2">
            <div className="flex-1">
              <MerninInput
                id="sellingPrice"
                type="number"
                step="0.01"
                min="0"
                value={sellingPrice}
                onChange={(e) => onSellingPriceChange(e.target.value)}
                placeholder="0.00"
                prefix={<DollarSign size={15} strokeWidth={2} />}
              />
            </div>
            <Btn
              onClick={onUpdatePrice}
              disabled={isPriceUpdating || (isVariantMode && !selectedVariant)}
              size="icon"
              variant="outline"
            >
              {isPriceUpdating ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} strokeWidth={2} />}
            </Btn>
          </div>
          {isVariantMode && (
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              Updates apply to the selected variant.
            </p>
          )}
        </div>
      </div>
    </Panel>
  );
}

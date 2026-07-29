"use client";

import Image from "next/image";
import { Field, IconButton, Input } from "@merninos/ui/instrument";
import { Loader2, Package, Save } from "lucide-react";
import { mono, sans } from "@/lib/instrument/tokens";
import { Section } from "./Section";
import type { Product, ProductVariant } from "./types";

/**
 * Product image, the selected-variant line and the price editor, on instrument
 * (CoffeeOS#69 Stage B). Retokenized only — no figure and no handler changed.
 *
 * `sellingPrice` deliberately stays owned by the parent: a `useEffect` there
 * re-seeds it from the selected variant whenever the variant changes, and that
 * effect must not be split away from the state it drives.
 *
 * Preserved as-is:
 *  - the price field holds a raw string and only validates on save, so a typo
 *    sits in the field looking committed
 *  - the save control is icon-only. It now carries an `aria-label` via
 *    instrument's `IconButton`, which requires one — the loud version rendered a
 *    bare <svg> in a button and announced as unlabelled.
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
  const priceLabel = isVariantMode ? "Variant price" : "Selling price";

  return (
    <Section title="Product">
      {/* A ROW, not a stack. This block used to be half of a two-column grid
          beside the COGS donut; with the donut gone it became full width, and a
          `width:100%` square image expanded to ~800px of empty canvas with a
          28px icon adrift in the middle. The thumbnail is a fixed 140px now and
          the fields sit beside it. */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "flex-start",
          gap: "var(--space-5)",
        }}
      >
        <div
          style={{
            position: "relative",
            flex: "0 0 140px",
            width: 140,
            aspectRatio: "1 / 1",
            overflow: "hidden",
            borderRadius: "var(--r-md)",
            border: "1px solid var(--hairline)",
            background: "var(--surface-sunken)",
          }}
        >
          {product.image_url ? (
            <Image
              src={product.image_url}
              alt={product.title}
              fill
              sizes="(min-width: 1024px) 300px, 100vw"
              style={{ objectFit: "cover" }}
            />
          ) : (
            <div
              style={{
                display: "flex",
                height: "100%",
                width: "100%",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--ink-subtle)",
              }}
            >
              <Package size={28} strokeWidth={1.5} />
            </div>
          )}
        </div>

        <div
          style={{
            flex: "1 1 320px",
            minWidth: 240,
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-4)",
          }}
        >
        {isVariantMode && selectedVariant && (
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ ...sans, fontWeight: "var(--fw-medium)" as unknown as number }}>
              {selectedVariant.title}
            </span>
            {selectedVariant.sku && (
              <span style={{ ...mono, fontSize: "var(--fs-overline)", color: "var(--ink-subtle)" }}>
                {selectedVariant.sku}
              </span>
            )}
          </div>
        )}

        <Field
          label={priceLabel}
          htmlFor="sellingPrice"
          help={isVariantMode ? "Updates apply to the selected variant." : undefined}
        >
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Input
              id="sellingPrice"
              mono
              type="number"
              step="0.01"
              min="0"
              value={sellingPrice}
              onChange={(e) => onSellingPriceChange(e.target.value)}
              placeholder="0.00"
              leading={<span style={{ ...mono, fontSize: "var(--fs-body)" }}>$</span>}
              style={{ flex: 1, minWidth: 0 }}
            />
            <IconButton
              size="md"
              variant="outline"
              aria-label={`Save ${priceLabel.toLowerCase()}`}
              icon={
                isPriceUpdating ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Save size={14} strokeWidth={2} />
                )
              }
              onClick={onUpdatePrice}
              disabled={isPriceUpdating || (isVariantMode && !selectedVariant)}
            />
          </div>
        </Field>
        </div>
      </div>
    </Section>
  );
}

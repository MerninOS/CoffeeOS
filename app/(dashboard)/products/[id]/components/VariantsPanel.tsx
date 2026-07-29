"use client";

import { Button, EmptyState } from "@merninos/ui/instrument";
import { Layers, Loader2, Plus } from "lucide-react";
import { mono, overline, sans } from "@/lib/instrument/tokens";
import { Section } from "./Section";
import type { ProductVariant } from "./types";

/**
 * The variant picker on instrument (CoffeeOS#69 Stage B). Behaviour is
 * unchanged — a pill row selects the variant whose recipe the rest of the page
 * edits — and only the styling moved.
 *
 * Selection moved to CostingSource in Stage C; this panel now only adds and
 * removes variants.
 *
 * `data-variant-sku` was THE contract for
 * products-capabilities.spec.ts test 6, which proves the page shows the SELECTED
 * variant's cost rather than some blend of both. They stay on a hand-rolled
 * <button> precisely so nothing can swallow them.
 *
 * SELECTED-STATE STYLING. `--brand-soft` with an inset `--brand` edge, not a
 * `--brand` fill: brand red is the live register on this system and never fills
 * a control (Criterion 6). The soft tint plus the hard inset edge is enough to
 * read as chosen at a glance while keeping the saturated red for "needs you".
 *
 * Preserved as-is, and worth fixing later:
 *  - the pill row is a bare <button> list with no `role="tablist"`, no
 *    `aria-selected` and no roving focus. The selected pill now carries
 *    `aria-pressed`, which is the one accessibility affordance added here
 *    because it costs nothing and the alternative is conveying selection by
 *    colour alone.
 *  - Remove variant is still a `window.confirm` in the parent, not a dialog
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
    <Section
      title="Variants"
      note={variants.length > 0 ? "Each variant carries its own recipe." : undefined}
      action={
        <Button
          size="sm"
          variant="secondary"
          iconLeft={<Plus size={14} strokeWidth={2} />}
          onClick={onOpenAddVariant}
        >
          Add variant
        </Button>
      }
    >
      {variants.length === 0 ? (
        <EmptyState
          compact
          icon={<Layers size={20} strokeWidth={1.5} />}
          title="No variants"
          description="This product is costed at product level. Add a variant when two sizes cost different amounts."
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          {/* The pill row moved to CostingSource in Stage C, which selects a
              variant AND shows what each one is billed. Two selectors for one
              thing is worse than one. */}

          {selectedVariant && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
                padding: "8px 12px",
                background: "var(--surface-sunken)",
                border: "1px solid var(--hairline)",
                borderRadius: "var(--r-md)",
              }}
            >
              <span style={{ display: "flex", alignItems: "baseline", gap: 8, minWidth: 0 }}>
                <span style={overline}>Editing</span>
                <span style={{ ...sans, fontWeight: "var(--fw-medium)" as unknown as number }}>
                  {selectedVariant.title}
                </span>
                <span style={{ ...mono, fontSize: "var(--fs-overline)", color: "var(--ink-subtle)" }}>
                  {selectedVariant.sku || "no SKU"}
                </span>
              </span>
              <Button
                size="sm"
                variant="tertiary"
                onClick={onRemoveVariant}
                disabled={isRemovingVariant}
                iconLeft={
                  isRemovingVariant ? <Loader2 size={13} className="animate-spin" /> : undefined
                }
              >
                Remove variant
              </Button>
            </div>
          )}
        </div>
      )}
    </Section>
  );
}

"use client";

import Link from "next/link";
import { Button, EmptyState } from "@merninos/ui/instrument";
import { Loader2, Package, Plus, Save } from "lucide-react";
import { sans } from "@/lib/instrument/tokens";
import { Section } from "./Section";
import { RecipeTable } from "./RecipeTable";
import type { Component, SelectedComponent } from "./types";

/**
 * The recipe editor's frame (CoffeeOS#69 Stage B): the section rule, the two
 * empty states, the add control and the save footer. The rows themselves moved
 * to RecipeTable, which is where the `sm:hidden` card list and the
 * `hidden sm:block` table collapsed into one rendering (Criterion 21).
 *
 * The loud `Panel` is gone with the rest of primitives.tsx — this is a ruled
 * `Section` on the page surface, not a card.
 *
 * `recipe-add` and `recipe-save` are forwarded through instrument's `Button`,
 * which spreads `...rest` onto the <button>. They are the seams
 * products-capabilities.spec.ts drives every write through, so they are passed
 * explicitly rather than assumed.
 *
 * Preserved as-is — this commit changes appearance only:
 *  - "Add component" is disabled once every available component is used, which
 *    is also what prevents adding the same component twice
 *  - saving is gated on `isVariantMode && !selectedVariantId`, and the failure
 *    surfaces as a toast rather than inline
 */
export function CogsCalculator({
  availableComponents,
  selectedComponents,
  isVariantMode,
  selectedVariantId,
  isSaving,
  onAddComponent,
  onRemoveComponent,
  onUpdateComponent,
  onSaveComponents,
}: {
  availableComponents: Component[];
  selectedComponents: SelectedComponent[];
  isVariantMode: boolean;
  selectedVariantId: string;
  isSaving: boolean;
  onAddComponent: () => void;
  onRemoveComponent: (i: number) => void;
  onUpdateComponent: (i: number, field: keyof SelectedComponent, value: string | number) => void;
  onSaveComponents: () => void;
}) {
  const nothingLeftToAdd =
    availableComponents.length === 0 || selectedComponents.length >= availableComponents.length;

  return (
    <Section
      title="Recipe"
      note={
        isVariantMode
          ? "Every line below belongs to the selected variant."
          : "Unit COGS is the sum of these lines."
      }
      action={
        <Button
          data-testid="recipe-add"
          size="sm"
          variant="secondary"
          iconLeft={<Plus size={14} strokeWidth={2} />}
          onClick={onAddComponent}
          disabled={nothingLeftToAdd}
        >
          Add component
        </Button>
      }
    >
      {availableComponents.length === 0 ? (
        <EmptyState
          icon={<Package size={20} strokeWidth={1.5} />}
          title="No components to cost with"
          description="A recipe is built from components — coffee, packaging, labor. Create them first and they become addable here."
          action={
            <Link href="/components" style={{ textDecoration: "none" }}>
              <Button variant="secondary" size="sm">
                Create components
              </Button>
            </Link>
          }
        />
      ) : selectedComponents.length === 0 ? (
        <EmptyState
          icon={<Package size={20} strokeWidth={1.5} />}
          title="No recipe yet"
          description="Until this product has one its COGS is $0, and every margin quoting it is wrong."
          action={
            <Button
              size="sm"
              variant="secondary"
              iconLeft={<Plus size={14} strokeWidth={2} />}
              onClick={onAddComponent}
              disabled={nothingLeftToAdd}
            >
              Add the first component
            </Button>
          }
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <RecipeTable
            availableComponents={availableComponents}
            selectedComponents={selectedComponents}
            onRemoveComponent={onRemoveComponent}
            onUpdateComponent={onUpdateComponent}
          />
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <span style={{ ...sans, fontSize: "var(--fs-caption)", color: "var(--ink-muted)" }}>
              Edits are local until saved.
            </span>
            {/* The Save button moved to the unsaved-changes bar in Stage C.
                Two save affordances is one too many — and pinned to the bottom
                of the viewport, the bar physically covered this one at 375px,
                which is how the variant-save test started failing with
                "<div> intercepts pointer events". One save, and it appears only
                when there is something to save. */}
          </div>
        </div>
      )}
    </Section>
  );
}

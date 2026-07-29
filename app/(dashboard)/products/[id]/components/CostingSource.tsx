"use client";

import { Badge, InlineBanner, SegmentedControl } from "@merninos/ui/instrument";
import { mono, overline, sans, money, money3 } from "@/lib/instrument/tokens";
import { Section } from "./Section";
import type { ProductVariant } from "./types";

/**
 * Which recipe basis a product is BILLED from — the resolution CoffeeOS#69 was
 * written for.
 *
 * The defect this replaces: `isVariantMode = variants.length > 0` meant that the
 * moment a product had variants, its product-level recipe became unreachable in
 * the UI — while orders/page.tsx still preferred exactly that recipe when
 * costing a line item. The operator edited one number and the invoice used
 * another, with nothing on screen saying so.
 *
 * Reporting the conflict in a banner was not enough on its own, because the
 * ignored recipe still rendered as a live figure beside it. So the rule this
 * section enforces is stronger:
 *
 *   THE TOGGLE IS THE AUTHORITY, AND EVERY FIGURE ON THE PAGE IS THE FIGURE AN
 *   INVOICE WOULD USE.
 *
 * The unbilled basis stays visible and editable — hiding it would recreate the
 * "where did my recipe go" problem this ticket exists to fix — but renders
 * inert: `--ink-subtle`, labelled `not billed`, never a Badge. A Badge reads as
 * a live status, which is the opposite of what it is.
 *
 * The toggle DEFERS its write. Flipping it re-costs every order line for the
 * product, so it joins the dirty state and lands on an explicit Save; a stray
 * click must not silently change historic margin.
 *
 * Combines the plan's `CostingSource` and `VariantBasisTable` into one file:
 * the toggle, the banner and the per-variant table are a single section and
 * splitting them would mean threading the same six props through two components.
 */

/** Variant | Recipe | Price | Billed COGS | Margin */
const VGRID = "minmax(0,1fr) 132px 108px 132px 96px";
const VROW = "flex flex-col min-[900px]:grid";
const VCELL = "flex items-center px-3 py-1.5 min-[900px]:py-0 min-[900px]:h-10";
const VCELL_R = `${VCELL} justify-between min-[900px]:justify-end`;

/** An inert marker. Deliberately NOT a Badge — a badge reads as a live status,
 *  and the whole point is that this recipe is stored and not billed. */
function Inert({ children }: { children: React.ReactNode }) {
  return <span style={{ ...overline, color: "var(--ink-subtle)" }}>{children}</span>;
}

export function CostingSource({
  mode,
  onModeChange,
  variants,
  selectedVariantId,
  onSelectVariant,
  productRecipeCogs,
  billedFor,
  variantHasOwnRecipe,
  storedUnusedCount,
}: {
  mode: "product" | "variant";
  onModeChange: (next: "product" | "variant") => void;
  variants: ProductVariant[];
  selectedVariantId: string;
  onSelectVariant: (id: string) => void;
  productRecipeCogs: number | null;
  /** THE billed figure. One expression, shared with the hero and the wholesale
   *  tiers, so the page cannot show three numbers for one cost. */
  billedFor: (v: ProductVariant) => number | null;
  variantHasOwnRecipe: (v: ProductVariant) => boolean;
  storedUnusedCount: number;
}) {
  const productMode = mode === "product";

  return (
    <Section
      title="Costing source"
      note="Orders cost a line item from whichever basis is selected here. The other one stays stored, and is not billed."
    >
      <div style={{ display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
        <SegmentedControl
          value={mode}
          onChange={(v) => onModeChange(v as "product" | "variant")}
          options={[
            { value: "product", label: "One recipe" },
            { value: "variant", label: "Per variant" },
          ]}
        />
        <p
          style={{
            ...sans,
            fontSize: "var(--fs-caption)",
            color: "var(--ink-muted)",
            flex: "1 1 320px",
            minWidth: 240,
            margin: 0,
          }}
          data-testid="costing-source-explainer"
        >
          {productMode
            ? productRecipeCogs === null
              ? "There is no product-level recipe yet, so nothing can be costed in this mode. Add one, or switch to Per variant."
              : `One recipe costs all ${variants.length} variant${variants.length === 1 ? "" : "s"} at ${money3(productRecipeCogs)}.`
            : "Each variant carries its own recipe. A variant with none inherits the product recipe — if there is one."}
        </p>
      </div>

      {storedUnusedCount > 0 && (
        <div style={{ marginTop: "var(--space-4)" }} data-testid="unbilled-basis-banner">
          <InlineBanner
            tone="warning"
            title={
              productMode
                ? `${storedUnusedCount} variant recipe${storedUnusedCount === 1 ? " is" : "s are"} stored but not billed`
                : "A product-level recipe is stored but not billed"
            }
          >
            {productMode
              ? "They are shown below in grey. Switch to Per variant to bill from them, or delete them so the two cannot drift."
              : `The product-level recipe${productRecipeCogs === null ? "" : ` (${money3(productRecipeCogs)})`} is kept but ignored while variants carry their own.`}
          </InlineBanner>
        </div>
      )}

      {variants.length > 0 && (
        <div
          style={{
            marginTop: "var(--space-4)",
            border: "1px solid var(--hairline)",
            borderRadius: "var(--r-md)",
            overflow: "hidden",
            background: "var(--surface)",
          }}
        >
          <div
            className="hidden min-[900px]:grid"
            style={{
              gridTemplateColumns: VGRID,
              ...overline,
              color: "var(--ink-muted)",
              background: "var(--surface-sunken)",
              borderBottom: "1px solid var(--hairline-strong)",
            }}
          >
            <div className="flex items-center px-3 h-[34px]">Variant</div>
            <div className="flex items-center px-3 h-[34px]">Recipe</div>
            <div className="flex items-center justify-end px-3 h-[34px]">Price</div>
            <div className="flex items-center justify-end px-3 h-[34px]">Billed COGS</div>
            <div className="flex items-center justify-end px-3 h-[34px]">Margin</div>
          </div>

          {variants.map((v, i) => {
            const cogs = billedFor(v);
            // Margin is WITHHELD when the cost is unknowable — it is wholly
            // derived from the missing number, so a figure would be invented,
            // not merely uncertain.
            const vm = v.price && cogs !== null ? ((v.price - cogs) / v.price) * 100 : null;
            const selected = !productMode && v.id === selectedVariantId;
            const own = variantHasOwnRecipe(v);
            const figure: React.CSSProperties = { ...mono, fontSize: "var(--fs-data)" };
            return (
              <div
                key={v.id}
                data-testid="variant-basis-row"
                data-variant-sku={v.sku ?? ""}
                onClick={productMode ? undefined : () => onSelectVariant(v.id)}
                role={productMode ? undefined : "button"}
                tabIndex={productMode ? undefined : 0}
                className={`${VROW} py-2 min-[900px]:py-0`}
                style={{
                  gridTemplateColumns: VGRID,
                  cursor: productMode ? "default" : "pointer",
                  background: selected ? "var(--brand-soft)" : "transparent",
                  boxShadow: selected ? "inset 2px 0 0 var(--brand)" : "none",
                  borderBottom: i < variants.length - 1 ? "1px solid var(--hairline)" : "none",
                  fontFamily: "var(--font-sans)",
                  fontSize: "var(--fs-body)",
                  color: "var(--ink)",
                }}
              >
                <div className={`${VCELL} gap-2.5 min-w-0`}>
                  <span style={{ fontWeight: selected ? 600 : 400, whiteSpace: "nowrap" }}>{v.title}</span>
                  <span
                    style={{
                      ...mono,
                      fontSize: "var(--fs-overline)",
                      color: "var(--ink-subtle)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {v.sku}
                  </span>
                </div>

                <div className={VCELL}>
                  <span style={overline} className="min-[900px]:hidden">
                    Recipe
                  </span>
                  {productMode ? (
                    <Inert>{own ? "not billed" : "—"}</Inert>
                  ) : (
                    <Badge tone="neutral" variant="soft">
                      {own ? "Override" : "Inherits"}
                    </Badge>
                  )}
                </div>

                <div className={VCELL_R}>
                  <span style={overline} className="min-[900px]:hidden">
                    Price
                  </span>
                  <span style={figure}>{v.price != null ? money(v.price) : "—"}</span>
                </div>

                <div className={VCELL_R}>
                  <span style={overline} className="min-[900px]:hidden">
                    Billed COGS
                  </span>
                  <span
                    style={cogs === null ? { ...figure, color: "var(--danger)" } : figure}
                    data-testid="variant-billed-cogs"
                  >
                    {cogs === null ? "not set" : money3(cogs)}
                  </span>
                </div>

                <div className={VCELL_R}>
                  <span style={overline} className="min-[900px]:hidden">
                    Margin
                  </span>
                  <span style={figure}>{vm === null ? "—" : `${vm.toFixed(1)}%`}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Section>
  );
}

/**
 * The stored, unbilled basis — visible and readable, unmistakably not live.
 * Rendered through the SAME RecipeTable as the billed one, so the two cannot
 * total differently.
 */
export function StoredRecipesHeading({ title, sku }: { title: string; sku: string | null }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 8 }}>
      <span style={{ ...sans, color: "var(--ink-muted)" }}>{title}</span>
      {sku && (
        <span style={{ ...mono, fontSize: "var(--fs-overline)", color: "var(--ink-subtle)" }}>{sku}</span>
      )}
      <Inert>not billed</Inert>
    </div>
  );
}

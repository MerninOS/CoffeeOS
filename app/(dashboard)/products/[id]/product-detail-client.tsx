"use client";

import { useEffect, useMemo, useState } from "react";
import {
  createProductVariant,
  deleteProductVariant,
  updateProductComponents,
  updateProductPrice,
  updateProductVariantPrice,
  updateProductVariantComponents,
  updateProductCostingMode,
  updateWholesalePricing,
} from "./actions";
import Link from "next/link";
import { HeroMetric, InlineBanner, StatStrip } from "@merninos/ui/instrument";
import { ArrowLeft } from "lucide-react";
import { mono, sans, money, money3 } from "@/lib/instrument/tokens";
import { VariantsPanel } from "./components/VariantsPanel";
import { CostingSource, StoredRecipesHeading } from "./components/CostingSource";
import { RecipeTable } from "./components/RecipeTable";
import { Section } from "./components/Section";
import { ProductDetailsPanel } from "./components/ProductDetailsPanel";
import { CogsCalculator } from "./components/CogsCalculator";
import { WholesalePanel } from "./components/WholesalePanel";
import { AddVariantDialog } from "./components/AddVariantDialog";
import type {
  Component,
  Product,
  ProductComponent,
  ProductVariant,
  ProductVariantComponent,
  SelectedComponent,
  WholesaleTier,
} from "./components/types";

/**
 * CoffeeOS#69 Stage A: this component was 972 lines. The primitives, the
 * variants panel, the stat tiles, the product/COGS panels, the recipe editor,
 * the wholesale block and the add-variant dialog moved into ./components with
 * their markup BYTE-IDENTICAL. Nothing was improved on the way out — Stage A's
 * proof is that the visual baselines do not move, and a broken behaviour is only
 * distinguishable from a changed pixel if exactly one of them can happen at a
 * time.
 *
 * What is left here is what actually belongs here: all the state, the derived
 * values, the server-action handlers, the header, the toast and composition.
 * State was NOT pushed down into the children — several of these values feed
 * three panels at once (`calculatedCogs` alone feeds the tiles, the donut, the
 * wholesale margin and every tier margin), so ownership stays at the top.
 *
 * Behaviour preserved deliberately, and changed in later stages:
 *  - money is `fmt`'s THREE decimals nearly everywhere, but the wholesale
 *    "Profit: $…" line is `toFixed(2)` — the page disagrees with itself, and the
 *    sibling list page uses two decimals throughout (see components/primitives.tsx)
 *  - three different margin threshold sets are live at once: 30/15 on the stat
 *    tiles, 20/10 on the wholesale tiers, 30/15 again on the list page's pill
 *  - Remove Variant is a `window.confirm`, not a dialog
 *  - `handleSaveComponents`, `handleUpdatePrice` and `handleSaveWholesale` all
 *    write into the same single `message` toast, so the last action wins and
 *    nothing ever clears it on a timer
 *  - the `useEffect` that re-seeds `sellingPrice` fires on `selectedVariant?.id`
 *    AND `selectedVariant?.price`, so a successful price save round-trips
 *    through state and overwrites whatever the user has typed since
 *  - `handleUpdatePrice` updates local `variants` optimistically but never
 *    refreshes `product.price`, so leaving variant mode shows a stale figure
 */
export function ProductDetailClient({
  product,
  availableComponents,
  productComponents: initialProductComponents,
  productVariants,
  productVariantComponents: initialVariantComponents,
  wholesaleTiers: initialWholesaleTiers,
}: {
  product: Product;
  availableComponents: Component[];
  productComponents: ProductComponent[];
  productVariants: ProductVariant[];
  productVariantComponents: ProductVariantComponent[];
  wholesaleTiers: WholesaleTier[];
}) {
  const [variants, setVariants] = useState<ProductVariant[]>(productVariants);
  const [defaultSelectedComponents, setDefaultSelectedComponents] = useState<SelectedComponent[]>(
    initialProductComponents.map((pc) => ({ componentId: pc.component_id, quantity: pc.quantity }))
  );
  const [selectedVariantId, setSelectedVariantId] = useState<string>(productVariants[0]?.id || "");
  const [variantComponentMap, setVariantComponentMap] = useState<Record<string, SelectedComponent[]>>(() => {
    const grouped: Record<string, SelectedComponent[]> = {};
    for (const vc of initialVariantComponents) {
      if (!grouped[vc.product_variant_id]) grouped[vc.product_variant_id] = [];
      grouped[vc.product_variant_id].push({ componentId: vc.component_id, quantity: vc.quantity });
    }
    return grouped;
  });

  const [sellingPrice, setSellingPrice] = useState(product.price?.toString() || "");
  const [isSaving, setIsSaving] = useState(false);
  const [isPriceUpdating, setIsPriceUpdating] = useState(false);
  const [isAddingVariant, setIsAddingVariant] = useState(false);
  const [isRemovingVariant, setIsRemovingVariant] = useState(false);
  const [isAddVariantDialogOpen, setIsAddVariantDialogOpen] = useState(false);
  const [newVariantTitle, setNewVariantTitle] = useState("");
  const [newVariantSku, setNewVariantSku] = useState("");
  const [newVariantPrice, setNewVariantPrice] = useState(product.price?.toString() || "");
  const [newVariantCopySource, setNewVariantCopySource] = useState<string>(
    productVariants.length === 0 && initialProductComponents.length > 0
      ? "product"
      : productVariants[0]
        ? `variant:${productVariants[0].id}`
        : "none"
  );
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  /**
   * CoffeeOS#69 Criterion 9 — the page opens on the STORED costing_mode, not on
   * `variants.length > 0`. A product carrying both bases backfilled to
   * 'product', which is what Orders bills, so it opens on One recipe.
   *
   * `modeDirty` keeps the toggle out of the database until an explicit Save:
   * flipping it re-costs every order line for this product.
   */
  const [mode, setMode] = useState<"product" | "variant">(
    product.costing_mode === "variant" ? "variant" : "product"
  );
  const [modeDirty, setModeDirty] = useState(false);

  // Wholesale
  const [wholesaleEnabled, setWholesaleEnabled] = useState(product.wholesale_enabled || false);
  const [wholesalePrice, setWholesalePrice] = useState(product.wholesale_price?.toString() || "");
  const [wholesaleMinQty, setWholesaleMinQty] = useState(product.wholesale_minimum_qty?.toString() || "1");
  const [priceTiers, setPriceTiers] = useState<Array<{ min_quantity: number; price: number }>>(
    initialWholesaleTiers.map((t) => ({ min_quantity: t.min_quantity, price: t.price }))
  );
  const [isWholesaleSaving, setIsWholesaleSaving] = useState(false);

  // The toggle is the authority. This used to be `variants.length > 0`, which
  // is what made a product's own recipe unreachable the moment it had variants.
  const isVariantMode = mode === "variant";
  const selectedVariant = variants.find((v) => v.id === selectedVariantId) || null;

  const variantOwnRows = (variantId: string) => variantComponentMap[variantId] ?? null;

  const selectedComponents = useMemo(() => {
    if (!isVariantMode) return defaultSelectedComponents;
    if (!selectedVariantId) return defaultSelectedComponents;
    // Inherit rather than show an empty editor: a variant with no rows of its
    // own is costed from the product recipe, which is exactly what
    // lib/products/costing.ts bills for it.
    return variantComponentMap[selectedVariantId] ?? defaultSelectedComponents;
  }, [isVariantMode, defaultSelectedComponents, selectedVariantId, variantComponentMap]);

  const setSelectedComponents = (components: SelectedComponent[]) => {
    if (!isVariantMode) { setDefaultSelectedComponents(components); return; }
    if (!selectedVariantId) return;
    setVariantComponentMap((prev) => ({ ...prev, [selectedVariantId]: components }));
  };

  useEffect(() => {
    if (isVariantMode) { setSellingPrice(selectedVariant?.price?.toString() || ""); return; }
    setSellingPrice(product.price?.toString() || "");
  }, [isVariantMode, product.price, selectedVariant?.id, selectedVariant?.price]);

  const calculatedCogs = useMemo(() =>
    selectedComponents.reduce((sum, sc) => {
      const comp = availableComponents.find((c) => c.id === sc.componentId);
      return comp ? sum + sc.quantity * comp.cost_per_unit : sum;
    }, 0),
    [selectedComponents, availableComponents]
  );

  const totalOf = (rows: SelectedComponent[]) =>
    rows.reduce((sum, sc) => {
      const comp = availableComponents.find((c) => c.id === sc.componentId);
      return comp ? sum + sc.quantity * comp.cost_per_unit : sum;
    }, 0);

  const productRecipeCogs = useMemo(
    () => totalOf(defaultSelectedComponents),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [defaultSelectedComponents, availableComponents]
  );

  const variantHasOwnRecipe = (v: ProductVariant) => (variantOwnRows(v.id)?.length ?? 0) > 0;

  /**
   * THE BILLED FIGURE — one expression, read by the hero, the variant table and
   * the wholesale tiers. Three separate COGS implementations already exist in
   * this codebase; adding a mode switch on top of that is how a page ends up
   * showing four numbers for one cost.
   */
  const billedFor = (v: ProductVariant) =>
    isVariantMode && variantHasOwnRecipe(v) ? totalOf(variantOwnRows(v.id)!) : productRecipeCogs;

  /** How many recipes are stored on the basis that is NOT being billed. */
  const storedUnusedCount = isVariantMode
    ? defaultSelectedComponents.length > 0
      ? 1
      : 0
    : variants.filter(variantHasOwnRecipe).length;

  const priceValue = parseFloat(sellingPrice) || 0;
  const margin = priceValue > 0 ? ((priceValue - calculatedCogs) / priceValue) * 100 : 0;
  const profit = priceValue - calculatedCogs;
  const wholesalePriceValue = parseFloat(wholesalePrice) || 0;
  const wholesaleMargin = wholesalePriceValue > 0 ? ((wholesalePriceValue - calculatedCogs) / wholesalePriceValue) * 100 : 0;


  const addComponent = () => {
    const unused = availableComponents.find((c) => !selectedComponents.some((sc) => sc.componentId === c.id));
    if (unused) setSelectedComponents([...selectedComponents, { componentId: unused.id, quantity: 1 }]);
  };

  const removeComponent = (i: number) => setSelectedComponents(selectedComponents.filter((_, idx) => idx !== i));

  const updateComponent = (i: number, field: keyof SelectedComponent, value: string | number) => {
    const updated = [...selectedComponents];
    updated[i] = { ...updated[i], [field]: value };
    setSelectedComponents(updated);
  };

  const persistModeIfDirty = async () => {
    if (!modeDirty) return null;
    const r = await updateProductCostingMode(product.id, mode);
    if (!r.error) setModeDirty(false);
    return r.error ?? null;
  };

  const handleSaveComponents = async () => {
    if (isVariantMode && !selectedVariantId) { setMessage({ type: "error", text: "Select a variant first" }); return; }
    setIsSaving(true); setMessage(null);

    // The costing-source choice rides along with the recipe save rather than
    // firing on the toggle — flipping it re-costs every order line for this
    // product, so it needs an explicit, deliberate Save. Sequential and
    // stop-on-first-error: if the mode write fails there is no point writing
    // rows against a basis that did not take.
    const modeError = await persistModeIfDirty();
    if (modeError) {
      setMessage({ type: "error", text: modeError });
      setIsSaving(false);
      return;
    }

    const result = isVariantMode
      ? await updateProductVariantComponents(product.id, selectedVariantId, selectedComponents)
      : await updateProductComponents(product.id, selectedComponents);
    setMessage(result.error ? { type: "error", text: result.error } : { type: "success", text: isVariantMode ? "Variant COGS saved." : "Components saved." });
    setIsSaving(false);
  };

  const handleAddVariant = async () => {
    const title = newVariantTitle.trim();
    const parsedPrice = newVariantPrice.trim() ? parseFloat(newVariantPrice) : null;
    if (!title) { setMessage({ type: "error", text: "Variant title is required" }); return; }
    if (newVariantPrice.trim() && (parsedPrice === null || Number.isNaN(parsedPrice) || parsedPrice < 0)) {
      setMessage({ type: "error", text: "Please enter a valid variant price" }); return;
    }
    setIsAddingVariant(true); setMessage(null);
    const copyFromVariantId = newVariantCopySource.startsWith("variant:") ? newVariantCopySource.replace("variant:", "") : null;
    const copyFromProductCogs = newVariantCopySource === "product";
    const result = await createProductVariant(product.id, { title, sku: newVariantSku.trim() || null, price: parsedPrice }, { copyFromVariantId, copyFromProductCogs });
    if (result.error || !result.variant) { setMessage({ type: "error", text: result.error || "Failed to add variant" }); setIsAddingVariant(false); return; }
    setVariants((prev) => [...prev, result.variant]);
    const copiedComponents = copyFromProductCogs ? defaultSelectedComponents : copyFromVariantId ? (variantComponentMap[copyFromVariantId] || []) : [];
    setVariantComponentMap((prev) => ({ ...prev, [result.variant.id]: copiedComponents.map((item) => ({ ...item })) }));
    setSelectedVariantId(result.variant.id);
    setNewVariantTitle(""); setNewVariantSku(""); setNewVariantPrice(result.variant.price?.toString() || "");
    setNewVariantCopySource(`variant:${result.variant.id}`);
    setMessage({ type: "success", text: "Variant added." }); setIsAddVariantDialogOpen(false); setIsAddingVariant(false);
  };

  const handleUpdatePrice = async () => {
    const price = parseFloat(sellingPrice);
    if (isNaN(price) || price < 0) { setMessage({ type: "error", text: "Please enter a valid price" }); return; }
    setIsPriceUpdating(true); setMessage(null);
    const result = isVariantMode && selectedVariant
      ? await updateProductVariantPrice(product.id, selectedVariant.id, price)
      : await updateProductPrice(product.id, price);
    if (result.error) { setMessage({ type: "error", text: result.error }); }
    else {
      if (isVariantMode && selectedVariant) setVariants((prev) => prev.map((v) => v.id === selectedVariant.id ? { ...v, price } : v));
      setMessage({ type: "success", text: isVariantMode ? "Variant price updated." : "Price updated." });
    }
    setIsPriceUpdating(false);
  };

  const handleRemoveVariant = async () => {
    if (!selectedVariant) { setMessage({ type: "error", text: "Select a variant to remove" }); return; }
    if (!window.confirm(`Remove variant "${selectedVariant.title}"? This will also delete its COGS assignments.`)) return;
    setIsRemovingVariant(true); setMessage(null);
    const variantIdToDelete = selectedVariant.id;
    const result = await deleteProductVariant(product.id, variantIdToDelete);
    if (result.error) { setMessage({ type: "error", text: result.error }); setIsRemovingVariant(false); return; }
    const updatedVariants = variants.filter((v) => v.id !== variantIdToDelete);
    setVariants(updatedVariants);
    setVariantComponentMap((prev) => { const next = { ...prev }; delete next[variantIdToDelete]; return next; });
    setSelectedVariantId(updatedVariants[0]?.id || "");
    if (newVariantCopySource === `variant:${variantIdToDelete}`) {
      setNewVariantCopySource(defaultSelectedComponents.length > 0 ? "product" : updatedVariants[0] ? `variant:${updatedVariants[0].id}` : "none");
    }
    setMessage({ type: "success", text: "Variant removed." }); setIsRemovingVariant(false);
  };

  const addPriceTier = () => {
    const last = priceTiers[priceTiers.length - 1];
    setPriceTiers([...priceTiers, { min_quantity: last ? last.min_quantity + 10 : 10, price: last ? Math.round(last.price * 0.95 * 100) / 100 : Math.round(priceValue * 0.8 * 100) / 100 }]);
  };

  const handleSaveWholesale = async () => {
    setIsWholesaleSaving(true); setMessage(null);
    const result = await updateWholesalePricing(product.id, { wholesale_enabled: wholesaleEnabled, wholesale_price: wholesalePrice ? parseFloat(wholesalePrice) : null, wholesale_minimum_qty: parseInt(wholesaleMinQty) || 1, price_tiers: priceTiers });
    setMessage(result.error ? { type: "error", text: result.error } : { type: "success", text: "Wholesale pricing saved." });
    setIsWholesaleSaving(false);
  };

  return (
    <div style={{ maxWidth: "var(--content-max)", margin: "0 auto", padding: "var(--space-6)" }}>
      {/* Header */}
      <div style={{ marginBottom: "var(--space-5)" }}>
        <Link
          href="/products"
          style={{
            ...sans,
            fontSize: "var(--fs-caption)",
            color: "var(--ink-muted)",
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            marginBottom: 8,
          }}
        >
          <ArrowLeft size={14} strokeWidth={2} />
          All products
        </Link>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontVariationSettings: "var(--display-settings)",
            fontWeight: "var(--display-weight)" as unknown as number,
            letterSpacing: "var(--display-tracking)",
            fontSize: "var(--fs-display)",
            textTransform: "uppercase",
            color: "var(--ink)",
            margin: 0,
          }}
        >
          {product.title}
        </h1>
        <p style={{ ...mono, fontSize: "var(--fs-caption)", color: "var(--ink-subtle)", marginTop: 6, marginBottom: 0 }}>
          {[product.sku, `${variants.length} variant${variants.length === 1 ? "" : "s"}`]
            .filter(Boolean)
            .join(" \u00b7 ")}
        </p>
      </div>

      {message && (
        <div style={{ marginBottom: "var(--space-4)" }} data-testid="detail-toast">
          <InlineBanner
            tone={message.type === "error" ? "danger" : "success"}
            onDismiss={() => setMessage(null)}
          >
            {message.text}
          </InlineBanner>
        </div>
      )}

      {/* One hero + one ruled strip. Replaces four equal stat tiles — the
          worksheet model has exactly one figure at display scale (Criterion 18).
          The donut that used to sit beside these is gone: share is read off the
          recipe table now, which also means no chart needs a colour ramp this
          product has no data for. */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "var(--space-6)",
          alignItems: "end",
          marginBottom: "var(--space-2)",
        }}
      >
        <div style={{ flex: "0 0 280px" }}>
          <HeroMetric
            label="Unit COGS"
            // The test id goes on the VALUE, not the component: HeroMetric
            // destructures its props and would drop a data-testid silently, and
            // wrapping the whole metric would put the label and note inside the
            // element the specs parse a number out of. `value` is a ReactNode,
            // so the seam sits on exactly the figure.
            value={<span data-testid="stat-total-cogs">{money3(calculatedCogs)}</span>}
            note={isVariantMode && selectedVariant ? selectedVariant.title : "all units"}
          />
        </div>
        <div style={{ flex: "1 1 460px", minWidth: 0 }}>
          <StatStrip
            stats={[
              { label: isVariantMode ? "Variant price" : "Price", value: money(priceValue) },
              { label: "Profit \u00b7 unit", value: money3(profit) },
              { label: "Margin", value: margin.toFixed(1), unit: "%" },
              { label: "Components", value: String(selectedComponents.length) },
            ]}
          />
        </div>
      </div>

      <CostingSource
        mode={mode}
        onModeChange={(next) => {
          setMode(next);
          setModeDirty(true);
        }}
        variants={variants}
        selectedVariantId={selectedVariantId}
        onSelectVariant={setSelectedVariantId}
        productRecipeCogs={productRecipeCogs}
        billedFor={billedFor}
        variantHasOwnRecipe={variantHasOwnRecipe}
        storedUnusedCount={storedUnusedCount}
      />

      <VariantsPanel
        variants={variants}
        selectedVariantId={selectedVariantId}
        selectedVariant={selectedVariant}
        onSelectVariant={setSelectedVariantId}
        onOpenAddVariant={() => setIsAddVariantDialogOpen(true)}
        onRemoveVariant={handleRemoveVariant}
        isRemovingVariant={isRemovingVariant}
      />

      <ProductDetailsPanel
        product={product}
        isVariantMode={isVariantMode}
        selectedVariant={selectedVariant}
        sellingPrice={sellingPrice}
        onSellingPriceChange={setSellingPrice}
        onUpdatePrice={handleUpdatePrice}
        isPriceUpdating={isPriceUpdating}
      />

      <CogsCalculator
        availableComponents={availableComponents}
        selectedComponents={selectedComponents}
        isVariantMode={isVariantMode}
        selectedVariantId={selectedVariantId}
        isSaving={isSaving}
        onAddComponent={addComponent}
        onRemoveComponent={removeComponent}
        onUpdateComponent={updateComponent}
        onSaveComponents={handleSaveComponents}
      />

      {storedUnusedCount > 0 && (
        <Section
          title={isVariantMode ? "Stored product recipe" : "Stored variant recipes"}
          note="Not billed while the current costing source is selected. Kept so switching does not lose work."
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
            {isVariantMode ? (
              <div>
                <StoredRecipesHeading title="Product recipe" sku={product.sku} />
                <RecipeTable
                  availableComponents={availableComponents}
                  selectedComponents={defaultSelectedComponents}
                  inert
                />
              </div>
            ) : (
              variants.filter(variantHasOwnRecipe).map((v) => (
                <div key={v.id}>
                  <StoredRecipesHeading title={v.title} sku={v.sku} />
                  <RecipeTable
                    availableComponents={availableComponents}
                    selectedComponents={variantOwnRows(v.id) ?? []}
                    inert
                  />
                </div>
              ))
            )}
          </div>
        </Section>
      )}

      <WholesalePanel
        wholesaleEnabled={wholesaleEnabled}
        onWholesaleEnabledChange={setWholesaleEnabled}
        wholesalePrice={wholesalePrice}
        onWholesalePriceChange={setWholesalePrice}
        wholesaleMinQty={wholesaleMinQty}
        onWholesaleMinQtyChange={setWholesaleMinQty}
        wholesalePriceValue={wholesalePriceValue}
        wholesaleMargin={wholesaleMargin}
        calculatedCogs={calculatedCogs}
        priceTiers={priceTiers}
        onPriceTiersChange={setPriceTiers}
        onAddPriceTier={addPriceTier}
        onSaveWholesale={handleSaveWholesale}
        isWholesaleSaving={isWholesaleSaving}
      />

      <AddVariantDialog
        open={isAddVariantDialogOpen}
        onOpenChange={setIsAddVariantDialogOpen}
        newVariantTitle={newVariantTitle}
        onNewVariantTitleChange={setNewVariantTitle}
        newVariantSku={newVariantSku}
        onNewVariantSkuChange={setNewVariantSku}
        newVariantPrice={newVariantPrice}
        onNewVariantPriceChange={setNewVariantPrice}
        newVariantCopySource={newVariantCopySource}
        onNewVariantCopySourceChange={setNewVariantCopySource}
        defaultSelectedComponents={defaultSelectedComponents}
        variants={variants}
        onAddVariant={handleAddVariant}
        isAddingVariant={isAddingVariant}
      />
    </div>
  );
}

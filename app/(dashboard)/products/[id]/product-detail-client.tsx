"use client";

import { useEffect, useMemo, useState } from "react";
import {
  createProductVariant,
  deleteProductVariant,
  updateProductComponents,
  updateProductPrice,
  updateProductVariantPrice,
  updateProductVariantComponents,
  updateWholesalePricing,
} from "./actions";
import { ArrowLeft, AlertCircle } from "lucide-react";
import { Btn } from "./components/primitives";
import { VariantsPanel } from "./components/VariantsPanel";
import { StatsRow } from "./components/StatsRow";
import { ProductDetailsPanel } from "./components/ProductDetailsPanel";
import { CogsBreakdown } from "./components/CogsBreakdown";
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

  // Wholesale
  const [wholesaleEnabled, setWholesaleEnabled] = useState(product.wholesale_enabled || false);
  const [wholesalePrice, setWholesalePrice] = useState(product.wholesale_price?.toString() || "");
  const [wholesaleMinQty, setWholesaleMinQty] = useState(product.wholesale_minimum_qty?.toString() || "1");
  const [priceTiers, setPriceTiers] = useState<Array<{ min_quantity: number; price: number }>>(
    initialWholesaleTiers.map((t) => ({ min_quantity: t.min_quantity, price: t.price }))
  );
  const [isWholesaleSaving, setIsWholesaleSaving] = useState(false);

  const isVariantMode = variants.length > 0;
  const selectedVariant = variants.find((v) => v.id === selectedVariantId) || null;

  const selectedComponents = useMemo(() => {
    if (!isVariantMode) return defaultSelectedComponents;
    if (!selectedVariantId) return [];
    return variantComponentMap[selectedVariantId] || [];
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

  const priceValue = parseFloat(sellingPrice) || 0;
  const margin = priceValue > 0 ? ((priceValue - calculatedCogs) / priceValue) * 100 : 0;
  const profit = priceValue - calculatedCogs;
  const wholesalePriceValue = parseFloat(wholesalePrice) || 0;
  const wholesaleMargin = wholesalePriceValue > 0 ? ((wholesalePriceValue - calculatedCogs) / wholesalePriceValue) * 100 : 0;

  const cogsBreakdown = useMemo(() => {
    const map = new Map<string, { name: string; value: number }>();
    for (const sc of selectedComponents) {
      const comp = availableComponents.find((c) => c.id === sc.componentId);
      if (!comp) continue;
      const value = sc.quantity * comp.cost_per_unit;
      if (value <= 0) continue;
      const prev = map.get(comp.id);
      map.set(comp.id, { name: comp.name, value: (prev?.value ?? 0) + value });
    }
    return Array.from(map.values()).sort((a, b) => b.value - a.value);
  }, [selectedComponents, availableComponents]);

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

  const handleSaveComponents = async () => {
    if (isVariantMode && !selectedVariantId) { setMessage({ type: "error", text: "Select a variant first" }); return; }
    setIsSaving(true); setMessage(null);
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
    <div className="flex flex-col gap-5 p-6 mb-20">
      {/* Back + title */}
      <div className="flex items-start gap-4">
        <Btn variant="outline" size="sm" href="/products">
          <ArrowLeft size={13} strokeWidth={2.5} />
          Products
        </Btn>
      </div>

      <div>
        <h1 className="text-[28px] md:text-[36px] font-extrabold uppercase tracking-tight leading-none text-espresso">
          {product.title}
        </h1>
        {product.sku && (
          <p className="font-mono text-[12px] text-muted-foreground mt-1">SKU: {product.sku}</p>
        )}
      </div>

      {/* Toast */}
      {message && (
        <div data-testid="detail-toast" className={`flex items-center gap-2.5 rounded-[12px] border-[2.5px] p-3 text-[13px] font-bold ${message.type === "error" ? "border-tomato bg-tomato/10 text-tomato" : "border-matcha bg-matcha/10 text-matcha"}`}>
          <AlertCircle size={15} strokeWidth={2.5} />
          {message.text}
        </div>
      )}

      {/* Variants */}
      <VariantsPanel
        variants={variants}
        selectedVariantId={selectedVariantId}
        selectedVariant={selectedVariant}
        onSelectVariant={setSelectedVariantId}
        onOpenAddVariant={() => setIsAddVariantDialogOpen(true)}
        onRemoveVariant={handleRemoveVariant}
        isRemovingVariant={isRemovingVariant}
      />

      {/* Stats row */}
      <StatsRow
        isVariantMode={isVariantMode}
        priceValue={priceValue}
        calculatedCogs={calculatedCogs}
        profit={profit}
        margin={margin}
      />

      {/* Product info + COGS chart */}
      <div className="grid gap-5 lg:grid-cols-2">
        {/* Product Details */}
        <ProductDetailsPanel
          product={product}
          isVariantMode={isVariantMode}
          selectedVariant={selectedVariant}
          sellingPrice={sellingPrice}
          onSellingPriceChange={setSellingPrice}
          onUpdatePrice={handleUpdatePrice}
          isPriceUpdating={isPriceUpdating}
        />

        {/* COGS Breakdown */}
        <CogsBreakdown calculatedCogs={calculatedCogs} cogsBreakdown={cogsBreakdown} />
      </div>

      {/* COGS Calculator */}
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

      {/* Wholesale Pricing */}
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

      {/* Add variant dialog */}
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

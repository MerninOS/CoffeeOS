"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  createProductVariant,
  deleteProductVariant,
  updateProductComponents,
  updateProductPrice,
  updateProductVariantPrice,
  updateProductVariantComponents,
  updateWholesalePricing,
} from "./actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Package,
  Loader2,
  Save,
  DollarSign,
  TrendingUp,
  AlertCircle,
  Store,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

interface Component {
  id: string;
  name: string;
  cost_per_unit: number;
  unit: string;
  type?: string;
}

interface ProductComponent {
  id: string;
  quantity: number;
  component_id: string;
  components: Component | null;
}

interface ProductVariant {
  id: string;
  title: string;
  sku: string | null;
  price: number | null;
  shopify_variant_id: string | null;
}

interface ProductVariantComponent extends ProductComponent {
  product_variant_id: string;
}

interface Product {
  id: string;
  title: string;
  description: string | null;
  sku: string | null;
  price: number | null;
  image_url: string | null;
  wholesale_price: number | null;
  wholesale_minimum_qty: number | null;
  wholesale_enabled: boolean | null;
}

interface WholesaleTier {
  id: string;
  min_quantity: number;
  price: number;
}

interface ProductDetailClientProps {
  product: Product;
  availableComponents: Component[];
  productComponents: ProductComponent[];
  productVariants: ProductVariant[];
  productVariantComponents: ProductVariantComponent[];
  wholesaleTiers: WholesaleTier[];
}

interface SelectedComponent {
  componentId: string;
  quantity: number;
}

const formatMoney = (n: number) => `$${n.toFixed(3)}`;

const chartColors = [
  "#2563eb", // blue
  "#16a34a", // green
  "#f97316", // orange
  "#a855f7", // purple
  "#dc2626", // red
  "#0ea5e9", // sky
  "#eab308", // yellow
  "#64748b", // slate
];

export function ProductDetailClient({
  product,
  availableComponents,
  productComponents: initialProductComponents,
  productVariants,
  productVariantComponents: initialVariantComponents,
  wholesaleTiers: initialWholesaleTiers,
}: ProductDetailClientProps) {
  const [variants, setVariants] = useState<ProductVariant[]>(productVariants);
  const [defaultSelectedComponents, setDefaultSelectedComponents] = useState<SelectedComponent[]>(
    initialProductComponents.map((pc) => ({
      componentId: pc.component_id,
      quantity: pc.quantity,
    }))
  );
  const [selectedVariantId, setSelectedVariantId] = useState<string>(productVariants[0]?.id || "");
  const [variantComponentMap, setVariantComponentMap] = useState<Record<string, SelectedComponent[]>>(() => {
    const grouped: Record<string, SelectedComponent[]> = {};
    for (const vc of initialVariantComponents) {
      if (!grouped[vc.product_variant_id]) {
        grouped[vc.product_variant_id] = [];
      }
      grouped[vc.product_variant_id].push({
        componentId: vc.component_id,
        quantity: vc.quantity,
      });
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
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const isVariantMode = variants.length > 0;
  const selectedVariant = variants.find((variant) => variant.id === selectedVariantId) || null;

  const selectedComponents = useMemo(() => {
    if (!isVariantMode) return defaultSelectedComponents;
    if (!selectedVariantId) return [];
    return variantComponentMap[selectedVariantId] || [];
  }, [isVariantMode, defaultSelectedComponents, selectedVariantId, variantComponentMap]);

  const setSelectedComponents = (components: SelectedComponent[]) => {
    if (!isVariantMode) {
      setDefaultSelectedComponents(components);
      return;
    }

    if (!selectedVariantId) return;

    setVariantComponentMap((prev) => ({
      ...prev,
      [selectedVariantId]: components,
    }));
  };

  // Wholesale state
  const [wholesaleEnabled, setWholesaleEnabled] = useState(product.wholesale_enabled || false);
  const [wholesalePrice, setWholesalePrice] = useState(product.wholesale_price?.toString() || "");
  const [wholesaleMinQty, setWholesaleMinQty] = useState(product.wholesale_minimum_qty?.toString() || "1");
  const [priceTiers, setPriceTiers] = useState<Array<{ min_quantity: number; price: number }>>(
    initialWholesaleTiers.map((t) => ({ min_quantity: t.min_quantity, price: t.price }))
  );
  const [isWholesaleSaving, setIsWholesaleSaving] = useState(false);

  useEffect(() => {
    if (isVariantMode) {
      setSellingPrice(selectedVariant?.price?.toString() || "");
      return;
    }
    setSellingPrice(product.price?.toString() || "");
  }, [isVariantMode, product.price, selectedVariant?.id, selectedVariant?.price]);

  const calculatedCogs = useMemo(() => {
    return selectedComponents.reduce((sum, sc) => {
      const component = availableComponents.find((c) => c.id === sc.componentId);
      if (component) return sum + sc.quantity * component.cost_per_unit;
      return sum;
    }, 0);
  }, [selectedComponents, availableComponents]);

  const priceValue = parseFloat(sellingPrice) || 0;
  const margin = priceValue > 0 ? ((priceValue - calculatedCogs) / priceValue) * 100 : 0;
  const profit = priceValue - calculatedCogs;

  const cogsBreakdown = useMemo(() => {
    const map = new Map<string, { name: string; value: number }>();

    for (const sc of selectedComponents) {
      const component = availableComponents.find((c) => c.id === sc.componentId);
      if (!component) continue;

      const value = sc.quantity * component.cost_per_unit;
      if (value <= 0) continue;

      const prev = map.get(component.id);
      map.set(component.id, {
        name: component.name,
        value: (prev?.value ?? 0) + value,
      });
    }

    return Array.from(map.values()).sort((a, b) => b.value - a.value);
  }, [selectedComponents, availableComponents]);

  const addComponent = () => {
    if (availableComponents.length === 0) return;

    const unusedComponent = availableComponents.find(
      (c) => !selectedComponents.some((sc) => sc.componentId === c.id)
    );

    if (unusedComponent) {
      setSelectedComponents([...selectedComponents, { componentId: unusedComponent.id, quantity: 1 }]);
    }
  };

  const removeComponent = (index: number) => {
    setSelectedComponents(selectedComponents.filter((_, i) => i !== index));
  };

  const updateComponent = (index: number, field: keyof SelectedComponent, value: string | number) => {
    const updated = [...selectedComponents];
    updated[index] = { ...updated[index], [field]: value };
    setSelectedComponents(updated);
  };

  const handleSaveComponents = async () => {
    if (isVariantMode && !selectedVariantId) {
      setMessage({ type: "error", text: "Select a variant first" });
      return;
    }

    setIsSaving(true);
    setMessage(null);

    const result = isVariantMode
      ? await updateProductVariantComponents(product.id, selectedVariantId, selectedComponents)
      : await updateProductComponents(product.id, selectedComponents);

    if (result.error) {
      setMessage({ type: "error", text: result.error });
    } else {
      setMessage({
        type: "success",
        text: isVariantMode ? "Variant COGS saved successfully" : "Components saved successfully",
      });
    }

    setIsSaving(false);
  };

  const handleAddVariant = async () => {
    const title = newVariantTitle.trim();
    const parsedPrice = newVariantPrice.trim() ? parseFloat(newVariantPrice) : null;

    if (!title) {
      setMessage({ type: "error", text: "Variant title is required" });
      return;
    }

    if (newVariantPrice.trim() && (parsedPrice === null || Number.isNaN(parsedPrice) || parsedPrice < 0)) {
      setMessage({ type: "error", text: "Please enter a valid variant price" });
      return;
    }

    setIsAddingVariant(true);
    setMessage(null);

    const copyFromVariantId = newVariantCopySource.startsWith("variant:")
      ? newVariantCopySource.replace("variant:", "")
      : null;
    const copyFromProductCogs = newVariantCopySource === "product";

    const result = await createProductVariant(product.id, {
      title,
      sku: newVariantSku.trim() || null,
      price: parsedPrice,
    }, {
      copyFromVariantId,
      copyFromProductCogs,
    });

    if (result.error || !result.variant) {
      setMessage({ type: "error", text: result.error || "Failed to add variant" });
      setIsAddingVariant(false);
      return;
    }

    setVariants((prev) => [...prev, result.variant]);
    const copiedComponents = copyFromProductCogs
      ? defaultSelectedComponents
      : copyFromVariantId
        ? (variantComponentMap[copyFromVariantId] || [])
        : [];

    setVariantComponentMap((prev) => ({
      ...prev,
      [result.variant.id]: copiedComponents.map((item) => ({ ...item })),
    }));
    setSelectedVariantId(result.variant.id);
    setNewVariantTitle("");
    setNewVariantSku("");
    setNewVariantPrice(result.variant.price?.toString() || "");
    setNewVariantCopySource(`variant:${result.variant.id}`);
    setMessage({ type: "success", text: "Variant added successfully" });
    setIsAddVariantDialogOpen(false);
    setIsAddingVariant(false);
  };

  const handleUpdatePrice = async () => {
    const price = parseFloat(sellingPrice);
    if (isNaN(price) || price < 0) {
      setMessage({ type: "error", text: "Please enter a valid price" });
      return;
    }

    setIsPriceUpdating(true);
    setMessage(null);

    const result = isVariantMode && selectedVariant
      ? await updateProductVariantPrice(product.id, selectedVariant.id, price)
      : await updateProductPrice(product.id, price);

    if (result.error) {
      setMessage({ type: "error", text: result.error });
    } else {
      if (isVariantMode && selectedVariant) {
        setVariants((prev) =>
          prev.map((variant) =>
            variant.id === selectedVariant.id
              ? { ...variant, price }
              : variant
          )
        );
      }
      setMessage({
        type: "success",
        text: isVariantMode ? "Variant price updated successfully" : "Price updated successfully",
      });
    }

    setIsPriceUpdating(false);
  };

  const handleRemoveVariant = async () => {
    if (!selectedVariant) {
      setMessage({ type: "error", text: "Select a variant to remove" });
      return;
    }

    const shouldDelete = window.confirm(
      `Remove variant "${selectedVariant.title}"? This will also delete its COGS assignments.`
    );
    if (!shouldDelete) return;

    setIsRemovingVariant(true);
    setMessage(null);

    const variantIdToDelete = selectedVariant.id;
    const result = await deleteProductVariant(product.id, variantIdToDelete);

    if (result.error) {
      setMessage({ type: "error", text: result.error });
      setIsRemovingVariant(false);
      return;
    }

    const updatedVariants = variants.filter((variant) => variant.id !== variantIdToDelete);
    setVariants(updatedVariants);
    setVariantComponentMap((prev) => {
      const next = { ...prev };
      delete next[variantIdToDelete];
      return next;
    });

    const nextSelectedId = updatedVariants[0]?.id || "";
    setSelectedVariantId(nextSelectedId);

    if (newVariantCopySource === `variant:${variantIdToDelete}`) {
      setNewVariantCopySource(
        defaultSelectedComponents.length > 0
          ? "product"
          : updatedVariants[0]
            ? `variant:${updatedVariants[0].id}`
            : "none"
      );
    }

    setMessage({ type: "success", text: "Variant removed successfully" });
    setIsRemovingVariant(false);
  };

  const addPriceTier = () => {
    const lastTier = priceTiers[priceTiers.length - 1];
    const newMinQty = lastTier ? lastTier.min_quantity + 10 : 10;
    const newPrice = lastTier ? lastTier.price * 0.95 : parseFloat(wholesalePrice) || (priceValue * 0.8);
    setPriceTiers([...priceTiers, { min_quantity: newMinQty, price: Math.round(newPrice * 100) / 100 }]);
  };

  const removePriceTier = (index: number) => {
    setPriceTiers(priceTiers.filter((_, i) => i !== index));
  };

  const updatePriceTier = (index: number, field: "min_quantity" | "price", value: number) => {
    const updated = [...priceTiers];
    updated[index] = { ...updated[index], [field]: value };
    setPriceTiers(updated);
  };

  const handleSaveWholesale = async () => {
    setIsWholesaleSaving(true);
    setMessage(null);

    const result = await updateWholesalePricing(product.id, {
      wholesale_enabled: wholesaleEnabled,
      wholesale_price: wholesalePrice ? parseFloat(wholesalePrice) : null,
      wholesale_minimum_qty: parseInt(wholesaleMinQty) || 1,
      price_tiers: priceTiers,
    });

    if (result.error) {
      setMessage({ type: "error", text: result.error });
    } else {
      setMessage({ type: "success", text: "Wholesale pricing saved successfully" });
    }

    setIsWholesaleSaving(false);
  };

  // Calculate wholesale margin
  const wholesalePriceValue = parseFloat(wholesalePrice) || 0;
  const wholesaleMargin = wholesalePriceValue > 0 ? ((wholesalePriceValue - calculatedCogs) / wholesalePriceValue) * 100 : 0;

  return (
    <div className="space-y-6 mb-40">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/products">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Products
          </Link>
        </Button>
      </div>

      {message && (
        <div
          className={`flex items-center gap-2 rounded-md p-3 text-sm ${
            message.type === "error"
              ? "bg-destructive/10 text-destructive"
              : "bg-green-500/10 text-green-600"
          }`}
        >
          <AlertCircle className="h-4 w-4" />
          {message.text}
        </div>
      )}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Variants</CardTitle>
          <CardDescription>
            Add variants here, then edit COGS per variant.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {variants.map((variant) => (
              <Button
                key={variant.id}
                type="button"
                variant={variant.id === selectedVariantId ? "default" : "outline"}
                className="rounded-full px-4"
                onClick={() => setSelectedVariantId(variant.id)}
              >
                {variant.title}
              </Button>
            ))}
            <Button
              type="button"
              variant="outline"
              className="rounded-full px-4"
              onClick={() => setIsAddVariantDialogOpen(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Variant
            </Button>
          </div>

          {isVariantMode ? (
            <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
              <div className="flex items-center justify-between gap-2">
                <span>
                  {selectedVariant?.sku
                    ? `Selected SKU: ${selectedVariant.sku}`
                    : "Select a variant pill to edit its COGS."}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleRemoveVariant}
                  disabled={!selectedVariant || isRemovingVariant}
                  className="text-destructive hover:text-destructive"
                >
                  {isRemovingVariant ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
                  Remove Variant
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No variants yet. Click the Add Variant pill to create your first one.
            </p>
          )}
        </CardContent>
      </Card>
      <Dialog open={isAddVariantDialogOpen} onOpenChange={setIsAddVariantDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Variant</DialogTitle>
            <DialogDescription>
              Create a new variant and optionally copy COGS from an existing source.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="new-variant-title">Variant title</Label>
              <Input
                id="new-variant-title"
                placeholder="e.g. 12oz Bag"
                value={newVariantTitle}
                onChange={(e) => setNewVariantTitle(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-variant-sku">SKU (optional)</Label>
              <Input
                id="new-variant-sku"
                placeholder="SKU"
                value={newVariantSku}
                onChange={(e) => setNewVariantSku(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-variant-price">Price (optional)</Label>
              <Input
                id="new-variant-price"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={newVariantPrice}
                onChange={(e) => setNewVariantPrice(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Copy COGS from</Label>
              <Select value={newVariantCopySource} onValueChange={setNewVariantCopySource}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Copy COGS from..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Do not copy COGS</SelectItem>
                  {defaultSelectedComponents.length > 0 ? (
                    <SelectItem value="product">Current product COGS</SelectItem>
                  ) : null}
                  {variants.map((variant) => (
                    <SelectItem key={`copy-${variant.id}`} value={`variant:${variant.id}`}>
                      {`Variant: ${variant.title}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsAddVariantDialogOpen(false)}
              disabled={isAddingVariant}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleAddVariant} disabled={isAddingVariant}>
              {isAddingVariant ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Add Variant
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
        <Card>
          <CardHeader className="md:pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {isVariantMode ? "Variant Price" : "Selling Price"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatMoney(priceValue)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="md:pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total COGS</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatMoney(calculatedCogs)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="md:pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Profit per Unit</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${profit >= 0 ? "text-green-600" : "text-destructive"}`}>
              {formatMoney(profit)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="md:pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Profit Margin</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <div className="text-2xl font-bold">{margin.toFixed(1)}%</div>
              <Badge
                variant="secondary"
                className={
                  margin >= 30
                    ? "bg-green-500/10 text-green-600"
                    : margin >= 15
                      ? "bg-amber-500/10 text-amber-600"
                      : "bg-red-500/10 text-red-600"
                }
              >
                <TrendingUp className="mr-1 h-3 w-3" />
                {margin >= 30 ? "Healthy" : margin >= 15 ? "Fair" : "Low"}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Product Info */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Product Details</CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Mobile-friendly: slightly shorter on small screens */}
            <div className="relative w-full overflow-hidden rounded-lg bg-muted aspect-[4/3] sm:aspect-square">
              {product.image_url ? (
                <Image
                  src={product.image_url || "/placeholder.svg"}
                  alt={product.title}
                  fill
                  sizes="(min-width: 1024px) 50vw, 100vw"
                  className="object-cover"
                  priority={false}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <Package className="h-10 w-10 text-muted-foreground" />
                </div>
              )}
            </div>

            <div className="min-w-0">
              <h2 className="truncate text-xl font-semibold">{product.title}</h2>
              {isVariantMode ? (
                selectedVariant?.sku ? (
                  <p className="mt-1 font-mono text-sm text-muted-foreground">SKU: {selectedVariant.sku}</p>
                ) : (
                  <p className="mt-1 text-sm text-muted-foreground">{selectedVariant?.title || "No variant selected"}</p>
                )
              ) : product.sku ? (
                <p className="mt-1 font-mono text-sm text-muted-foreground">SKU: {product.sku}</p>
              ) : null}
            </div>

            <div className="space-y-3 pt-2">
              <div>
                <Label htmlFor="sellingPrice">Selling Price</Label>
                <div className="mt-1 flex gap-2">
                  <div className="relative flex-1">
                    <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="sellingPrice"
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min="0"
                      value={sellingPrice}
                      onChange={(e) => setSellingPrice(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Button
                    onClick={handleUpdatePrice}
                    disabled={isPriceUpdating || (isVariantMode && !selectedVariant)}
                    size="icon"
                    variant="outline"
                  >
                    {isPriceUpdating ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                {isVariantMode ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Price updates apply to the currently selected variant.
                  </p>
                ) : null}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* COGS Breakdown */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle>COGS Breakdown</CardTitle>
              <span className="text-2xl font-bold">{formatMoney(calculatedCogs)}</span>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {calculatedCogs > 0 && cogsBreakdown.length > 0 ? (
              <>
                <div className="h-56 w-full sm:h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={cogsBreakdown}
                        dataKey="value"
                        nameKey="name"
                        innerRadius="55%"
                        outerRadius="80%"
                        paddingAngle={2}
                      >
                        {cogsBreakdown.map((_, i) => (
                          <Cell key={`cell-${i}`} fill={chartColors[i % chartColors.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => formatMoney(Number(v))} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Custom legend list (mobile-friendly, wraps nicely) */}
                <div className="mt-2 space-y-2">
                  {cogsBreakdown.map((d, i) => (
                    <div key={d.name} className="flex items-center justify-between gap-3 text-sm">
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          className="h-2 w-2 shrink-0 rounded-sm"
                          style={{ backgroundColor: chartColors[i % chartColors.length] }}
                        />
                        <span className="truncate">{d.name}</span>
                      </div>
                      <div className="shrink-0 tabular-nums">
                        {formatMoney(d.value)}{" "}
                        <span className="text-muted-foreground">
                          ({((d.value / calculatedCogs) * 100).toFixed(0)}%)
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Add quantities (and make sure your components have costs) to see the breakdown.
              </p>
            )}
          </CardContent>
        </Card>

        {/* COGS Calculator */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>COGS Calculator</CardTitle>
                <CardDescription>Add cost components to calculate total COGS</CardDescription>
              </div>
              <Button
                onClick={addComponent}
                disabled={
                  availableComponents.length === 0 ||
                  selectedComponents.length >= availableComponents.length
                }
                size="sm"
                className="w-full sm:w-auto"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Component
              </Button>
            </div>
          </CardHeader>

          <CardContent>
            {availableComponents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Package className="mb-4 h-12 w-12 text-muted-foreground" />
                <h3 className="text-lg font-medium">No components available</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Create components first to calculate COGS.{" "}
                  <Link href="/components" className="text-primary underline">
                    Go to Components
                  </Link>
                </p>
              </div>
            ) : selectedComponents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Package className="mb-4 h-12 w-12 text-muted-foreground" />
                <h3 className="text-lg font-medium">No components added</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Click &quot;Add Component&quot; to start building your COGS
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Mobile layout: stacked rows (no horizontal scroll) */}
                <div className="space-y-3 sm:hidden">
                  {selectedComponents.map((sc, index) => {
                    const component = availableComponents.find((c) => c.id === sc.componentId);
                    const lineTotal = component ? sc.quantity * component.cost_per_unit : 0;
          
                    return (
                      <div key={index} className="rounded-lg border p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <Label className="text-xs text-muted-foreground">Component</Label>
                            <div className="mt-1">
                              <Select
                                value={sc.componentId}
                                onValueChange={(value) => updateComponent(index, "componentId", value)}
                              >
                                <SelectTrigger className="w-full max-w-60">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {availableComponents.map((c) => (
                                    <SelectItem key={c.id} value={c.id}>
                                      {c.name} ({c.unit})
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
          
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeComponent(index)}
                            className="shrink-0 text-destructive hover:text-destructive"
                            aria-label="Remove component"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
          
                        <div className="mt-3 grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs text-muted-foreground">Quantity</Label>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={sc.quantity}
                              onChange={(e) =>
                                updateComponent(index, "quantity", parseFloat(e.target.value) || 0)
                              }
                              className="mt-1"
                            />
                          </div>
          
                          <div className="rounded-md bg-muted/40 p-2">
                            <div className="text-xs text-muted-foreground">Line total</div>
                            <div className="mt-0.5 font-medium tabular-nums">
                              {formatMoney(lineTotal)}
                            </div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              {component
                                ? `${formatMoney(component.cost_per_unit)}/${component.unit}`
                                : "-"}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
          
                {/* Desktop layout: table (unchanged) */}
                <div className="hidden sm:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Component</TableHead>
                        <TableHead className="w-24">Quantity</TableHead>
                        <TableHead className="text-right">Unit Cost</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="w-12" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedComponents.map((sc, index) => {
                        const component = availableComponents.find((c) => c.id === sc.componentId);
                        const lineTotal = component ? sc.quantity * component.cost_per_unit : 0;
          
                        return (
                          <TableRow key={index}>
                            <TableCell>
                              <Select
                                value={sc.componentId}
                                onValueChange={(value) => updateComponent(index, "componentId", value)}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {availableComponents.map((c) => (
                                    <SelectItem key={c.id} value={c.id}>
                                      {c.name} ({c.unit})
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
          
                            <TableCell>
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={sc.quantity}
                                onChange={(e) =>
                                  updateComponent(index, "quantity", parseFloat(e.target.value) || 0)
                                }
                              />
                            </TableCell>
          
                            <TableCell className="text-right">
                              {component ? `${formatMoney(component.cost_per_unit)}/${component.unit}` : "-"}
                            </TableCell>
          
                            <TableCell className="text-right font-medium">
                              {formatMoney(lineTotal)}
                            </TableCell>
          
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeComponent(index)}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
          
                <div className="flex justify-end">
                  <Button
                    onClick={handleSaveComponents}
                    disabled={isSaving || (isVariantMode && !selectedVariantId)}
                    className="w-full sm:w-auto"
                  >
                    {isSaving ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    {isVariantMode ? "Save Variant COGS" : "Save Components"}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Wholesale Pricing Section */}
      <div className="lg:col-span-2">
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <Store className="h-5 w-5 text-muted-foreground" />
                <div>
                  <CardTitle>Wholesale Pricing</CardTitle>
                  <CardDescription>Set up volume discounts for wholesale customers</CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="wholesale-enabled" className="text-sm">Enable Wholesale</Label>
                <Switch
                  id="wholesale-enabled"
                  checked={wholesaleEnabled}
                  onCheckedChange={setWholesaleEnabled}
                />
              </div>
            </div>
          </CardHeader>

          <CardContent>
            {!wholesaleEnabled ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Store className="mb-4 h-12 w-12 text-muted-foreground" />
                <h3 className="text-lg font-medium">Wholesale pricing disabled</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Enable wholesale pricing to set up volume discounts
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Base wholesale price */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="wholesale-price">Base Wholesale Price</Label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="wholesale-price"
                        type="number"
                        step="0.01"
                        min="0"
                        value={wholesalePrice}
                        onChange={(e) => setWholesalePrice(e.target.value)}
                        className="pl-9"
                        placeholder="e.g., 12.00"
                      />
                    </div>
                    {wholesalePriceValue > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Margin: {wholesaleMargin.toFixed(1)}% | Profit: ${(wholesalePriceValue - calculatedCogs).toFixed(2)}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="wholesale-min-qty">Minimum Order Quantity</Label>
                    <Input
                      id="wholesale-min-qty"
                      type="number"
                      min="1"
                      value={wholesaleMinQty}
                      onChange={(e) => setWholesaleMinQty(e.target.value)}
                      placeholder="e.g., 12"
                    />
                  </div>
                </div>

                {/* Price tiers */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Volume Price Tiers</Label>
                    <Button variant="outline" size="sm" onClick={addPriceTier}>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Tier
                    </Button>
                  </div>

                  {priceTiers.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">
                      No price tiers configured. Add tiers for volume discounts.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {priceTiers.map((tier, index) => {
                        const tierMargin = tier.price > 0 ? ((tier.price - calculatedCogs) / tier.price) * 100 : 0;
                        return (
                          <div key={index} className="flex items-center gap-3 rounded-lg border p-3">
                            <div className="flex-1 grid grid-cols-2 gap-3">
                              <div>
                                <Label className="text-xs text-muted-foreground">Min Quantity</Label>
                                <Input
                                  type="number"
                                  min="1"
                                  value={tier.min_quantity}
                                  onChange={(e) => updatePriceTier(index, "min_quantity", parseInt(e.target.value) || 1)}
                                  className="mt-1"
                                />
                              </div>
                              <div>
                                <Label className="text-xs text-muted-foreground">Price per Unit</Label>
                                <div className="relative mt-1">
                                  <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                  <Input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={tier.price}
                                    onChange={(e) => updatePriceTier(index, "price", parseFloat(e.target.value) || 0)}
                                    className="pl-9"
                                  />
                                </div>
                              </div>
                            </div>
                            <div className="text-right min-w-[80px]">
                              <div className="text-xs text-muted-foreground">Margin</div>
                              <div className={`text-sm font-medium ${tierMargin >= 20 ? "text-green-600" : tierMargin >= 10 ? "text-amber-600" : "text-red-600"}`}>
                                {tierMargin.toFixed(1)}%
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removePriceTier(index)}
                              className="text-destructive hover:text-destructive shrink-0"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="flex justify-end pt-2">
                  <Button onClick={handleSaveWholesale} disabled={isWholesaleSaving}>
                    {isWholesaleSaving ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    Save Wholesale Pricing
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

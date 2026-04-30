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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Package,
  Loader2,
  Save,
  DollarSign,
  AlertCircle,
  Store,
  TrendingUp,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

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

interface SelectedComponent {
  componentId: string;
  quantity: number;
}

// ─── Primitives ───────────────────────────────────────────────────────────────

function Btn({
  variant = "primary",
  size = "md",
  onClick,
  disabled,
  href,
  children,
  type = "button",
  className = "",
}: {
  variant?: "primary" | "outline" | "ghost" | "icon-ghost";
  size?: "sm" | "md" | "icon";
  onClick?: () => void;
  disabled?: boolean;
  href?: string;
  children: React.ReactNode;
  type?: "button" | "submit";
  className?: string;
}) {
  const base =
    "inline-flex items-center justify-center gap-2 font-extrabold uppercase tracking-[.08em] rounded-full transition-all duration-100 cursor-pointer whitespace-nowrap select-none disabled:opacity-50 disabled:pointer-events-none";
  const sizes = {
    sm: "h-[30px] px-3.5 text-[11px]",
    md: "h-[38px] px-5 text-[12px]",
    icon: "h-[34px] w-[34px] p-0",
  };
  const variants = {
    primary:
      "bg-tomato text-cream border-[2.5px] border-espresso shadow-[3px_3px_0_#1C0F05] hover:-translate-x-[1.5px] hover:-translate-y-[1.5px] hover:shadow-[4px_4px_0_#1C0F05] active:translate-x-[2.5px] active:translate-y-[2.5px] active:shadow-none",
    outline:
      "bg-transparent text-espresso border-[2.5px] border-espresso shadow-[3px_3px_0_#1C0F05] hover:-translate-x-[1.5px] hover:-translate-y-[1.5px] hover:shadow-[4px_4px_0_#1C0F05] active:translate-x-[2.5px] active:translate-y-[2.5px] active:shadow-none",
    ghost:
      "bg-transparent text-espresso border-[2.5px] border-transparent hover:bg-fog/50",
    "icon-ghost":
      "bg-transparent text-tomato border-[2px] border-transparent hover:bg-tomato/10",
  };
  const cls = `${base} ${sizes[size]} ${variants[variant]} ${className}`;
  if (href)
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    );
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={cls}>
      {children}
    </button>
  );
}

function Panel({
  title,
  subtitle,
  action,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`bg-chalk border-[3px] border-espresso rounded-[16px] shadow-flat-md overflow-hidden ${className}`}
    >
      <div className="flex items-start justify-between gap-3 px-5 py-4 border-b-2 border-espresso bg-cream">
        <div>
          <div className="font-extrabold text-sm uppercase tracking-[.08em] text-espresso">
            {title}
          </div>
          {subtitle && (
            <div className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</div>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function FieldLabel({ htmlFor, children }: { htmlFor?: string; children: React.ReactNode }) {
  return (
    <label
      htmlFor={htmlFor}
      className="block text-[10.5px] font-extrabold uppercase tracking-[.1em] text-espresso mb-1.5"
    >
      {children}
    </label>
  );
}

function MerninInput({
  id,
  value,
  onChange,
  placeholder,
  type = "text",
  step,
  min,
  prefix,
}: {
  id?: string;
  value: string | number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  type?: string;
  step?: string;
  min?: string;
  prefix?: React.ReactNode;
}) {
  return (
    <div className="relative">
      {prefix && (
        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
          {prefix}
        </div>
      )}
      <input
        id={id}
        type={type}
        step={step}
        min={min}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`w-full bg-chalk border-[3px] border-espresso rounded-[10px] ${prefix ? "pl-9" : "px-3.5"} py-2.5 pr-3.5 font-body text-[14px] text-espresso shadow-[3px_3px_0_#1C0F05] outline-none placeholder:text-muted-foreground focus:-translate-x-[1px] focus:-translate-y-[1px] focus:shadow-[4px_4px_0_#E8442A] focus:border-tomato transition-all duration-100`}
      />
    </div>
  );
}

function Pill({
  variant,
  children,
}: {
  variant: "matcha" | "sun" | "tomato" | "sky" | "fog";
  children: React.ReactNode;
}) {
  const styles: Record<string, string> = {
    matcha: "bg-matcha text-cream",
    sun: "bg-sun text-espresso",
    tomato: "bg-tomato text-cream",
    sky: "bg-sky text-espresso",
    fog: "bg-fog text-espresso",
  };
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full border-2 border-espresso text-[10px] font-extrabold tracking-[.1em] uppercase ${styles[variant]}`}
    >
      {children}
    </span>
  );
}

const fmt = (n: number) => `$${n.toFixed(3)}`;

const CHART_COLORS = ["#E8442A", "#F5C842", "#E8913A", "#5BC8D5", "#5A7A3A", "#3B1F0A", "#D8D0B8"];

// ─── Main Component ───────────────────────────────────────────────────────────

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

  const marginPill = (m: number) => {
    const v = m >= 30 ? "matcha" : m >= 15 ? "sun" : "tomato";
    return <Pill variant={v}>{m >= 30 ? "Healthy" : m >= 15 ? "Fair" : "Low"}</Pill>;
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
        <div className={`flex items-center gap-2.5 rounded-[12px] border-[2.5px] p-3 text-[13px] font-bold ${message.type === "error" ? "border-tomato bg-tomato/10 text-tomato" : "border-matcha bg-matcha/10 text-matcha"}`}>
          <AlertCircle size={15} strokeWidth={2.5} />
          {message.text}
        </div>
      )}

      {/* Variants */}
      <Panel
        title="Variants"
        subtitle="Add variants, then edit COGS per variant."
        action={
          <Btn variant="outline" size="sm" onClick={() => setIsAddVariantDialogOpen(true)}>
            <Plus size={13} strokeWidth={2.5} />
            Add Variant
          </Btn>
        }
      >
        {variants.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">
            No variants yet. Add one to get started.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              {variants.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setSelectedVariantId(v.id)}
                  className={`inline-flex items-center h-[30px] px-4 rounded-full border-[2.5px] text-[11px] font-extrabold uppercase tracking-[.08em] transition-all duration-100 ${
                    v.id === selectedVariantId
                      ? "bg-tomato text-cream border-espresso shadow-[3px_3px_0_#1C0F05]"
                      : "bg-transparent text-espresso border-espresso hover:bg-fog/40"
                  }`}
                >
                  {v.title}
                </button>
              ))}
            </div>
            {selectedVariant && (
              <div className="flex items-center justify-between rounded-[10px] border-[2px] border-dashed border-fog bg-cream p-3">
                <span className="text-[12px] text-muted-foreground font-bold">
                  {selectedVariant.sku ? `SKU: ${selectedVariant.sku}` : "Select a variant to edit its COGS."}
                </span>
                <Btn
                  variant="ghost"
                  size="sm"
                  onClick={handleRemoveVariant}
                  disabled={!selectedVariant || isRemovingVariant}
                  className="text-tomato hover:bg-tomato/10 !border-transparent"
                >
                  {isRemovingVariant && <Loader2 size={12} className="animate-spin" />}
                  Remove Variant
                </Btn>
              </div>
            )}
          </div>
        )}
      </Panel>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            label: isVariantMode ? "Variant Price" : "Selling Price",
            value: fmt(priceValue),
            sub: null as React.ReactNode,
          },
          { label: "Total COGS", value: fmt(calculatedCogs), sub: null },
          {
            label: "Profit / Unit",
            value: fmt(profit),
            sub: null,
            color: profit >= 0 ? "text-matcha" : "text-tomato",
          },
          {
            label: "Profit Margin",
            value: `${margin.toFixed(1)}%`,
            sub: marginPill(margin),
          },
        ].map(({ label, value, sub, color }) => (
          <div
            key={label}
            className="bg-chalk border-[3px] border-espresso rounded-[14px] p-4 shadow-flat-md"
          >
            <div className="text-[10.5px] font-extrabold tracking-[.12em] uppercase text-muted-foreground">
              {label}
            </div>
            <div className={`font-extrabold text-[28px] leading-none mt-1.5 ${color || "text-espresso"}`}>
              {value}
            </div>
            {sub && <div className="mt-2">{sub}</div>}
          </div>
        ))}
      </div>

      {/* Product info + COGS chart */}
      <div className="grid gap-5 lg:grid-cols-2">
        {/* Product Details */}
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
                    onChange={(e) => setSellingPrice(e.target.value)}
                    placeholder="0.00"
                    prefix={<DollarSign size={15} strokeWidth={2} />}
                  />
                </div>
                <Btn
                  onClick={handleUpdatePrice}
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

        {/* COGS Breakdown */}
        <Panel title="COGS Breakdown" subtitle={calculatedCogs > 0 ? fmt(calculatedCogs) : undefined}>
          {calculatedCogs > 0 && cogsBreakdown.length > 0 ? (
            <>
              <div className="h-52 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={cogsBreakdown} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="80%" paddingAngle={2}>
                      {cogsBreakdown.map((_, i) => (
                        <Cell key={`cell-${i}`} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => fmt(Number(v))} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 space-y-2">
                {cogsBreakdown.map((d, i) => (
                  <div key={d.name} className="flex items-center justify-between gap-3 text-[12px]">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-[3px] shrink-0" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                      <span className="truncate font-medium text-espresso">{d.name}</span>
                    </div>
                    <div className="shrink-0 font-bold tabular-nums text-espresso">
                      {fmt(d.value)}{" "}
                      <span className="text-muted-foreground font-normal">
                        ({((d.value / calculatedCogs) * 100).toFixed(0)}%)
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <TrendingUp size={32} strokeWidth={1.5} className="text-fog mb-3" />
              <p className="text-[13px] text-muted-foreground">
                Add components with costs to see the breakdown.
              </p>
            </div>
          )}
        </Panel>
      </div>

      {/* COGS Calculator */}
      <Panel
        title="COGS Calculator"
        subtitle="Add cost components to calculate total COGS"
        action={
          <Btn
            onClick={addComponent}
            disabled={availableComponents.length === 0 || selectedComponents.length >= availableComponents.length}
            size="sm"
          >
            <Plus size={13} strokeWidth={2.5} />
            Add Component
          </Btn>
        }
      >
        {availableComponents.length === 0 ? (
          <div className="flex flex-col items-center py-10 text-center">
            <Package size={32} strokeWidth={1.5} className="text-fog mb-3" />
            <p className="font-extrabold uppercase text-[13px] tracking-wide text-espresso">No components available</p>
            <p className="text-[12px] text-muted-foreground mt-1">
              <Link href="/components" className="text-tomato underline font-bold">Create components first</Link> to calculate COGS.
            </p>
          </div>
        ) : selectedComponents.length === 0 ? (
          <div className="flex flex-col items-center py-10 text-center">
            <Package size={32} strokeWidth={1.5} className="text-fog mb-3" />
            <p className="font-extrabold uppercase text-[13px] tracking-wide text-espresso">No components added</p>
            <p className="text-[12px] text-muted-foreground mt-1">Click &quot;Add Component&quot; to start building your COGS.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {/* Mobile: stacked cards */}
            <div className="flex flex-col gap-3 sm:hidden">
              {selectedComponents.map((sc, idx) => {
                const comp = availableComponents.find((c) => c.id === sc.componentId);
                const lineTotal = comp ? sc.quantity * comp.cost_per_unit : 0;
                return (
                  <div key={idx} className="rounded-[12px] border-[2.5px] border-espresso bg-cream p-3">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex-1">
                        <FieldLabel>Component</FieldLabel>
                        <Select value={sc.componentId} onValueChange={(v) => updateComponent(idx, "componentId", v)}>
                          <SelectTrigger className="border-[2px] border-espresso rounded-[8px] h-9 text-[12px] font-bold">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {availableComponents.map((c) => (
                              <SelectItem key={c.id} value={c.id}>{c.name} ({c.unit})</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <button onClick={() => removeComponent(idx)} className="w-8 h-8 mt-5 inline-flex items-center justify-center rounded-full text-tomato hover:bg-tomato/10 transition-colors">
                        <Trash2 size={14} strokeWidth={2} />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <FieldLabel>Quantity</FieldLabel>
                        <MerninInput type="number" min="0" step="0.01" value={sc.quantity} onChange={(e) => updateComponent(idx, "quantity", parseFloat(e.target.value) || 0)} />
                      </div>
                      <div className="rounded-[10px] bg-fog/50 border-[2px] border-fog p-3">
                        <div className="text-[9.5px] font-extrabold uppercase tracking-wide text-muted-foreground">Line total</div>
                        <div className="font-extrabold text-[15px] text-espresso mt-0.5 tabular-nums">{fmt(lineTotal)}</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">{comp ? `${fmt(comp.cost_per_unit)}/${comp.unit}` : "—"}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop: table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr className="border-b-2 border-espresso">
                    {["Component", "Quantity", "Unit Cost", "Total", ""].map((h, i) => (
                      <th key={i} className={`py-2.5 text-[9.5px] font-extrabold uppercase tracking-[.1em] text-muted-foreground ${i > 0 ? "text-right" : "text-left"} ${i === 4 ? "w-10" : ""}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {selectedComponents.map((sc, idx) => {
                    const comp = availableComponents.find((c) => c.id === sc.componentId);
                    const lineTotal = comp ? sc.quantity * comp.cost_per_unit : 0;
                    return (
                      <tr key={idx} className="border-b border-dashed border-fog last:border-0">
                        <td className="py-3 pr-4">
                          <Select value={sc.componentId} onValueChange={(v) => updateComponent(idx, "componentId", v)}>
                            <SelectTrigger className="border-[2px] border-espresso rounded-[8px] h-9 text-[12px] font-bold">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {availableComponents.map((c) => (
                                <SelectItem key={c.id} value={c.id}>{c.name} ({c.unit})</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="py-3 pr-4">
                          <input
                            type="number" min="0" step="0.01" value={sc.quantity}
                            onChange={(e) => updateComponent(idx, "quantity", parseFloat(e.target.value) || 0)}
                            className="w-24 bg-chalk border-[2px] border-espresso rounded-[8px] px-3 py-2 text-[13px] font-bold text-espresso outline-none focus:border-tomato text-right tabular-nums"
                          />
                        </td>
                        <td className="py-3 text-right font-mono text-[12px] text-muted-foreground">
                          {comp ? `${fmt(comp.cost_per_unit)}/${comp.unit}` : "—"}
                        </td>
                        <td className="py-3 text-right font-bold text-espresso tabular-nums">{fmt(lineTotal)}</td>
                        <td className="py-3 pl-3">
                          <button onClick={() => removeComponent(idx)} className="w-7 h-7 inline-flex items-center justify-center rounded-full text-tomato hover:bg-tomato/10 transition-colors">
                            <Trash2 size={13} strokeWidth={2} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-2 border-t-2 border-fog">
              <Btn onClick={handleSaveComponents} disabled={isSaving || (isVariantMode && !selectedVariantId)}>
                {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} strokeWidth={2} />}
                {isVariantMode ? "Save Variant COGS" : "Save Components"}
              </Btn>
            </div>
          </div>
        )}
      </Panel>

      {/* Wholesale Pricing */}
      <Panel
        title="Wholesale Pricing"
        subtitle="Set up volume discounts for wholesale customers"
        action={
          <div className="flex items-center gap-2">
            <label htmlFor="wholesale-enabled" className="text-[10.5px] font-extrabold uppercase tracking-[.1em] text-espresso cursor-pointer">
              Enable
            </label>
            <Switch id="wholesale-enabled" checked={wholesaleEnabled} onCheckedChange={setWholesaleEnabled} />
          </div>
        }
      >
        {!wholesaleEnabled ? (
          <div className="flex flex-col items-center py-10 text-center">
            <Store size={32} strokeWidth={1.5} className="text-fog mb-3" />
            <p className="font-extrabold uppercase text-[13px] tracking-wide text-espresso">Wholesale Disabled</p>
            <p className="text-[12px] text-muted-foreground mt-1">Enable the toggle to set up volume discounts.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <FieldLabel htmlFor="wholesale-price">Base Wholesale Price</FieldLabel>
                <MerninInput
                  id="wholesale-price"
                  type="number" step="0.01" min="0"
                  value={wholesalePrice}
                  onChange={(e) => setWholesalePrice(e.target.value)}
                  placeholder="12.00"
                  prefix={<DollarSign size={15} strokeWidth={2} />}
                />
                {wholesalePriceValue > 0 && (
                  <p className="mt-1.5 text-[11px] text-muted-foreground">
                    Margin: {wholesaleMargin.toFixed(1)}% · Profit: ${(wholesalePriceValue - calculatedCogs).toFixed(2)}
                  </p>
                )}
              </div>
              <div>
                <FieldLabel htmlFor="wholesale-min-qty">Min Order Quantity</FieldLabel>
                <MerninInput
                  id="wholesale-min-qty"
                  type="number" min="1"
                  value={wholesaleMinQty}
                  onChange={(e) => setWholesaleMinQty(e.target.value)}
                  placeholder="12"
                />
              </div>
            </div>

            {/* Price tiers */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="text-[10.5px] font-extrabold uppercase tracking-[.1em] text-espresso">
                  Volume Price Tiers
                </div>
                <Btn variant="outline" size="sm" onClick={addPriceTier}>
                  <Plus size={12} strokeWidth={2.5} />
                  Add Tier
                </Btn>
              </div>

              {priceTiers.length === 0 ? (
                <p className="text-[12px] text-muted-foreground text-center py-4 border-2 border-dashed border-fog rounded-[10px]">
                  No price tiers configured.
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {priceTiers.map((tier, idx) => {
                    const tierMargin = tier.price > 0 ? ((tier.price - calculatedCogs) / tier.price) * 100 : 0;
                    return (
                      <div key={idx} className="flex items-center gap-3 rounded-[12px] border-[2.5px] border-espresso bg-cream p-3">
                        <div className="flex-1 grid grid-cols-2 gap-3">
                          <div>
                            <FieldLabel>Min Qty</FieldLabel>
                            <MerninInput type="number" min="1" value={tier.min_quantity} onChange={(e) => { const u = [...priceTiers]; u[idx] = { ...u[idx], min_quantity: parseInt(e.target.value) || 1 }; setPriceTiers(u); }} />
                          </div>
                          <div>
                            <FieldLabel>Price / Unit</FieldLabel>
                            <MerninInput type="number" step="0.01" min="0" value={tier.price} onChange={(e) => { const u = [...priceTiers]; u[idx] = { ...u[idx], price: parseFloat(e.target.value) || 0 }; setPriceTiers(u); }} prefix={<DollarSign size={15} strokeWidth={2} />} />
                          </div>
                        </div>
                        <div className="text-right min-w-[64px]">
                          <div className="text-[9.5px] font-extrabold uppercase tracking-wide text-muted-foreground">Margin</div>
                          <div className={`text-[13px] font-extrabold mt-0.5 ${tierMargin >= 20 ? "text-matcha" : tierMargin >= 10 ? "text-honey" : "text-tomato"}`}>
                            {tierMargin.toFixed(1)}%
                          </div>
                        </div>
                        <button onClick={() => setPriceTiers(priceTiers.filter((_, i) => i !== idx))} className="w-8 h-8 inline-flex items-center justify-center rounded-full text-tomato hover:bg-tomato/10 transition-colors shrink-0">
                          <Trash2 size={14} strokeWidth={2} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t-2 border-fog">
              <Btn onClick={handleSaveWholesale} disabled={isWholesaleSaving}>
                {isWholesaleSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} strokeWidth={2} />}
                Save Wholesale Pricing
              </Btn>
            </div>
          </div>
        )}
      </Panel>

      {/* Add variant dialog */}
      <Dialog open={isAddVariantDialogOpen} onOpenChange={setIsAddVariantDialogOpen}>
        <DialogContent className="border-[3px] border-espresso rounded-[20px] shadow-flat-lg bg-chalk p-0 overflow-hidden gap-0">
          <DialogHeader className="px-6 py-5 border-b-[3px] border-espresso bg-cream">
            <DialogTitle className="font-extrabold text-[18px] uppercase tracking-[.06em] text-espresso">Add Variant</DialogTitle>
            <DialogDescription className="text-[13px] text-muted-foreground mt-0.5">
              Create a new variant and optionally copy COGS from an existing source.
            </DialogDescription>
          </DialogHeader>
          <div className="px-6 py-5 flex flex-col gap-4">
            <div>
              <FieldLabel htmlFor="new-variant-title">Variant Title *</FieldLabel>
              <MerninInput id="new-variant-title" placeholder="e.g. 12oz Bag" value={newVariantTitle} onChange={(e) => setNewVariantTitle(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <FieldLabel htmlFor="new-variant-sku">SKU (optional)</FieldLabel>
                <MerninInput id="new-variant-sku" placeholder="SKU" value={newVariantSku} onChange={(e) => setNewVariantSku(e.target.value)} />
              </div>
              <div>
                <FieldLabel htmlFor="new-variant-price">Price (optional)</FieldLabel>
                <MerninInput id="new-variant-price" type="number" step="0.01" min="0" placeholder="0.00" value={newVariantPrice} onChange={(e) => setNewVariantPrice(e.target.value)} prefix={<DollarSign size={15} strokeWidth={2} />} />
              </div>
            </div>
            <div>
              <FieldLabel>Copy COGS From</FieldLabel>
              <Select value={newVariantCopySource} onValueChange={setNewVariantCopySource}>
                <SelectTrigger className="border-[2.5px] border-espresso rounded-[10px] h-10 text-[13px] font-bold shadow-[3px_3px_0_#1C0F05]">
                  <SelectValue placeholder="Copy COGS from..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Don&apos;t copy COGS</SelectItem>
                  {defaultSelectedComponents.length > 0 && <SelectItem value="product">Current product COGS</SelectItem>}
                  {variants.map((v) => <SelectItem key={`copy-${v.id}`} value={`variant:${v.id}`}>Variant: {v.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="px-6 py-4 border-t-[3px] border-espresso bg-cream flex gap-2">
            <Btn variant="outline" size="sm" onClick={() => setIsAddVariantDialogOpen(false)} disabled={isAddingVariant}>Cancel</Btn>
            <Btn size="sm" onClick={handleAddVariant} disabled={isAddingVariant}>
              {isAddingVariant && <Loader2 size={13} className="animate-spin" />}
              Add Variant
            </Btn>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

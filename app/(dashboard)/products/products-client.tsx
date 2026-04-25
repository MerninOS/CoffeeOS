"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { syncShopifyProducts, deleteProduct, createProduct } from "./actions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  RefreshCw,
  Search,
  Package,
  AlertCircle,
  Trash2,
  ExternalLink,
  Loader2,
  Plus,
  ChevronDown,
  Settings,
} from "lucide-react";

// ─── Primitives ──────────────────────────────────────────────────────────────

function Btn({
  variant = "primary",
  size = "md",
  onClick,
  disabled,
  asChild,
  href,
  children,
  type = "button",
  className = "",
}: {
  variant?: "primary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md";
  onClick?: () => void;
  disabled?: boolean;
  asChild?: boolean;
  href?: string;
  children: React.ReactNode;
  type?: "button" | "submit";
  className?: string;
}) {
  const base =
    "inline-flex items-center gap-2 font-extrabold uppercase tracking-[.08em] rounded-full transition-all duration-100 cursor-pointer whitespace-nowrap select-none";
  const sizes = { sm: "h-[30px] px-3.5 text-[11px]", md: "h-[38px] px-5 text-[12px]" };
  const variants = {
    primary:
      "bg-tomato text-cream border-[2.5px] border-espresso shadow-[3px_3px_0_#1C0F05] hover:-translate-x-[1.5px] hover:-translate-y-[1.5px] hover:shadow-[4px_4px_0_#1C0F05] active:translate-x-[2.5px] active:translate-y-[2.5px] active:shadow-none disabled:opacity-50 disabled:pointer-events-none",
    outline:
      "bg-transparent text-espresso border-[2.5px] border-espresso shadow-[3px_3px_0_#1C0F05] hover:-translate-x-[1.5px] hover:-translate-y-[1.5px] hover:shadow-[4px_4px_0_#1C0F05] active:translate-x-[2.5px] active:translate-y-[2.5px] active:shadow-none disabled:opacity-50 disabled:pointer-events-none",
    ghost:
      "bg-transparent text-espresso border-[2.5px] border-transparent hover:bg-fog/50 disabled:opacity-50 disabled:pointer-events-none",
    danger:
      "bg-tomato text-cream border-[2.5px] border-espresso shadow-[3px_3px_0_#1C0F05] hover:-translate-x-[1.5px] hover:-translate-y-[1.5px] active:translate-x-[2.5px] active:translate-y-[2.5px] active:shadow-none disabled:opacity-50 disabled:pointer-events-none",
  };
  const cls = `${base} ${sizes[size]} ${variants[variant]} ${className}`;
  if (href) {
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    );
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={cls}>
      {children}
    </button>
  );
}

function Pill({
  variant,
  children,
}: {
  variant: "matcha" | "sun" | "tomato" | "sky" | "fog" | "espresso";
  children: React.ReactNode;
}) {
  const styles: Record<string, string> = {
    matcha: "bg-matcha text-cream",
    sun: "bg-sun text-espresso",
    tomato: "bg-tomato text-cream",
    sky: "bg-sky text-espresso",
    fog: "bg-fog text-espresso",
    espresso: "bg-espresso text-cream",
  };
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full border-2 border-espresso text-[10px] font-extrabold tracking-[.1em] uppercase ${styles[variant]}`}
    >
      {children}
    </span>
  );
}

function MerninInput({
  id,
  value,
  onChange,
  placeholder,
  type = "text",
  step,
}: {
  id?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  type?: string;
  step?: string;
}) {
  return (
    <input
      id={id}
      type={type}
      step={step}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className="w-full bg-chalk border-[3px] border-espresso rounded-[10px] px-3.5 py-2.5 font-body text-[14px] text-espresso shadow-[3px_3px_0_#1C0F05] outline-none placeholder:text-muted-foreground focus:-translate-x-[1px] focus:-translate-y-[1px] focus:shadow-[4px_4px_0_#E8442A] focus:border-tomato transition-all duration-100"
    />
  );
}

function MerninTextarea({
  id,
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  id?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <textarea
      id={id}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      rows={rows}
      className="w-full bg-chalk border-[3px] border-espresso rounded-[10px] px-3.5 py-2.5 font-body text-[14px] text-espresso shadow-[3px_3px_0_#1C0F05] outline-none placeholder:text-muted-foreground focus:-translate-x-[1px] focus:-translate-y-[1px] focus:shadow-[4px_4px_0_#E8442A] focus:border-tomato transition-all duration-100 resize-none"
    />
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

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProductVariant {
  id: string;
  title: string;
  sku: string | null;
  price: number | null;
  total_cogs: number | null;
}

interface Product {
  id: string;
  shopify_id: string | null;
  title: string;
  description: string | null;
  sku: string | null;
  price: number | null;
  total_cogs?: number | null;
  min_selling_price?: number | null;
  average_margin?: number | null;
  variants?: ProductVariant[];
  image_url: string | null;
  created_at: string;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ProductsClient({
  initialProducts,
  isShopifyConfigured,
}: {
  initialProducts: Product[];
  isShopifyConfigured: boolean;
}) {
  const [products, setProducts] = useState(initialProducts);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newProduct, setNewProduct] = useState({ title: "", description: "", sku: "", price: "" });

  const filteredProducts = products.filter(
    (p) =>
      p.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSync = async () => {
    setIsSyncing(true);
    setSyncMessage(null);
    const result = await syncShopifyProducts();
    if (result.error) {
      setSyncMessage({ type: "error", text: result.error });
    } else {
      setSyncMessage({ type: "success", text: `Synced ${result.count} products from Shopify.` });
      window.location.reload();
    }
    setIsSyncing(false);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setIsDeleting(true);
    const result = await deleteProduct(deleteId);
    if (result.error) {
      setSyncMessage({ type: "error", text: result.error });
    } else {
      setProducts(products.filter((p) => p.id !== deleteId));
      setSyncMessage({ type: "success", text: "Product deleted." });
    }
    setIsDeleting(false);
    setDeleteId(null);
  };

  const handleCreateProduct = async () => {
    if (!newProduct.title || !newProduct.price) {
      setSyncMessage({ type: "error", text: "Title and price are required" });
      return;
    }
    setIsCreating(true);
    const result = await createProduct({
      title: newProduct.title,
      description: newProduct.description || undefined,
      sku: newProduct.sku || undefined,
      price: parseFloat(newProduct.price),
    });
    if (result.error) {
      setSyncMessage({ type: "error", text: result.error });
    } else {
      setSyncMessage({ type: "success", text: "Product created." });
      setNewProduct({ title: "", description: "", sku: "", price: "" });
      setIsAddDialogOpen(false);
      window.location.reload();
    }
    setIsCreating(false);
  };

  const calcMargin = (price: number | null, cogs: number | null | undefined) => {
    if (!price || !cogs) return null;
    return ((price - cogs) / price) * 100;
  };

  const marginPill = (margin: number | null) => {
    if (margin === null) return <span className="text-muted-foreground">—</span>;
    const variant = margin >= 30 ? "matcha" : margin >= 15 ? "sun" : "tomato";
    return <Pill variant={variant}>{margin.toFixed(1)}%</Pill>;
  };

  const renderVariantDropdown = (product: Product) => {
    const variants = product.variants || [];
    if (variants.length === 0)
      return <span className="text-[11px] text-muted-foreground font-bold uppercase tracking-wide">No variants</span>;
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="inline-flex items-center gap-1.5 h-[28px] px-3 rounded-full border-[2px] border-espresso text-espresso text-[11px] font-extrabold uppercase tracking-[.08em] bg-transparent hover:bg-fog/40 transition-colors">
            {variants.length} variant{variants.length !== 1 ? "s" : ""}
            <ChevronDown size={12} strokeWidth={2.5} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-80 border-[2px] border-espresso rounded-[12px] shadow-flat-md bg-chalk p-0 overflow-hidden">
          <DropdownMenuLabel className="px-4 py-3 border-b-2 border-espresso font-extrabold text-[11px] uppercase tracking-[.1em] bg-cream">
            Variant COGS & Margin
          </DropdownMenuLabel>
          <DropdownMenuSeparator className="hidden" />
          <div className="max-h-80 overflow-y-auto p-3 space-y-2">
            {variants.map((variant) => {
              const margin = calcMargin(variant.price, variant.total_cogs);
              return (
                <div key={variant.id} className="rounded-[10px] border-[2px] border-espresso bg-cream p-3">
                  <p className="text-[13px] font-bold text-espresso">{variant.title}</p>
                  {variant.sku && (
                    <p className="font-mono text-[10px] text-muted-foreground mt-0.5">{variant.sku}</p>
                  )}
                  <div className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
                    <div>
                      <p className="text-muted-foreground font-bold uppercase tracking-wide text-[9px]">Price</p>
                      <p className="font-bold text-espresso">{variant.price ? `$${variant.price.toFixed(2)}` : "—"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground font-bold uppercase tracking-wide text-[9px]">COGS</p>
                      <p className="font-bold text-espresso">{variant.total_cogs ? `$${variant.total_cogs.toFixed(2)}` : "—"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground font-bold uppercase tracking-wide text-[9px]">Margin</p>
                      <div className="mt-0.5">{marginPill(margin)}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  // Stats
  const allVariantMargins = products.flatMap((p) =>
    (p.variants || [])
      .map((v) => calcMargin(v.price, v.total_cogs))
      .filter((m): m is number => m !== null)
  );
  const avgMargin =
    allVariantMargins.length > 0
      ? allVariantMargins.reduce((s, m) => s + m, 0) / allVariantMargins.length
      : 0;
  const variantCount = products.reduce((s, p) => s + (p.variants?.length || 0), 0);
  const needingCogs = products.filter((p) => !p.total_cogs || p.total_cogs === 0).length;

  return (
    <div className="flex flex-col gap-5 p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-[28px] md:text-[36px] font-extrabold uppercase tracking-tight leading-none text-espresso">
            Products
          </h1>
          <p className="text-[13px] text-muted-foreground mt-1">
            Manage your catalog and COGS calculations
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Btn variant="outline" size="sm">
                <Plus size={14} strokeWidth={2.5} />
                <span className="hidden sm:inline">Add Product</span>
                <span className="sm:hidden">Add</span>
              </Btn>
            </DialogTrigger>
            <DialogContent className="border-[3px] border-espresso rounded-[20px] shadow-flat-lg bg-chalk p-0 overflow-hidden gap-0">
              <DialogHeader className="px-6 py-5 border-b-[3px] border-espresso bg-cream">
                <DialogTitle className="font-extrabold text-[18px] uppercase tracking-[.06em] text-espresso">
                  Add New Product
                </DialogTitle>
                <DialogDescription className="text-[13px] text-muted-foreground mt-0.5">
                  Create a product manually without Shopify
                </DialogDescription>
              </DialogHeader>
              <div className="px-6 py-5 flex flex-col gap-4">
                <div>
                  <FieldLabel htmlFor="title">Product Title *</FieldLabel>
                  <MerninInput
                    id="title"
                    value={newProduct.title}
                    onChange={(e) => setNewProduct({ ...newProduct, title: e.target.value })}
                    placeholder="e.g., Ethiopia Yirgacheffe 12oz"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <FieldLabel htmlFor="sku">SKU</FieldLabel>
                    <MerninInput
                      id="sku"
                      value={newProduct.sku}
                      onChange={(e) => setNewProduct({ ...newProduct, sku: e.target.value })}
                      placeholder="COFFEE-ETH-12"
                    />
                  </div>
                  <div>
                    <FieldLabel htmlFor="price">Selling Price ($) *</FieldLabel>
                    <MerninInput
                      id="price"
                      type="number"
                      step="0.01"
                      value={newProduct.price}
                      onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })}
                      placeholder="18.00"
                    />
                  </div>
                </div>
                <div>
                  <FieldLabel htmlFor="description">Description</FieldLabel>
                  <MerninTextarea
                    id="description"
                    value={newProduct.description}
                    onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                    placeholder="Product description..."
                    rows={3}
                  />
                </div>
              </div>
              <DialogFooter className="px-6 py-4 border-t-[3px] border-espresso bg-cream flex gap-2">
                <Btn variant="outline" size="sm" onClick={() => setIsAddDialogOpen(false)}>
                  Cancel
                </Btn>
                <Btn
                  size="sm"
                  onClick={handleCreateProduct}
                  disabled={isCreating || !newProduct.title || !newProduct.price}
                >
                  {isCreating && <Loader2 size={13} className="animate-spin" />}
                  Create Product
                </Btn>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Btn
            onClick={handleSync}
            disabled={!isShopifyConfigured || isSyncing}
            size="sm"
          >
            {isSyncing ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <RefreshCw size={13} strokeWidth={2.5} />
            )}
            <span className="hidden sm:inline">Sync Shopify</span>
            <span className="sm:hidden">Sync</span>
          </Btn>
        </div>
      </div>

      {/* Toast */}
      {syncMessage && (
        <div
          className={`flex items-center gap-2.5 rounded-[12px] border-[2.5px] p-3 text-[13px] font-bold ${
            syncMessage.type === "error"
              ? "border-tomato bg-tomato/10 text-tomato"
              : "border-matcha bg-matcha/10 text-matcha"
          }`}
        >
          <AlertCircle size={15} strokeWidth={2.5} />
          {syncMessage.text}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-chalk border-[3px] border-espresso rounded-[14px] p-4 shadow-flat-md">
          <div className="text-[10.5px] font-extrabold tracking-[.12em] uppercase text-muted-foreground">
            Total Products
          </div>
          <div className="font-extrabold text-[42px] leading-none mt-1.5 text-espresso">
            {products.length}
          </div>
          <p className="text-[10.5px] text-muted-foreground mt-1.5">
            {needingCogs} need COGS assigned
          </p>
        </div>
        <div className="bg-chalk border-[3px] border-espresso rounded-[14px] p-4 shadow-flat-md">
          <div className="text-[10.5px] font-extrabold tracking-[.12em] uppercase text-muted-foreground">
            Avg Variant Margin
          </div>
          <div className="font-extrabold text-[42px] leading-none mt-1.5 text-espresso">
            {avgMargin > 0 ? `${avgMargin.toFixed(1)}%` : "—"}
          </div>
          <p className="text-[10.5px] text-muted-foreground mt-1.5">
            Across {variantCount} variants
          </p>
        </div>
      </div>

      {/* Shopify not connected */}
      {!isShopifyConfigured && (
        <div className="bg-sun/20 border-[3px] border-espresso rounded-[16px] p-5 shadow-flat-md flex items-start gap-4">
          <div className="w-10 h-10 bg-sun border-[2.5px] border-espresso rounded-[10px] flex items-center justify-center shrink-0">
            <AlertCircle size={18} strokeWidth={2.5} className="text-espresso" />
          </div>
          <div className="flex-1">
            <div className="font-extrabold text-[15px] uppercase tracking-[.06em] text-espresso">
              Shopify Not Connected
            </div>
            <p className="text-[13px] text-muted-foreground mt-1">
              Connect your Shopify store to import products automatically.
            </p>
          </div>
          <Btn variant="outline" size="sm" href="/settings">
            <Settings size={13} strokeWidth={2.5} />
            Settings
          </Btn>
        </div>
      )}

      {/* Product catalog panel */}
      <div className="bg-chalk border-[3px] border-espresso rounded-[16px] shadow-flat-md overflow-hidden">
        {/* Panel header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-5 py-4 border-b-2 border-espresso bg-cream">
          <div>
            <div className="font-extrabold text-sm uppercase tracking-[.08em] text-espresso">
              Product Catalog
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              {filteredProducts.length} product{filteredProducts.length !== 1 ? "s" : ""}
            </div>
          </div>
          <div className="relative w-full sm:w-56">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <input
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-[34px] bg-chalk border-[2.5px] border-espresso rounded-full pl-8 pr-3.5 text-[12px] font-bold text-espresso placeholder:text-muted-foreground outline-none focus:border-tomato transition-colors"
            />
          </div>
        </div>

        {/* Content */}
        {filteredProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-6">
            <div className="w-14 h-14 bg-fog border-[3px] border-espresso rounded-[16px] flex items-center justify-center mb-4">
              <Package size={24} strokeWidth={2} className="text-muted-foreground" />
            </div>
            <div className="font-extrabold text-[16px] uppercase tracking-[.06em] text-espresso">
              No products found
            </div>
            <p className="text-[13px] text-muted-foreground mt-1.5 max-w-xs">
              {products.length === 0
                ? "Sync your products from Shopify to get started"
                : "Try adjusting your search query"}
            </p>
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="md:hidden divide-y-2 divide-fog">
              {filteredProducts.map((product) => {
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
                          <p className="font-mono text-[10px] text-muted-foreground mt-0.5">
                            {product.sku}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Btn variant="ghost" size="sm" href={`/products/${product.id}`} className="!px-2 !h-8">
                          <ExternalLink size={14} strokeWidth={2} />
                        </Btn>
                        <button
                          onClick={() => setDeleteId(product.id)}
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
                        <div className="mt-0.5">{marginPill(margin)}</div>
                      </div>
                    </div>
                    <div>{renderVariantDropdown(product)}</div>
                  </div>
                );
              })}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr className="border-b-2 border-espresso bg-cream/60">
                    {["Product", "SKU", "Min Price", "COGS", "Avg Margin", "Variants", ""].map(
                      (h, i) => (
                        <th
                          key={i}
                          className={`py-3 px-4 text-[9.5px] font-extrabold uppercase tracking-[.1em] text-muted-foreground ${
                            i > 1 ? "text-right" : "text-left"
                          } ${i === 6 ? "w-20" : ""}`}
                        >
                          {h}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((product, idx) => {
                    const margin =
                      product.average_margin ?? calcMargin(product.price, product.total_cogs);
                    return (
                      <tr
                        key={product.id}
                        className={`border-b border-dashed border-fog last:border-0 hover:bg-cream/60 transition-colors ${
                          idx % 2 === 0 ? "" : "bg-chalk/40"
                        }`}
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            {product.image_url ? (
                              <Image
                                src={product.image_url}
                                alt={product.title}
                                width={36}
                                height={36}
                                className="rounded-[8px] border-[2px] border-espresso object-cover shrink-0"
                              />
                            ) : (
                              <div className="w-9 h-9 shrink-0 rounded-[8px] border-[2px] border-espresso bg-fog flex items-center justify-center">
                                <Package size={15} className="text-muted-foreground" />
                              </div>
                            )}
                            <Link
                              href={`/products/${product.id}`}
                              className="font-bold text-espresso hover:text-tomato transition-colors"
                            >
                              {product.title}
                            </Link>
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono text-[12px] text-muted-foreground">
                          {product.sku || "—"}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-espresso">
                          {product.min_selling_price != null
                            ? `$${product.min_selling_price.toFixed(2)}`
                            : "—"}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-espresso">
                          {product.total_cogs ? `$${product.total_cogs.toFixed(2)}` : "—"}
                        </td>
                        <td className="py-3 px-4 text-right">{marginPill(margin)}</td>
                        <td className="py-3 px-4 text-right">
                          {renderVariantDropdown(product)}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-end gap-1">
                            <Btn variant="ghost" size="sm" href={`/products/${product.id}`} className="!px-2 !h-8">
                              <ExternalLink size={14} strokeWidth={2} />
                            </Btn>
                            <button
                              onClick={() => setDeleteId(product.id)}
                              className="inline-flex items-center justify-center w-8 h-8 rounded-full border-[2px] border-transparent text-tomato hover:bg-tomato/10 transition-colors"
                            >
                              <Trash2 size={14} strokeWidth={2} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="border-[3px] border-espresso rounded-[20px] shadow-flat-lg bg-chalk p-0 overflow-hidden gap-0">
          <AlertDialogHeader className="px-6 py-5 border-b-[3px] border-espresso bg-cream">
            <AlertDialogTitle className="font-extrabold text-[18px] uppercase tracking-[.06em] text-espresso">
              Delete Product
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[13px] text-muted-foreground mt-0.5">
              This can&apos;t be undone. All associated COGS data will be removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="px-6 py-4 border-t-[3px] border-espresso bg-cream flex gap-2">
            <AlertDialogCancel
              disabled={isDeleting}
              className="inline-flex items-center gap-2 font-extrabold uppercase tracking-[.08em] rounded-full h-[30px] px-3.5 text-[11px] bg-transparent text-espresso border-[2.5px] border-espresso shadow-[3px_3px_0_#1C0F05] hover:-translate-x-[1.5px] hover:-translate-y-[1.5px] hover:shadow-[4px_4px_0_#1C0F05] transition-all duration-100"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="inline-flex items-center gap-2 font-extrabold uppercase tracking-[.08em] rounded-full h-[30px] px-3.5 text-[11px] bg-tomato text-cream border-[2.5px] border-espresso shadow-[3px_3px_0_#1C0F05] hover:-translate-x-[1.5px] hover:-translate-y-[1.5px] active:translate-x-[2.5px] active:translate-y-[2.5px] active:shadow-none transition-all duration-100"
            >
              {isDeleting && <Loader2 size={13} className="animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

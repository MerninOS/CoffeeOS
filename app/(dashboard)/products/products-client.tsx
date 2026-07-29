"use client";

import { useState } from "react";
import { syncShopifyProducts, deleteProduct, createProduct } from "./actions";
import { RefreshCw, Search, Package, AlertCircle, Loader2, Settings } from "lucide-react";
import { Btn } from "./components/primitives";
import { calcMargin } from "./components/margin";
import { ProductsTable } from "./components/ProductsTable";
import { ProductsMobileList } from "./components/ProductsMobileList";
import { AddProductDialog, DeleteProductDialog } from "./components/ProductDialogs";
import type { Product } from "./components/types";

/**
 * CoffeeOS#69 Stage A: this component was 766 lines. The primitives, the two row
 * renderings, the variant dropdown, the margin helpers and both dialogs moved
 * into ./components with their markup BYTE-IDENTICAL. Nothing was improved on
 * the way out — Stage A's proof is that the visual baselines do not move, and a
 * broken behaviour is only distinguishable from a changed pixel if exactly one
 * of them can happen at a time.
 *
 * What is left here is what actually belongs here: server-action handlers, the
 * page's own state, and composition.
 *
 * Behaviour preserved deliberately, and changed in later stages:
 *  - the stat tiles count over `products`, NOT `filteredProducts`, so searching
 *    moves the panel subheader and not the figures
 *  - `needingCogs` is a truthiness test on the total, so a genuinely $0-COGS
 *    product is reported as needing work (Criterion 2)
 *  - `avgMargin` means-averages every variant of every product flattened, so a
 *    product with 12 variants outweighs one with 1 (Criterion 13's sibling)
 *  - sync and create both hard-reload the window
 */
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
  const [syncMessage, setSyncMessage] = useState<{ type: "success" | "error"; text: string } | null>(
    null
  );
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
          <AddProductDialog
            open={isAddDialogOpen}
            onOpenChange={setIsAddDialogOpen}
            value={newProduct}
            onChange={setNewProduct}
            onCreate={handleCreateProduct}
            isCreating={isCreating}
          />

          <Btn onClick={handleSync} disabled={!isShopifyConfigured || isSyncing} size="sm">
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
          <p className="text-[10.5px] text-muted-foreground mt-1.5">Across {variantCount} variants</p>
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
            <ProductsMobileList products={filteredProducts} onDelete={setDeleteId} />
            <ProductsTable products={filteredProducts} onDelete={setDeleteId} />
          </>
        )}
      </div>

      {/* Delete confirm */}
      <DeleteProductDialog
        open={!!deleteId}
        onOpenChange={() => setDeleteId(null)}
        onConfirm={handleDelete}
        isDeleting={isDeleting}
      />
    </div>
  );
}

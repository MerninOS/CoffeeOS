"use client";

import { useState } from "react";
import {
  Button,
  HeroMetric,
  StatStrip,
  SegmentedControl,
  InlineBanner,
  Input,
  EmptyState,
} from "@merninos/ui/instrument";
import { RefreshCw, Search, Package, Plus, Settings } from "lucide-react";
import { syncShopifyProducts, deleteProduct, createProduct } from "./actions";
import { mono, overline, sans } from "@/lib/instrument/tokens";
import { calcMargin } from "./components/margin";
import { ProductsWorksheetTable } from "./components/ProductsWorksheetTable";
import { AddProductDialog, DeleteProductDialog } from "./components/ProductDialogs";
import type { Product } from "./components/types";

/**
 * CoffeeOS#69 Stage B — /products on the instrument design system.
 *
 * The reframe, from the approved proposal: this screen exists to answer "which
 * products are costed, and which are not". That question is now the hero figure,
 * a filter, and a red banner whose action IS the filter — instead of one
 * unclickable line of subtext.
 *
 * Design-system rules enforced here, none of them cosmetic:
 *  - every value is `var(--token)` in an inline style. Tailwind is layout and
 *    breakpoints only; its theme in this repo is the LOUD palette and would
 *    silently render the wrong system inside the instrument shell.
 *  - ONE hero figure plus ONE ruled stat strip — never a row of equal cards
 *    (Criterion 18). The old page had two equal stat cards.
 *  - `--brand` red is the live register and never fills a control. The primary
 *    action is ink (Criterion 6).
 *  - one rendering for both viewports; the `md:hidden` duplicate is gone
 *    (Criterion 21).
 *
 * WHAT THIS STAGE DOES NOT CHANGE. The figures are still computed the way
 * page.tsx computes them today — `productCogs[id] || averageVariantCogs`, and a
 * truthiness test for "needs COGS". So `needingCogs` still counts a genuinely
 * $0-costed product as needing work, and disagreeing variants are still averaged
 * into one plausible number. Stage C swaps the data source to
 * lib/products/costing.ts, which is when this page can honestly say `not set`
 * and tell those cases apart. Restyling and re-deriving in one commit would make
 * a wrong pixel and a wrong number indistinguishable — the same reason Stage A
 * was split from Stage B.
 */
type CostingFilter = "all" | "costed" | "uncosted";

export function ProductsClient({
  initialProducts,
  isShopifyConfigured,
}: {
  initialProducts: Product[];
  isShopifyConfigured: boolean;
}) {
  const [products, setProducts] = useState(initialProducts);
  const [searchQuery, setSearchQuery] = useState("");
  const [costing, setCosting] = useState<CostingFilter>("all");
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<{ type: "success" | "error"; text: string } | null>(
    null
  );
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newProduct, setNewProduct] = useState({ title: "", description: "", sku: "", price: "" });

  // Still the old predicate — see the note at the top of this file.
  const isUncosted = (p: Product) => !p.total_cogs || p.total_cogs === 0;

  const filteredProducts = products
    .filter((p) =>
      costing === "all" ? true : costing === "costed" ? !isUncosted(p) : isUncosted(p)
    )
    .filter(
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
  const needingCogs = products.filter(isUncosted).length;

  return (
    <div style={{ maxWidth: "var(--content-max)", margin: "0 auto", padding: "var(--space-6)" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 16,
          marginBottom: "var(--space-6)",
          flexWrap: "wrap",
        }}
      >
        <div>
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
            Products
          </h1>
          <p style={{ ...sans, color: "var(--ink-muted)", marginTop: 6, marginBottom: 0 }}>
            Every product and the recipe that gives it a cost.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Button
            variant="secondary"
            iconLeft={<RefreshCw size={14} strokeWidth={2} />}
            onClick={handleSync}
            disabled={!isShopifyConfigured || isSyncing}
          >
            {isSyncing ? "Syncing…" : "Sync Shopify"}
          </Button>
          <AddProductDialog
            open={isAddDialogOpen}
            onOpenChange={setIsAddDialogOpen}
            value={newProduct}
            onChange={setNewProduct}
            onCreate={handleCreateProduct}
            isCreating={isCreating}
            trigger={
              <Button variant="primary" iconLeft={<Plus size={14} strokeWidth={2} />}>
                Add product
              </Button>
            }
          />
        </div>
      </div>

      {syncMessage && (
        <div style={{ marginBottom: "var(--space-4)" }}>
          <InlineBanner
            tone={syncMessage.type === "error" ? "danger" : "success"}
            onDismiss={() => setSyncMessage(null)}
          >
            {syncMessage.text}
          </InlineBanner>
        </div>
      )}

      {/* One hero + one ruled strip. Never a row of equal cards. */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "var(--space-6)",
          alignItems: "end",
          marginBottom: "var(--space-5)",
        }}
      >
        <div style={{ flex: "0 0 300px" }}>
          <HeroMetric
            label="Not costed"
            value={String(needingCogs)}
            note={`of ${products.length} products`}
          />
        </div>
        <div style={{ flex: "1 1 480px", minWidth: 0 }}>
          <StatStrip
            stats={[
              { label: "Products", value: String(products.length) },
              { label: "Costed", value: String(products.length - needingCogs) },
              { label: "Variants", value: String(variantCount) },
              {
                label: "Avg margin · variants",
                value: avgMargin > 0 ? avgMargin.toFixed(1) : "—",
                unit: avgMargin > 0 ? "%" : undefined,
              },
            ]}
          />
        </div>
      </div>

      {/* The live register: the one thing on this page that needs the operator.
          The count is the filter — the banner's action scopes the table to it. */}
      {needingCogs > 0 && (
        <div style={{ marginBottom: "var(--space-4)" }}>
          <InlineBanner
            tone="danger"
            title={`${needingCogs} product${needingCogs === 1 ? " has" : "s have"} no recipe`}
            action={
              <Button size="sm" variant="secondary" onClick={() => setCosting("uncosted")}>
                Show them
              </Button>
            }
          >
            Every margin above, and every COGS figure on Orders, is computed without them.
          </InlineBanner>
        </div>
      )}

      {!isShopifyConfigured && (
        <div style={{ marginBottom: "var(--space-4)" }}>
          <InlineBanner
            tone="warning"
            title="Shopify not connected"
            action={
              <Button size="sm" variant="secondary" iconLeft={<Settings size={13} strokeWidth={2} />}>
                Settings
              </Button>
            }
          >
            Connect your Shopify store to import products automatically.
          </InlineBanner>
        </div>
      )}

      {/* Filter bar — a genuinely modular bordered container, which the worksheet
          model does allow. The table below is not one. */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: 10,
          background: "var(--surface-sunken)",
          border: "1px solid var(--hairline)",
          borderRadius: "var(--r-md)",
          marginBottom: "var(--space-4)",
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: "1 1 220px", minWidth: 180, maxWidth: 300 }}>
          <Input
            size="sm"
            mono
            leading={<Search size={14} strokeWidth={2} />}
            placeholder="Title or SKU"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <SegmentedControl
          size="sm"
          value={costing}
          onChange={(v) => setCosting(v as CostingFilter)}
          options={[
            { value: "all", label: "All" },
            { value: "costed", label: "Costed" },
            { value: "uncosted", label: "Not costed" },
          ]}
        />
      </div>

      {filteredProducts.length === 0 ? (
        <EmptyState
          icon={<Package size={20} strokeWidth={1.5} />}
          title="Nothing matches"
          description={
            products.length === 0
              ? "Sync your products from Shopify to get started."
              : "No product fits the current filters. Clearing them shows the full catalogue."
          }
          action={
            <Button
              variant="secondary"
              onClick={() => {
                setSearchQuery("");
                setCosting("all");
              }}
            >
              Clear filters
            </Button>
          }
        />
      ) : (
        <ProductsWorksheetTable products={filteredProducts} onDelete={setDeleteId} />
      )}

      {/* Scope stated plainly. The figures above are catalogue-wide; this line is
          about what is rendered. Three copy defects on /orders came from blurring
          exactly this distinction. */}
      <div style={{ marginTop: "var(--space-4)" }}>
        <span style={{ ...mono, fontSize: "var(--fs-caption)", color: "var(--ink-muted)" }}>
          {filteredProducts.length} shown of {products.length} products
        </span>
      </div>

      <DeleteProductDialog
        open={!!deleteId}
        onOpenChange={() => setDeleteId(null)}
        onConfirm={handleDelete}
        isDeleting={isDeleting}
      />
    </div>
  );
}

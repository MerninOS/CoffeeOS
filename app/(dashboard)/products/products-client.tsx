"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { syncShopifyProducts, deleteProduct, createProduct } from "./actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  Percent,
  ChevronDown,
} from "lucide-react";

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

interface ProductsClientProps {
  initialProducts: Product[];
  isShopifyConfigured: boolean;
}

export function ProductsClient({
  initialProducts,
  isShopifyConfigured,
}: ProductsClientProps) {
  const [products, setProducts] = useState(initialProducts);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newProduct, setNewProduct] = useState({
    title: "",
    description: "",
    sku: "",
    price: "",
  });

  const filteredProducts = products.filter(
    (product) =>
      product.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.sku?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSync = async () => {
    setIsSyncing(true);
    setSyncMessage(null);

    const result = await syncShopifyProducts();

    if (result.error) {
      setSyncMessage({ type: "error", text: result.error });
    } else {
      setSyncMessage({
        type: "success",
        text: `Successfully synced ${result.count} products from Shopify`,
      });
      // Refresh the page to get updated products
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
      setSyncMessage({ type: "success", text: "Product deleted successfully" });
    }

    setIsDeleting(false);
    setDeleteId(null);
  };

  const calculateMargin = (price: number | null, cogs: number | null | undefined) => {
    if (!price || !cogs) return null;
    return ((price - cogs) / price) * 100;
  };

  const renderVariantDropdown = (product: Product) => {
    const variants = product.variants || [];
    if (variants.length === 0) {
      return <span className="text-xs text-muted-foreground">No variants</span>;
    }

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-8">
            {variants.length} variants
            <ChevronDown className="ml-2 h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-80">
          <DropdownMenuLabel>Variant COGS & Margin</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <div className="max-h-80 space-y-2 overflow-y-auto p-2">
            {variants.map((variant) => {
              const margin = calculateMargin(variant.price, variant.total_cogs);
              return (
                <div key={variant.id} className="rounded-md border p-2">
                  <p className="text-sm font-medium">{variant.title}</p>
                  {variant.sku ? (
                    <p className="font-mono text-[11px] text-muted-foreground">{variant.sku}</p>
                  ) : null}
                  <div className="mt-1 grid grid-cols-3 gap-1 text-xs">
                    <div>
                      <p className="text-muted-foreground">Price</p>
                      <p>{variant.price ? `$${variant.price.toFixed(2)}` : "-"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">COGS</p>
                      <p>{variant.total_cogs ? `$${variant.total_cogs.toFixed(2)}` : "-"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Margin</p>
                      <p>{margin !== null ? `${margin.toFixed(1)}%` : "-"}</p>
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
      setSyncMessage({ type: "success", text: "Product created successfully" });
      setNewProduct({ title: "", description: "", sku: "", price: "" });
      setIsAddDialogOpen(false);
      window.location.reload();
    }

    setIsCreating(false);
  };

  // Calculate stats
  const totalProducts = products.length;
  const allVariantMargins = products.flatMap((product) =>
    (product.variants || [])
      .map((variant) => calculateMargin(variant.price, variant.total_cogs))
      .filter((margin): margin is number => margin !== null)
  );
  const avgMargin = allVariantMargins.length > 0
    ? allVariantMargins.reduce((sum, margin) => sum + margin, 0) / allVariantMargins.length
    : 0;
  const variantCount = products.reduce((sum, product) => sum + (product.variants?.length || 0), 0);
  const productsNeedingCogs = products.filter((p) => !p.total_cogs || p.total_cogs === 0).length;

  return (
    <div className="space-y-6">
     <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight md:text-3xl">Products</h1>
          <p className="text-sm text-muted-foreground md:text-base">
            Manage your product catalog and COGS calculations
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="md:size-default">
                <Plus className="mr-1.5 h-3.5 w-3.5 md:mr-2 md:h-4 md:w-4" />
                <span className="hidden sm:inline">Add Product</span>
                <span className="sm:hidden">Add</span>
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Product</DialogTitle>
                <DialogDescription>
                  Create a product manually without Shopify
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Product Title *</Label>
                  <Input
                    id="title"
                    value={newProduct.title}
                    onChange={(e) => setNewProduct({ ...newProduct, title: e.target.value })}
                    placeholder="e.g., Ethiopia Yirgacheffe 12oz"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="sku">SKU</Label>
                    <Input
                      id="sku"
                      value={newProduct.sku}
                      onChange={(e) => setNewProduct({ ...newProduct, sku: e.target.value })}
                      placeholder="e.g., COFFEE-ETH-12"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="price">Selling Price ($) *</Label>
                    <Input
                      id="price"
                      type="number"
                      step="0.01"
                      value={newProduct.price}
                      onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })}
                      placeholder="e.g., 18.00"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={newProduct.description}
                    onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                    placeholder="Product description..."
                    rows={3}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateProduct} disabled={isCreating || !newProduct.title || !newProduct.price}>
                  {isCreating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Create Product
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button onClick={handleSync} disabled={!isShopifyConfigured || isSyncing} size="sm" className="md:size-default">
            {isSyncing ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin md:mr-2 md:h-4 md:w-4" />
            ) : (
              <RefreshCw className="mr-1.5 h-3.5 w-3.5 md:mr-2 md:h-4 md:w-4" />
            )}
            <span className="hidden sm:inline">Sync from Shopify</span>
            <span className="sm:hidden">Sync</span>
          </Button>
        </div>
      </div>

      {syncMessage && (
        <div
          className={`flex items-center gap-2 rounded-md p-3 text-sm ${
            syncMessage.type === "error"
              ? "bg-destructive/10 text-destructive"
              : "bg-green-500/10 text-green-600"
          }`}
        >
          <AlertCircle className="h-4 w-4" />
          {syncMessage.text}
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-2 md:gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 px-3 pb-1 pt-3 md:px-6 md:pb-2 md:pt-6">
            <CardTitle className="text-xs font-medium md:text-sm">Total Products</CardTitle>
            <Package className="hidden h-4 w-4 text-muted-foreground md:block" />
          </CardHeader>
          <CardContent className="px-3 pb-3 md:px-6 md:pb-6">
            <div className="text-lg font-bold md:text-2xl">{totalProducts}</div>
            <p className="text-[10px] text-muted-foreground md:text-xs">
              {productsNeedingCogs} need COGS assigned
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 px-3 pb-1 pt-3 md:px-6 md:pb-2 md:pt-6">
            <CardTitle className="text-xs font-medium md:text-sm">Avg Variant Margin</CardTitle>
            <Percent className="hidden h-4 w-4 text-muted-foreground md:block" />
          </CardHeader>
          <CardContent className="px-3 pb-3 md:px-6 md:pb-6">
            <div className="text-lg font-bold md:text-2xl">{avgMargin.toFixed(1)}%</div>
            <p className="text-[10px] text-muted-foreground md:text-xs">
              Across {variantCount} variants
            </p>
          </CardContent>
        </Card>
      </div>

      {!isShopifyConfigured && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg text-amber-800">
              Shopify Not Connected
            </CardTitle>
            <CardDescription className="text-amber-700">
              Connect your Shopify store to import products automatically.{" "}
              <Link href="/settings" className="font-medium underline">
                Go to Settings
              </Link>
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <Card className="shadow-xl">
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Product Catalog</CardTitle>
              <CardDescription>
                {filteredProducts.length} product
                {filteredProducts.length !== 1 ? "s" : ""} in your catalog
              </CardDescription>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Package className="mb-4 h-12 w-12 text-muted-foreground" />
              <h3 className="text-lg font-medium">No products found</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {products.length === 0
                  ? "Sync your products from Shopify to get started"
                  : "Try adjusting your search query"}
              </p>
            </div>
          ) : (
            <>
            {/* Mobile card layout */}
            <div className="space-y-2 md:hidden">
              {filteredProducts.map((product) => {
                const margin = product.average_margin ?? calculateMargin(product.price, product.total_cogs);
                return (
                  <div key={product.id} className="rounded-lg border p-3">
                    <div className="flex items-start gap-3">
                      {product.image_url ? (
                        <Image
                          src={product.image_url || "/placeholder.svg"}
                          alt={product.title}
                          width={40}
                          height={40}
                          className="shrink-0 rounded-md object-cover"
                        />
                      ) : (
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted">
                          <Package className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/products/${product.id}`}
                          className="text-sm font-medium hover:underline leading-tight"
                        >
                          {product.title}
                        </Link>
                        {product.sku && (
                          <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">{product.sku}</p>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                          <Link href={`/products/${product.id}`}>
                            <ExternalLink className="h-3.5 w-3.5" />
                            <span className="sr-only">View product</span>
                          </Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => setDeleteId(product.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span className="sr-only">Delete product</span>
                        </Button>
                      </div>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-1 text-xs">
                      <div>
                        <span className="text-muted-foreground">Min Price</span>
                        <p className="font-medium">
                          {product.min_selling_price !== null && product.min_selling_price !== undefined
                            ? `$${product.min_selling_price.toFixed(2)}`
                            : "-"}
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">COGS</span>
                        <p className="font-medium">{product.total_cogs ? `$${product.total_cogs.toFixed(2)}` : "-"}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Avg Margin</span>
                        {margin !== null ? (
                          <Badge
                            variant="outline"
                            className={`mt-0.5 text-[10px] px-1.5 ${
                              margin >= 30
                                ? "bg-green-500/10 text-green-600"
                                : margin >= 15
                                  ? "bg-amber-500/10 text-amber-600"
                                  : "bg-red-500/10 text-red-600"
                            }`}
                          >
                            {margin.toFixed(1)}%
                          </Badge>
                        ) : (
                          <p className="font-medium">-</p>
                        )}
                      </div>
                    </div>
                    <div className="mt-2">
                      {renderVariantDropdown(product)}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop table layout */}
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead className="text-right">Min Selling Price</TableHead>
                    <TableHead className="text-right">COGS</TableHead>
                    <TableHead className="text-right">Avg Margin</TableHead>
                    <TableHead className="text-right">Variants</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.map((product) => {
                    const margin = product.average_margin ?? calculateMargin(product.price, product.total_cogs);

                    return (
                      <TableRow key={product.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            {product.image_url ? (
                              <Image
                                src={product.image_url || "/placeholder.svg"}
                                alt={product.title}
                                width={40}
                                height={40}
                                className="rounded-md object-cover"
                              />
                            ) : (
                              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted">
                                <Package className="h-5 w-5 text-muted-foreground" />
                              </div>
                            )}
                            <div>
                              <Link
                                href={`/products/${product.id}`}
                                className="font-medium hover:underline"
                              >
                                {product.title}
                              </Link>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {product.sku || "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          {product.min_selling_price !== null && product.min_selling_price !== undefined
                            ? `$${product.min_selling_price.toFixed(2)}`
                            : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          {product.total_cogs
                            ? `$${product.total_cogs.toFixed(2)}`
                            : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          {margin !== null ? (
                            <Badge
                              variant={margin >= 30 ? "default" : "secondary"}
                              className={
                                margin >= 30
                                  ? "bg-green-500/10 text-green-600 hover:bg-green-500/20"
                                  : margin >= 15
                                    ? "bg-amber-500/10 text-amber-600 hover:bg-amber-500/20"
                                    : "bg-red-500/10 text-red-600 hover:bg-red-500/20"
                              }
                            >
                              {margin.toFixed(1)}%
                            </Badge>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end">
                            {renderVariantDropdown(product)}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button variant="ghost" size="sm" asChild>
                              <Link href={`/products/${product.id}`}>
                                <ExternalLink className="h-4 w-4" />
                                <span className="sr-only">View product</span>
                              </Link>
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeleteId(product.id)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                              <span className="sr-only">Delete product</span>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            </>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Product</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this product? This action cannot be
              undone and will remove all associated COGS data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

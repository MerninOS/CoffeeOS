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
  RefreshCw,
  Search,
  Package,
  AlertCircle,
  Trash2,
  ExternalLink,
  Loader2,
  Plus,
  TrendingUp,
  DollarSign,
  Percent,
} from "lucide-react";

interface Product {
  id: string;
  shopify_id: string | null;
  title: string;
  description: string | null;
  sku: string | null;
  price: number | null;
  total_cogs?: number | null;
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
  const productsWithCogs = products.filter((p) => p.total_cogs && p.total_cogs > 0);
  const totalRevenue = products.reduce((sum, p) => sum + (p.price || 0), 0);
  const totalCogs = products.reduce((sum, p) => sum + (p.total_cogs || 0), 0);
  const avgMargin = productsWithCogs.length > 0
    ? productsWithCogs.reduce((sum, p) => {
        const margin = calculateMargin(p.price, p.total_cogs);
        return sum + (margin || 0);
      }, 0) / productsWithCogs.length
    : 0;
  const productsNeedingCogs = products.filter((p) => !p.total_cogs || p.total_cogs === 0).length;

  return (
    <div className="space-y-6">
     <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Products</h1>
          <p className="text-muted-foreground">
            Manage your product catalog and COGS calculations
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Plus className="mr-2 h-4 w-4" />
                Add Product
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
          <Button onClick={handleSync} disabled={!isShopifyConfigured || isSyncing}>
            {isSyncing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Sync from Shopify
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
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Products</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalProducts}</div>
            <p className="text-xs text-muted-foreground">
              {productsNeedingCogs} need COGS assigned
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Catalog Value</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalRevenue.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              Total selling prices
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total COGS</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalCogs.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              Cost of goods sold
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Margin</CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgMargin.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              Across {productsWithCogs.length} products
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
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead className="text-right">Selling Price</TableHead>
                    <TableHead className="text-right">COGS</TableHead>
                    <TableHead className="text-right">Margin</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.map((product) => {
                    const margin = calculateMargin(
                      product.price,
                      product.total_cogs
                    );

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
                          {product.price
                            ? `$${product.price.toFixed(2)}`
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

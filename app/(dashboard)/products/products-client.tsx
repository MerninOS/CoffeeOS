"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { syncShopifyProducts, deleteProduct } from "./actions";
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
import {
  RefreshCw,
  Search,
  Package,
  AlertCircle,
  Trash2,
  ExternalLink,
  Loader2,
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

  return (
    <div className="space-y-6">
     <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Products</h1>
          <p className="text-muted-foreground">
            Manage your product catalog and COGS calculations
          </p>
        </div>
        <Button onClick={handleSync} disabled={!isShopifyConfigured || isSyncing}>
          {isSyncing ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Sync from Shopify
        </Button>
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

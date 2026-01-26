"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { updateProductComponents, updateProductPrice } from "./actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
} from "lucide-react";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

interface Component {
  id: string;
  name: string;
  cost_per_unit: number;
  unit: string;
  type: string;
}

interface ProductComponent {
  id: string;
  quantity: number;
  component_id: string;
  components: Component | null;
}

interface Product {
  id: string;
  title: string;
  description: string | null;
  sku: string | null;
  price: number | null;
  image_url: string | null;
}

interface ProductDetailClientProps {
  product: Product;
  availableComponents: Component[];
  productComponents: ProductComponent[];
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
}: ProductDetailClientProps) {
  const [selectedComponents, setSelectedComponents] = useState<SelectedComponent[]>(
    initialProductComponents.map((pc) => ({
      componentId: pc.component_id,
      quantity: pc.quantity,
    }))
  );

  const [sellingPrice, setSellingPrice] = useState(product.price?.toString() || "");
  const [isSaving, setIsSaving] = useState(false);
  const [isPriceUpdating, setIsPriceUpdating] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

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
    setIsSaving(true);
    setMessage(null);

    const result = await updateProductComponents(product.id, selectedComponents);

    if (result.error) {
      setMessage({ type: "error", text: result.error });
    } else {
      setMessage({ type: "success", text: "Components saved successfully" });
    }

    setIsSaving(false);
  };

  const handleUpdatePrice = async () => {
    const price = parseFloat(sellingPrice);
    if (isNaN(price) || price < 0) {
      setMessage({ type: "error", text: "Please enter a valid price" });
      return;
    }

    setIsPriceUpdating(true);
    setMessage(null);

    const result = await updateProductPrice(product.id, price);

    if (result.error) {
      setMessage({ type: "error", text: result.error });
    } else {
      setMessage({ type: "success", text: "Price updated successfully" });
    }

    setIsPriceUpdating(false);
  };

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
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Selling Price</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatMoney(priceValue)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total COGS</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatMoney(calculatedCogs)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Profit per Unit</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${profit >= 0 ? "text-green-600" : "text-destructive"}`}>
              {formatMoney(profit)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
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
                  src={product.image_url}
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
              {product.sku && (
                <p className="mt-1 font-mono text-sm text-muted-foreground">SKU: {product.sku}</p>
              )}
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
                    disabled={isPriceUpdating}
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
                              <SelectTrigger className="w-full">
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
                  disabled={isSaving}
                  className="w-full sm:w-auto"
                >
                  {isSaving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Save Components
                </Button>
              </div>
            </div>
          
            )}
          </CardContent>
        </Card>
      </div>

      {/* Summary Cards */}
      
    </div>
  );
}

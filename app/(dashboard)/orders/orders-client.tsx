"use client";

import React from "react"

import { useState } from "react";
import { format } from "date-fns";
import {
  RefreshCw,
  Search,
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingCart,
  Package,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Settings,
  Plus,
  Minus,
  Trash2,
  X,
  Truck,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

import { syncShopifyOrders, addOrderComponent, updateOrderComponentQuantity, removeOrderComponent, addOrderCustomCost, removeOrderCustomCost, createRoastRequestForOrder } from "./actions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Flame } from "lucide-react";

interface OrderLineItem {
  id: string;
  title: string;
  sku: string | null;
  quantity: number;
  price: number;
  total_price: number;
  product_id: string | null;
  shopify_product_id: string | null;
}

interface ComponentData {
  id: string;
  name: string;
  cost_per_unit: number;
  unit: string;
  type: string;
}

interface OrderComponent {
  id: string;
  component_id: string;
  quantity: number;
  components: ComponentData | null;
}

interface OrderCustomCost {
  id: string;
  description: string;
  amount: number;
}

interface Order {
  id: string;
  shopify_order_id: string;
  order_name: string;
  shopify_order_number: string;
  created_at_shopify: string;
  financial_status: string;
  fulfillment_status: string;
  subtotal_price: number;
  total_tax: number;
  total_price: number;
  currency: string;
  ready_to_ship: boolean;
  order_line_items: OrderLineItem[];
  order_components: OrderComponent[];
  order_custom_costs: OrderCustomCost[];
}

interface CoffeeInventory {
  id: string;
  name: string;
  origin: string;
  current_green_quantity_g: number;
}

const LBS_TO_GRAMS = 453.592;
const gramsToLbs = (g: number) => g / LBS_TO_GRAMS;

interface OrdersClientProps {
  initialOrders: Order[];
  productCogsMap: Record<string, number>;
  allComponents: ComponentData[];
  coffeeInventory: CoffeeInventory[];
  isAdminConfigured: boolean;
}

export function OrdersClient({
  initialOrders,
  productCogsMap,
  allComponents,
  coffeeInventory,
  isAdminConfigured,
}: OrdersClientProps) {
  const [orders, setOrders] = useState(initialOrders);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [addingComponentTo, setAddingComponentTo] = useState<string | null>(null);
  const [selectedComponentId, setSelectedComponentId] = useState<string>("");
  const [componentQuantity, setComponentQuantity] = useState<number>(1);
  const [addingCustomCostTo, setAddingCustomCostTo] = useState<string | null>(null);
  const [customCostDescription, setCustomCostDescription] = useState<string>("");
  const [customCostAmount, setCustomCostAmount] = useState<string>("");
  
  // Roast request state
  const [roastRequestOrder, setRoastRequestOrder] = useState<Order | null>(null);
  const [roastRequestData, setRoastRequestData] = useState({
    greenCoffeeId: "",
    quantityG: "",
    priority: "normal" as "low" | "normal" | "high" | "urgent",
    dueDate: "",
  });
  const [isCreatingRoastRequest, setIsCreatingRoastRequest] = useState(false);
  
  const filteredOrders = orders.filter(
    (order) =>
      order.order_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.order_line_items.some((item) =>
        item.title.toLowerCase().includes(searchQuery.toLowerCase())
      )
  );

  const handleSync = async () => {
    setIsSyncing(true);
    const result = await syncShopifyOrders();
    setIsSyncing(false);

    if (result.error) {
      alert(result.error);
      return;
    }

    if (result.success) {
      window.location.reload();
    }
  };

  const toggleOrderExpanded = (orderId: string) => {
    const newExpanded = new Set(expandedOrders);
    if (newExpanded.has(orderId)) {
      newExpanded.delete(orderId);
    } else {
      newExpanded.add(orderId);
    }
    setExpandedOrders(newExpanded);
  };

  // Helper to calculate COGS for a line item
  const getLineItemCogs = (item: OrderLineItem): number => {
    if (!item.product_id) return 0;
    const unitCogs = productCogsMap[item.product_id] || 0;
    return unitCogs * item.quantity;
  };

  // Helper to calculate order components COGS
  const getOrderComponentsCogs = (order: Order): number => {
    return (order.order_components || []).reduce((sum, oc) => {
      const cost = oc.components?.cost_per_unit || 0;
      return sum + cost * oc.quantity;
    }, 0);
  };

  // Helper to calculate custom costs total
  const getOrderCustomCostsTotal = (order: Order): number => {
    return (order.order_custom_costs || []).reduce((sum, cc) => sum + cc.amount, 0);
  };

  // Helper to calculate all additional costs (components + custom)
  const getTotalAdditionalCosts = (order: Order): number => {
    return getOrderComponentsCogs(order) + getOrderCustomCostsTotal(order);
  };

  // Helper to calculate order COGS (line items + order components + custom costs)
  const getOrderCogs = (order: Order): number => {
    const lineItemsCogs = order.order_line_items.reduce((sum, item) => sum + getLineItemCogs(item), 0);
    const additionalCosts = getTotalAdditionalCosts(order);
    return lineItemsCogs + additionalCosts;
  };

  // Handle adding a component to an order
  const handleAddComponent = async (orderId: string) => {
    if (!selectedComponentId || componentQuantity <= 0) return;
    
    const result = await addOrderComponent(orderId, selectedComponentId, componentQuantity);
    if (result.error) {
      alert(result.error);
    } else {
      setAddingComponentTo(null);
      setSelectedComponentId("");
      setComponentQuantity(1);
      window.location.reload();
    }
  };

  // Handle updating component quantity
  const handleUpdateQuantity = async (orderComponentId: string, newQuantity: number) => {
    const result = await updateOrderComponentQuantity(orderComponentId, newQuantity);
    if (result.error) {
      alert(result.error);
    } else {
      window.location.reload();
    }
  };

  // Handle removing a component
  const handleRemoveComponent = async (orderComponentId: string) => {
    const result = await removeOrderComponent(orderComponentId);
    if (result.error) {
      alert(result.error);
    } else {
      window.location.reload();
    }
  };

  // Handle adding a custom cost
  const handleAddCustomCost = async (orderId: string) => {
    const amount = parseFloat(customCostAmount);
    if (!customCostDescription.trim() || isNaN(amount) || amount <= 0) return;
    
    const result = await addOrderCustomCost(orderId, customCostDescription, amount);
    if (result.error) {
      alert(result.error);
    } else {
      setAddingCustomCostTo(null);
      setCustomCostDescription("");
      setCustomCostAmount("");
      window.location.reload();
    }
  };

  // Handle removing a custom cost
  const handleRemoveCustomCost = async (customCostId: string) => {
    const result = await removeOrderCustomCost(customCostId);
    if (result.error) {
      alert(result.error);
    } else {
      window.location.reload();
    }
  };

  // Handle creating a roast request
  const handleCreateRoastRequest = async () => {
    if (!roastRequestOrder || !roastRequestData.greenCoffeeId || !roastRequestData.quantityG) return;
    
    const selectedCoffee = coffeeInventory.find(c => c.id === roastRequestData.greenCoffeeId);
    if (!selectedCoffee) return;
    
    setIsCreatingRoastRequest(true);
    const quantityG = parseFloat(roastRequestData.quantityG);
    
    const result = await createRoastRequestForOrder({
      orderId: roastRequestOrder.id,
      greenCoffeeId: roastRequestData.greenCoffeeId,
      coffeeName: selectedCoffee.name,
      requestedRoastedG: quantityG,
      priority: roastRequestData.priority,
      dueDate: roastRequestData.dueDate || undefined,
    });
    
    setIsCreatingRoastRequest(false);
    
    if (result.error) {
      alert(result.error);
    } else {
      setRoastRequestOrder(null);
      setRoastRequestData({
        greenCoffeeId: "",
        quantityG: "",
        priority: "normal",
        dueDate: "",
      });
      if (result.merged) {
        alert(`Added ${quantityG}g to existing roast request for ${selectedCoffee.name}. View it in the Roasting page.`);
      } else {
        alert("Roast request created! View it in the Roasting page.");
      }
    }
  };

  // Calculate summary stats using actual COGS from product components
  const totalRevenue = orders.reduce((sum, o) => sum + (o.total_price || 0), 0);
  const totalCogs = orders.reduce((sum, o) => sum + getOrderCogs(o), 0);
  const totalProfit = totalRevenue - totalCogs;
  const avgMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

  const getFinancialStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "paid":
        return "bg-green-500/10 text-green-600";
      case "pending":
        return "bg-yellow-500/10 text-yellow-600";
      case "refunded":
      case "partially_refunded":
        return "bg-red-500/10 text-red-600";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getFulfillmentStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "fulfilled":
        return "bg-green-500/10 text-green-600";
      case "unfulfilled":
        return "bg-yellow-500/10 text-yellow-600";
      case "partially_fulfilled":
        return "bg-blue-500/10 text-blue-600";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  if (!isAdminConfigured) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Orders</h1>
          <p className="text-muted-foreground">
            Sync and analyze orders from your Shopify store
          </p>
        </div>

        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="mb-4 rounded-full bg-amber-500/10 p-3">
              <AlertCircle className="h-8 w-8 text-amber-600" />
            </div>
            <h3 className="mb-2 text-lg font-semibold">
              Admin API Not Configured
            </h3>
            <p className="mb-4 max-w-md text-center text-muted-foreground">
              To sync orders from Shopify, you need to add an Admin API access
              token in Settings. This requires a custom app with read_orders
              scope.
            </p>
            <Button asChild>
              <Link href="/settings">
                <Settings className="mr-2 h-4 w-4" />
                Go to Settings
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Orders</h1>
          <p className="text-muted-foreground">
            Track revenue, COGS, and profit margins per order
          </p>
        </div>
        <Button onClick={handleSync} disabled={isSyncing}>
          <RefreshCw
            className={`mr-2 h-4 w-4 ${isSyncing ? "animate-spin" : ""}`}
          />
          {isSyncing ? "Syncing..." : "Sync Orders"}
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <span className="text-2xl font-bold">
                ${totalRevenue.toFixed(2)}
              </span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total COGS
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              <span className="text-2xl font-bold">
                ${totalCogs.toFixed(2)}
              </span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Gross Profit
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {totalProfit >= 0 ? (
                <TrendingUp className="h-4 w-4 text-green-600" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-600" />
              )}
              <span
                className={`text-2xl font-bold ${totalProfit >= 0 ? "text-green-600" : "text-red-600"}`}
              >
                ${totalProfit.toFixed(2)}
              </span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Avg Profit Margin
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
              <span
                className={`text-2xl font-bold ${avgMargin >= 30 ? "text-green-600" : avgMargin >= 15 ? "text-amber-600" : "text-red-600"}`}
              >
                {avgMargin.toFixed(1)}%
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search orders..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Orders Table */}
      {orders.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ShoppingCart className="mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="mb-2 text-lg font-semibold">No orders yet</h3>
            <p className="mb-4 text-center text-muted-foreground">
              Click &quot;Sync Orders&quot; to import orders from Shopify
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Orders ({filteredOrders.length})</CardTitle>
            <CardDescription>
              Click an order to see line item details and COGS breakdown
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]"></TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-center">Ready</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">COGS</TableHead>
                  <TableHead className="text-right">Profit</TableHead>
                  <TableHead className="text-right">Margin</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.map((order) => (
                  <React.Fragment key={order.id}>
                    <TableRow 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => toggleOrderExpanded(order.id)}
                    >
                      <TableCell>
                        {expandedOrders.has(order.id) ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </TableCell>
                      <TableCell className="font-medium">
                        {order.order_name}
                      </TableCell>
                      <TableCell>
                        {order.created_at_shopify ? format(new Date(order.created_at_shopify), "MMM d, yyyy") : "-"}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Badge
                            variant="outline"
                            className={getFinancialStatusColor(
                              order.financial_status
                            )}
                          >
                            {order.financial_status}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={getFulfillmentStatusColor(
                              order.fulfillment_status
                            )}
                          >
                            {order.fulfillment_status}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        {order.ready_to_ship ? (
                          <Badge className="bg-green-500/10 text-green-600 border-green-500/20">
                            <Truck className="h-3 w-3" />
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        ${(order.total_price || 0).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        ${getOrderCogs(order).toFixed(2)}
                      </TableCell>
                      <TableCell className={`text-right font-medium ${(order.total_price || 0) - getOrderCogs(order) >= 0 ? "text-green-600" : "text-red-600"}`}>
                        ${((order.total_price || 0) - getOrderCogs(order)).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        {(() => {
                          const revenue = order.total_price || 0;
                          const cogs = getOrderCogs(order);
                          const margin = revenue > 0 ? ((revenue - cogs) / revenue) * 100 : 0;
                          return (
                            <Badge
                              variant="outline"
                              className={
                                margin >= 30
                                  ? "bg-green-500/10 text-green-600"
                                  : margin >= 15
                                    ? "bg-amber-500/10 text-amber-600"
                                    : "bg-red-500/10 text-red-600"
                              }
                            >
                              {margin.toFixed(1)}%
                            </Badge>
                          );
                        })()}
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/orders/${order.id}`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                    {expandedOrders.has(order.id) && (
                      <TableRow className="bg-muted/30">
                        <TableCell colSpan={10} className="p-0">
                          <div className="p-4">
                            <h4 className="mb-2 text-sm font-semibold">
                              Line Items
                            </h4>
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Product</TableHead>
                                  <TableHead>SKU</TableHead>
                                  <TableHead className="text-center">
                                    Qty
                                  </TableHead>
                                  <TableHead className="text-right">
                                    Unit Price
                                  </TableHead>
                                  <TableHead className="text-right">
                                    Unit COGS
                                  </TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {order.order_line_items.map((item) => (
                                  <TableRow key={item.id}>
                                    <TableCell>
                                      <div className="flex items-center gap-2">
                                        {item.title}
                                        {!item.product_id && (
                                          <Badge
                                            variant="outline"
                                            className="bg-amber-500/10 text-amber-600 text-xs"
                                          >
                                            No COGS
                                          </Badge>
                                        )}
                                      </div>
                                    </TableCell>
                                    <TableCell className="font-mono text-xs">
                                      {item.sku || "-"}
                                    </TableCell>
                                    <TableCell className="text-center">
                                      {item.quantity}
                                    </TableCell>
                                    <TableCell className="text-right">
                                      ${(item.price || 0).toFixed(2)}
                                    </TableCell>
                                    <TableCell className="text-right">
                                      {item.product_id ? (
                                        `$${(productCogsMap[item.product_id] || 0).toFixed(2)}`
                                      ) : (
                                        <span className="text-muted-foreground">-</span>
                                      )}
                                    </TableCell>
                                  </TableRow>
                                ))}
                                {/* Subtotal Row */}
                                <TableRow className="border-t">
                                  <TableCell colSpan={3} className="text-right text-muted-foreground">
                                    Subtotal
                                  </TableCell>
                                  <TableCell className="text-right">
                                    ${(order.subtotal_price || 0).toFixed(2)}
                                  </TableCell>
                                  <TableCell />
                                </TableRow>
                                {/* Shipping Row */}
                                <TableRow>
                                  <TableCell colSpan={3} className="text-right text-muted-foreground">
                                    Shipping
                                  </TableCell>
                                  <TableCell className="text-right">
                                    ${((order.total_price || 0) - (order.subtotal_price || 0) - (order.total_tax || 0)).toFixed(2)}
                                  </TableCell>
                                  <TableCell />
                                </TableRow>
                                {/* Tax Row */}
                                <TableRow>
                                  <TableCell colSpan={3} className="text-right text-muted-foreground">
                                    Tax
                                  </TableCell>
                                  <TableCell className="text-right">
                                    ${(order.total_tax || 0).toFixed(2)}
                                  </TableCell>
                                  <TableCell />
                                </TableRow>
                                {/* Total Row */}
                                <TableRow className="border-t bg-muted/30">
                                  <TableCell colSpan={3} className="text-right font-semibold">
                                    Total
                                  </TableCell>
                                  <TableCell className="text-right font-semibold">
                                    ${(order.total_price || 0).toFixed(2)}
                                  </TableCell>
                                  <TableCell />
                                </TableRow>
                              </TableBody>
                            </Table>
                            {order.order_line_items.some(
                              (item) => !item.product_id
                            ) && (
                              <p className="mt-2 text-xs text-muted-foreground">
                                Items marked &quot;No COGS&quot; are not
                                matched to a local product. Sync products and
                                add COGS to see accurate profit calculations.
                              </p>
                            )}

                            <Separator className="my-4" />

                            {/* Order Components Section */}
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <h4 className="text-sm font-semibold">
                                  Additional Costs (Packaging, Shipping, etc.)
                                </h4>
                                {addingComponentTo !== order.id && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setAddingComponentTo(order.id);
                                    }}
                                  >
                                    <Plus className="mr-1 h-3 w-3" />
                                    Add Cost
                                  </Button>
                                )}
                              </div>

                              {/* Add Component Form */}
                              {addingComponentTo === order.id && (
                                <div className="flex items-end gap-2 rounded-lg border bg-background p-3">
                                  <div className="flex-1">
                                    <label className="text-xs text-muted-foreground">Component</label>
                                    <Select
                                      value={selectedComponentId}
                                      onValueChange={setSelectedComponentId}
                                    >
                                      <SelectTrigger className="mt-1">
                                        <SelectValue placeholder="Select component..." />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {allComponents.map((comp) => (
                                          <SelectItem key={comp.id} value={comp.id}>
                                            {comp.name} (${comp.cost_per_unit.toFixed(2)}/{comp.unit})
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div className="w-24">
                                    <label className="text-xs text-muted-foreground">Qty</label>
                                    <Input
                                      type="number"
                                      min="1"
                                      value={componentQuantity}
                                      onChange={(e) => setComponentQuantity(parseInt(e.target.value) || 1)}
                                      className="mt-1"
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                  </div>
                                  <Button
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleAddComponent(order.id);
                                    }}
                                    disabled={!selectedComponentId}
                                  >
                                    Add
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setAddingComponentTo(null);
                                      setSelectedComponentId("");
                                      setComponentQuantity(1);
                                    }}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              )}

                              {/* Existing Order Components */}
                              {(order.order_components || []).length > 0 ? (
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>Component</TableHead>
                                      <TableHead>Type</TableHead>
                                      <TableHead className="text-center">Qty</TableHead>
                                      <TableHead className="text-right">Unit Cost</TableHead>
                                      <TableHead className="w-[80px]"></TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {order.order_components.map((oc) => (
                                      <TableRow key={oc.id}>
                                        <TableCell className="font-medium">
                                          {oc.components?.name || "Unknown"}
                                        </TableCell>
                                        <TableCell>
                                          <Badge variant="outline" className="capitalize">
                                            {oc.components?.type || "-"}
                                          </Badge>
                                        </TableCell>
                                        <TableCell>
                                          <div className="flex items-center justify-center gap-1">
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              className="h-6 w-6"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleUpdateQuantity(oc.id, oc.quantity - 1);
                                              }}
                                            >
                                              <Minus className="h-3 w-3" />
                                            </Button>
                                            <span className="w-8 text-center">{oc.quantity}</span>
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              className="h-6 w-6"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleUpdateQuantity(oc.id, oc.quantity + 1);
                                              }}
                                            >
                                              <Plus className="h-3 w-3" />
                                            </Button>
                                          </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                          ${(oc.components?.cost_per_unit || 0).toFixed(2)}
                                        </TableCell>
                                        <TableCell>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6 text-destructive hover:text-destructive"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleRemoveComponent(oc.id);
                                            }}
                                          >
                                            <Trash2 className="h-3 w-3" />
                                          </Button>
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              ) : null}

                              {/* Custom Costs Section */}
                              <Separator className="my-4" />
                              <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                  <h4 className="text-sm font-semibold">
                                    Custom Costs
                                  </h4>
                                  {addingCustomCostTo !== order.id && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setAddingCustomCostTo(order.id);
                                      }}
                                    >
                                      <Plus className="mr-1 h-3 w-3" />
                                      Add Custom Cost
                                    </Button>
                                  )}
                                </div>

                                {/* Add Custom Cost Form */}
                                {addingCustomCostTo === order.id && (
                                  <div className="flex items-end gap-2 rounded-lg border bg-background p-3">
                                    <div className="flex-1">
                                      <label className="text-xs text-muted-foreground">Description</label>
                                      <Input
                                        placeholder="e.g., Shipping, Gift wrap, Rush fee..."
                                        value={customCostDescription}
                                        onChange={(e) => setCustomCostDescription(e.target.value)}
                                        className="mt-1"
                                        onClick={(e) => e.stopPropagation()}
                                      />
                                    </div>
                                    <div className="w-28">
                                      <label className="text-xs text-muted-foreground">Amount ($)</label>
                                      <Input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        placeholder="0.00"
                                        value={customCostAmount}
                                        onChange={(e) => setCustomCostAmount(e.target.value)}
                                        className="mt-1"
                                        onClick={(e) => e.stopPropagation()}
                                      />
                                    </div>
                                    <Button
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleAddCustomCost(order.id);
                                      }}
                                      disabled={!customCostDescription.trim() || !customCostAmount}
                                    >
                                      Add
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setAddingCustomCostTo(null);
                                        setCustomCostDescription("");
                                        setCustomCostAmount("");
                                      }}
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                  </div>
                                )}

                                {/* Existing Custom Costs */}
                                {(order.order_custom_costs || []).length > 0 ? (
                                  <div className="space-y-2">
                                    {order.order_custom_costs.map((cc) => (
                                      <div key={cc.id} className="flex items-center justify-between rounded-lg border bg-background p-2">
                                        <span className="text-sm">{cc.description}</span>
                                        <div className="flex items-center gap-2">
                                          <span className="font-medium">${cc.amount.toFixed(2)}</span>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6 text-destructive hover:text-destructive"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleRemoveCustomCost(cc.id);
                                            }}
                                          >
                                            <Trash2 className="h-3 w-3" />
                                          </Button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-sm text-muted-foreground">
                                    No custom costs added. Use this for one-off charges like shipping, gift wrapping, or other fees.
                                  </p>
                                )}
                              </div>

                              {/* Total Additional Costs Summary */}
                              {((order.order_components || []).length > 0 || (order.order_custom_costs || []).length > 0) && (
                                <div className="mt-4 flex justify-end border-t pt-3">
                                  <div className="space-y-1 text-sm">
                                    {(order.order_components || []).length > 0 && (
                                      <div className="flex justify-between gap-8">
                                        <span className="text-muted-foreground">Component Costs:</span>
                                        <span>${getOrderComponentsCogs(order).toFixed(2)}</span>
                                      </div>
                                    )}
                                    {(order.order_custom_costs || []).length > 0 && (
                                      <div className="flex justify-between gap-8">
                                        <span className="text-muted-foreground">Custom Costs:</span>
                                        <span>${getOrderCustomCostsTotal(order).toFixed(2)}</span>
                                      </div>
                                    )}
                                    <div className="flex justify-between gap-8 border-t pt-1 font-semibold">
                                      <span>Total Additional Costs:</span>
                                      <span>${getTotalAdditionalCosts(order).toFixed(2)}</span>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Roast Request Section */}
                              {coffeeInventory.length > 0 && (
                                <>
                                  <Separator className="my-4" />
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <h4 className="text-sm font-semibold">Roasting</h4>
                                      <p className="text-xs text-muted-foreground">
                                        Create a roast request to fulfill this order
                                      </p>
                                    </div>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setRoastRequestOrder(order);
                                      }}
                                    >
                                      <Flame className="mr-1 h-3 w-3" />
                                      Create Roast Request
                                    </Button>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Roast Request Dialog */}
      <Dialog open={!!roastRequestOrder} onOpenChange={(open) => !open && setRoastRequestOrder(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Roast Request</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Create a roast request for order <strong>{roastRequestOrder?.order_name}</strong>
            </p>

            <div className="space-y-2">
              <Label>Coffee to Roast</Label>
              <Select
                value={roastRequestData.greenCoffeeId}
                onValueChange={(value) =>
                  setRoastRequestData({ ...roastRequestData, greenCoffeeId: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select coffee" />
                </SelectTrigger>
                <SelectContent>
                  {coffeeInventory.map((coffee) => (
                    <SelectItem key={coffee.id} value={coffee.id}>
                      <div className="flex items-center justify-between gap-4">
                        <span>{coffee.name}</span>
                        <span className="text-muted-foreground text-xs">
                          {coffee.current_green_quantity_g.toLocaleString()} g available
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Quantity Needed (grams)</Label>
              <Input
                type="number"
                step="1"
                min="0"
                value={roastRequestData.quantityG}
                onChange={(e) =>
                  setRoastRequestData({ ...roastRequestData, quantityG: e.target.value })
                }
                placeholder="e.g., 500"
              />
            </div>

            <div className="space-y-2">
              <Label>Priority</Label>
              <Select
                value={roastRequestData.priority}
                onValueChange={(value: "low" | "normal" | "high" | "urgent") =>
                  setRoastRequestData({ ...roastRequestData, priority: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Due Date (optional)</Label>
              <Input
                type="date"
                value={roastRequestData.dueDate}
                onChange={(e) =>
                  setRoastRequestData({ ...roastRequestData, dueDate: e.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoastRequestOrder(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateRoastRequest}
              disabled={
                isCreatingRoastRequest ||
                !roastRequestData.greenCoffeeId ||
                !roastRequestData.quantityG
              }
            >
              {isCreatingRoastRequest ? "Creating..." : "Create Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

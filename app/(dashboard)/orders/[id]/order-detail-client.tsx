"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  ArrowLeft,
  Package,
  CheckCircle2,
  Clock,
  DollarSign,
  Plus,
  Trash2,
  Coffee,
  AlertCircle,
  Truck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  updateOrderReadyToShip,
  assignRoastedCoffeeToOrder,
  removeRoastedCoffeeFromOrder,
} from "./actions";
import {
  addOrderCustomCost,
  removeOrderCustomCost,
  addOrderComponent,
  removeOrderComponent,
} from "../actions";

type OrderLineItem = {
  id: string;
  title: string;
  variant_title: string | null;
  sku: string | null;
  quantity: number;
  price: number;
  total_price: number;
  product_id: string | null;
  products: {
    id: string;
    title: string;
    product_components: Array<{
      id: string;
      quantity: number;
      components: {
        id: string;
        name: string;
        type: string;
        cost_per_unit: number;
      } | null;
    }>;
  } | null;
};

type OrderComponent = {
  id: string;
  component_id: string;
  quantity: number;
  components: {
    id: string;
    name: string;
    type: string;
    cost_per_unit: number;
  } | null;
};

type OrderCustomCost = {
  id: string;
  description: string;
  amount: number;
};

type OrderRoastedCoffee = {
  id: string;
  green_coffee_id: string;
  amount_g: number;
  assigned_at: string;
  green_coffee_inventory: {
    id: string;
    name: string;
  } | null;
};

type Order = {
  id: string;
  order_name: string;
  created_at_shopify: string;
  financial_status: string;
  fulfillment_status: string | null;
  subtotal_price: number;
  total_tax: number;
  total_price: number;
  currency: string;
  ready_to_ship: boolean;
  order_line_items: OrderLineItem[];
  order_components: OrderComponent[];
  order_custom_costs: OrderCustomCost[];
  order_roasted_coffee: OrderRoastedCoffee[];
};

type CoffeeStock = {
  id: string;
  name: string;
  origin: string | null;
  roasted_stock_g: number;
};

type Component = {
  id: string;
  name: string;
  type: string;
  cost_per_unit: number;
};

interface OrderDetailClientProps {
  order: Order;
  coffeeStock: CoffeeStock[];
  components: Component[];
}

export function OrderDetailClient({
  order: initialOrder,
  coffeeStock: initialCoffeeStock,
  components: initialComponents,
}: OrderDetailClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [order, setOrder] = useState(initialOrder);
  const [coffeeStock, setCoffeeStock] = useState(initialCoffeeStock);
  const [components, setComponents] = useState(initialComponents);
  const [customCosts, setCustomCosts] = useState<OrderCustomCost[]>(initialOrder.order_custom_costs);

  // Dialog states
  const [isAddCostOpen, setIsAddCostOpen] = useState(false);
  const [isAddCoffeeOpen, setIsAddCoffeeOpen] = useState(false);
  const [isAddComponentOpen, setIsAddComponentOpen] = useState(false);
  const [deleteAssignmentId, setDeleteAssignmentId] = useState<string | null>(null);
  const [deleteCostId, setDeleteCostId] = useState<string | null>(null);
  const [deleteComponentId, setDeleteComponentId] = useState<string | null>(null);

  // Form states
  const [newCostDescription, setNewCostDescription] = useState("");
  const [newCostAmount, setNewCostAmount] = useState("");
  const [selectedCoffeeId, setSelectedCoffeeId] = useState("");
  const [coffeeAmount, setCoffeeAmount] = useState("");
  const [selectedComponentId, setSelectedComponentId] = useState("");
  const [componentQuantity, setComponentQuantity] = useState("1");


  useEffect(() => {
    setOrder(initialOrder);
  }, [initialOrder]);

  useEffect(() => {
    setCoffeeStock(initialCoffeeStock);
  }, [initialCoffeeStock]);

  useEffect(() => {
    setComponents(initialComponents);
  }, [initialComponents]);

  useEffect(() => {
    setCustomCosts(initialOrder.order_custom_costs);
  }, [initialOrder.order_custom_costs]);

  // Track assigned roasted coffee
  const assignedCoffeeList = order.order_roasted_coffee.map(assignment => ({
    id: assignment.id,
    greenCoffeeId: assignment.green_coffee_id,
    coffeeName: assignment.green_coffee_inventory?.name || "Unknown Coffee",
    amountG: assignment.amount_g,
    assignedAt: assignment.assigned_at,
  }));

  const totalAssignedCoffeeG = assignedCoffeeList.reduce((sum, c) => sum + c.amountG, 0);

  // Calculate COGS
  const calculateCOGS = () => {
    let total = 0;

    // From product components
    for (const lineItem of order.order_line_items) {
      const product = lineItem.products;
      if (!product) continue;

      for (const pc of product.product_components || []) {
        const component = pc.components;
        if (!component) continue;
        total += pc.quantity * component.cost_per_unit * lineItem.quantity;
      }
    }

    // From manual order components
    for (const oc of order.order_components) {
      if (oc.components) {
        total += oc.quantity * oc.components.cost_per_unit;
      }
    }

    // From custom costs
    for (const cost of order.order_custom_costs) {
      total += cost.amount;
    }

    return total;
  };

  const cogs = calculateCOGS();
  const profit = order.total_price - cogs;
  const margin = order.total_price > 0 ? (profit / order.total_price) * 100 : 0;

  const handleToggleReadyToShip = () => {
    startTransition(async () => {
      const result = await updateOrderReadyToShip(order.id, !order.ready_to_ship);
      if (result.success) {
        setOrder({ ...order, ready_to_ship: !order.ready_to_ship });
      }
    });
  };

  const handleAddCustomCost = () => {
    const amount = parseFloat(newCostAmount);
    if (!newCostDescription.trim() || isNaN(amount)) return;

    startTransition(async () => {
      const result = await addOrderCustomCost(order.id, newCostDescription, amount);
      if (result.success) {
        router.refresh();
        setIsAddCostOpen(false);
        setNewCostDescription("");
        setNewCostAmount("");
      }
    });
  };

  const handleRemoveCustomCost = (costId: string) => {
    startTransition(async () => {
      const result = await removeOrderCustomCost(costId);
      if (result.success) {
        router.refresh();
        setDeleteCostId(null);
      }
    });
  };

  const handleAssignCoffee = () => {
    const amount = parseFloat(coffeeAmount);
    if (!selectedCoffeeId || isNaN(amount) || amount <= 0) return;

    startTransition(async () => {
      const result = await assignRoastedCoffeeToOrder(order.id, selectedCoffeeId, amount);
      if (result.success) {
        router.refresh();
        setIsAddCoffeeOpen(false);
        setSelectedCoffeeId("");
        setCoffeeAmount("");
      } else if (result.error) {
        alert(result.error);
      }
    });
  };

  const handleRemoveCoffeeAssignment = (assignmentId: string) => {
    startTransition(async () => {
      const result = await removeRoastedCoffeeFromOrder(assignmentId);
      if (result.success) {
        router.refresh();
        setDeleteAssignmentId(null);
      }
    });
  };

  const handleAddComponent = () => {
    const quantity = parseInt(componentQuantity);
    if (!selectedComponentId || isNaN(quantity) || quantity <= 0) return;

    startTransition(async () => {
      const result = await addOrderComponent(order.id, selectedComponentId, quantity);
      if (result.success) {
        router.refresh();
        setIsAddComponentOpen(false);
        setSelectedComponentId("");
        setComponentQuantity("1");
      }
    });
  };

  const handleRemoveComponent = (orderComponentId: string) => {
    startTransition(async () => {
      const result = await removeOrderComponent(orderComponentId);
      if (result.success) {
        router.refresh();
        setDeleteComponentId(null);
      }
    });
  };

  const getStatusColor = (status: string | null) => {
    if (!status) return "secondary";
    switch (status.toLowerCase()) {
      case "paid":
        return "default";
      case "fulfilled":
        return "default";
      case "unfulfilled":
        return "secondary";
      case "partially_fulfilled":
        return "secondary";
      default:
        return "secondary";
    }
  };

  const LBS_TO_GRAMS = 453.592;
  const gramsToLbs = (g: number) => (g / LBS_TO_GRAMS).toFixed(2);

  return (
    <div className="space-y-4 sm:space-y-6 sm:p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 sm:gap-4">
          <Button variant="ghost" size="icon" asChild className="shrink-0">
            <Link href="/orders">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold">{order.order_name}</h1>
              {order.ready_to_ship && (
                <Badge className="bg-green-500/10 text-green-600 border-green-500/20">
                  <Truck className="mr-1 h-3 w-3" />
                  Ready to Ship
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {format(new Date(order.created_at_shopify), "MMM d, yyyy 'at' h:mm a")}
            </p>
          </div>
        </div>

        <Button
          onClick={handleToggleReadyToShip}
          disabled={isPending}
          variant={order.ready_to_ship ? "outline" : "default"}
          className={`w-full sm:w-auto ${order.ready_to_ship ? "bg-transparent" : ""}`}
        >
          {order.ready_to_ship ? (
            <>
              <Clock className="mr-2 h-4 w-4" />
              Mark Not Ready
            </>
          ) : (
            <>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Mark Ready to Ship
            </>
          )}
        </Button>
      </div>

      {/* Status and Summary */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Payment Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant={getStatusColor(order.financial_status)}>
              {order.financial_status}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Fulfillment
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant={getStatusColor(order.fulfillment_status)}>
              {order.fulfillment_status || "Unfulfilled"}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Order Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${order.total_price.toFixed(2)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Profit Margin
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${margin >= 0 ? "text-green-600" : "text-destructive"}`}>
              {margin.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              ${profit.toFixed(2)} profit
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Assigned Roasted Coffee */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <CardTitle className="text-lg">Assigned Roasted Coffee</CardTitle>
              </div>
              <CardDescription>
                Coffee from your roasted stock assigned to this order
              </CardDescription>
            </div>

            <Dialog open={isAddCoffeeOpen} onOpenChange={setIsAddCoffeeOpen}>
              <DialogTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  className="bg-transparent w-full sm:w-auto"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Assign Coffee
                </Button>
              </DialogTrigger>

              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Assign Roasted Coffee</DialogTitle>
                  <DialogDescription>
                    Assign roasted coffee from your stock to this order. This will deduct the amount from your inventory.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Coffee</Label>
                    <Select value={selectedCoffeeId} onValueChange={setSelectedCoffeeId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select coffee..." />
                      </SelectTrigger>
                      <SelectContent>
                        {coffeeStock.map((coffee) => (
                          <SelectItem key={coffee.id} value={coffee.id}>
                            {coffee.name} ({coffee.roasted_stock_g} g available)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Amount (grams)</Label>
                    <Input
                      type="number"
                      value={coffeeAmount}
                      onChange={(e) => setCoffeeAmount(e.target.value)}
                      placeholder="Enter amount in grams"
                    />
                  </div>
                </div>

                <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
                  <Button
                    variant="outline"
                    onClick={() => setIsAddCoffeeOpen(false)}
                    className="bg-transparent w-full sm:w-auto"
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleAssignCoffee} disabled={isPending} className="w-full sm:w-auto">
                    Assign Coffee
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {assignedCoffeeList.length === 0 ? (
            <div className="py-6 text-center text-muted-foreground">
              <Coffee className="mx-auto mb-2 h-8 w-8 opacity-50" />
              <p className="text-sm">No roasted coffee assigned to this order yet.</p>
              {coffeeStock.length > 0 && (
                <p className="mt-1 text-xs">Click &quot;Assign Coffee&quot; to add from your stock.</p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {assignedCoffeeList.map((assignment) => (
                <div
                  key={assignment.id}
                  className="flex items-center justify-between rounded-md border p-3"
                >
                  <div>
                    <span className="font-medium">{assignment.coffeeName}</span>
                    <div className="text-sm text-muted-foreground">
                      {assignment.amountG.toLocaleString()}g ({gramsToLbs(assignment.amountG)} lbs)
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => setDeleteAssignmentId(assignment.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <div className="mt-3 flex justify-between rounded-md bg-muted/50 p-3">
                <span className="font-medium">Total Assigned</span>
                <span className="font-semibold text-amber-600">
                  {totalAssignedCoffeeG.toLocaleString()}g ({gramsToLbs(totalAssignedCoffeeG)} lbs)
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Line Items */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Order Items
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead className="text-center">Qty</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {order.order_line_items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{item.title}</div>
                      {item.variant_title && (
                        <div className="text-sm text-muted-foreground">
                          {item.variant_title}
                        </div>
                      )}
                      {item.sku && (
                        <div className="text-xs text-muted-foreground">
                          SKU: {item.sku}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">{item.quantity}</TableCell>
                  <TableCell className="text-right">
                    ${item.price.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right">
                    ${item.total_price.toFixed(2)}
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
              </TableRow>
              {/* Shipping Row */}
              <TableRow>
                <TableCell colSpan={3} className="text-right text-muted-foreground">
                  Shipping
                </TableCell>
                <TableCell className="text-right">
                  ${((order.total_price || 0) - (order.subtotal_price || 0) - (order.total_tax || 0)).toFixed(2)}
                </TableCell>
              </TableRow>
              {/* Tax Row */}
              <TableRow>
                <TableCell colSpan={3} className="text-right text-muted-foreground">
                  Tax
                </TableCell>
                <TableCell className="text-right">
                  ${(order.total_tax || 0).toFixed(2)}
                </TableCell>
              </TableRow>
              {/* Total Row */}
              <TableRow className="border-t bg-muted/30">
                <TableCell colSpan={3} className="text-right font-semibold">
                  Total
                </TableCell>
                <TableCell className="text-right font-semibold">
                  ${(order.total_price || 0).toFixed(2)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      {/* Custom Costs */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-1">
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Custom Costs
              </CardTitle>
              <CardDescription>
                Additional costs for this order (shipping, packaging, etc.)
              </CardDescription>
            </div>

            <Dialog open={isAddCostOpen} onOpenChange={setIsAddCostOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="w-full sm:w-auto">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Cost
                </Button>
              </DialogTrigger>

              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Custom Cost</DialogTitle>
                  <DialogDescription>
                    Add a custom cost to this order
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Input
                      value={newCostDescription}
                      onChange={(e) => setNewCostDescription(e.target.value)}
                      placeholder="e.g., Shipping, Packaging"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Amount ($)</Label>
                    <Input
                      type="number"
                      value={newCostAmount}
                      onChange={(e) => setNewCostAmount(e.target.value)}
                      placeholder="0.00"
                      step="0.01"
                      min="0"
                    />
                  </div>
                </div>

                <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
                  <Button
                    variant="outline"
                    onClick={() => setIsAddCostOpen(false)}
                    className="bg-transparent w-full sm:w-auto"
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleAddCustomCost} disabled={isPending} className="w-full sm:w-auto">
                    Add Cost
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>

        <CardContent>
          {order.order_custom_costs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No custom costs added yet
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {order.order_custom_costs.map((cost) => (
                  <TableRow key={cost.id}>
                    <TableCell>{cost.description}</TableCell>
                    <TableCell className="text-right">
                      ${cost.amount.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => setDeleteCostId(cost.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Manual Components */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-1">
              <CardTitle>Additional Components</CardTitle>
              <CardDescription>
                Manually added components for cost tracking
              </CardDescription>
            </div>

            <Dialog open={isAddComponentOpen} onOpenChange={setIsAddComponentOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="w-full sm:w-auto">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Component
                </Button>
              </DialogTrigger>

              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Component</DialogTitle>
                  <DialogDescription>
                    Add a component to track in this order&apos;s costs
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Component</Label>
                    <Select value={selectedComponentId} onValueChange={setSelectedComponentId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select component" />
                      </SelectTrigger>
                      <SelectContent>
                        {components.map((comp) => (
                          <SelectItem key={comp.id} value={comp.id}>
                            {comp.name} (${comp.cost_per_unit.toFixed(2)}/unit)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Quantity</Label>
                    <Input
                      type="number"
                      value={componentQuantity}
                      onChange={(e) => setComponentQuantity(e.target.value)}
                      min="1"
                    />
                  </div>
                </div>

                <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
                  <Button
                    variant="outline"
                    onClick={() => setIsAddComponentOpen(false)}
                    className="bg-transparent w-full sm:w-auto"
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleAddComponent} disabled={isPending} className="w-full sm:w-auto">
                    Add Component
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {order.order_components.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No additional components added
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Component</TableHead>
                  <TableHead className="text-center">Qty</TableHead>
                  <TableHead className="text-right">Unit Cost</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {order.order_components.map((oc) => (
                  <TableRow key={oc.id}>
                    <TableCell>{oc.components?.name || "Unknown"}</TableCell>
                    <TableCell className="text-center">{oc.quantity}</TableCell>
                    <TableCell className="text-right">
                      ${oc.components?.cost_per_unit.toFixed(2) || "0.00"}
                    </TableCell>
                    <TableCell className="text-right">
                      ${((oc.components?.cost_per_unit || 0) * oc.quantity).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => setDeleteComponentId(oc.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Cost Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Cost Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>${order.subtotal_price.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Tax</span>
              <span>${order.total_tax.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-medium">
              <span>Total Revenue</span>
              <span>${order.total_price.toFixed(2)}</span>
            </div>
            <hr className="my-2" />
            <div className="flex justify-between text-muted-foreground">
              <span>Total COGS</span>
              <span>-${cogs.toFixed(2)}</span>
            </div>
            <hr className="my-2" />
            <div className={`flex justify-between font-bold text-lg ${profit >= 0 ? "text-green-600" : "text-destructive"}`}>
              <span>Net Profit</span>
              <span>${profit.toFixed(2)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialogs */}
      <AlertDialog open={!!deleteAssignmentId} onOpenChange={() => setDeleteAssignmentId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Coffee Assignment?</AlertDialogTitle>
            <AlertDialogDescription>
              This will return the coffee to your roasted stock.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteAssignmentId && handleRemoveCoffeeAssignment(deleteAssignmentId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteCostId} onOpenChange={() => setDeleteCostId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Custom Cost?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteCostId && handleRemoveCustomCost(deleteCostId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteComponentId} onOpenChange={() => setDeleteComponentId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Component?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteComponentId && handleRemoveComponent(deleteComponentId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

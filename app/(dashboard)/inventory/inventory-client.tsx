"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  TrendingDown,
  Edit,
  Trash2,
  Search,
  Scale,
} from "lucide-react";
import {
  createCoffeeInventory,
  updateCoffeeInventory,
  adjustInventoryQuantity,
  deleteCoffeeInventory,
} from "./actions";

interface CoffeeInventory {
  id: string;
  name: string;
  origin: string;
  lot_code: string | null;
  supplier: string | null;
  price_per_lb: number;
  initial_quantity_g: number;
  current_green_quantity_g: number;
  current_roasted_quantity_g: number;
  purchase_date: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
}

// Conversion: 1 lb = 453.592 grams
const LBS_TO_GRAMS = 453.592;

interface InventoryClientProps {
  initialInventory: CoffeeInventory[];
}

export function InventoryClient({ initialInventory }: InventoryClientProps) {
  const [inventory, setInventory] = useState(initialInventory);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isAdjustDialogOpen, setIsAdjustDialogOpen] = useState(false);
  const [editingCoffee, setEditingCoffee] = useState<CoffeeInventory | null>(null);
  const [adjustingCoffee, setAdjustingCoffee] = useState<CoffeeInventory | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    origin: "",
    lot_code: "",
    supplier: "",
    price_per_lb: "",
    quantity_lbs: "",
    purchase_date: "",
    notes: "",
  });

  // Adjustment form state
  const [adjustmentData, setAdjustmentData] = useState({
    change_type: "manual_green_adjust" as "manual_green_adjust" | "roast_deduct" | "sale_deduct",
    quantity: "",
    notes: "",
  });

  const filteredInventory = inventory.filter(
    (coffee) =>
      coffee.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      coffee.origin.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (coffee.supplier?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
  );

  // Helper to convert grams to lbs
  const gramsToLbs = (g: number) => g / LBS_TO_GRAMS;

  // Calculate totals (convert grams to lbs for display)
  const totalGreenLbs = inventory.reduce((sum, c) => sum + gramsToLbs(c.current_green_quantity_g), 0);
  const totalRoastedLbs = inventory.reduce((sum, c) => sum + gramsToLbs(c.current_roasted_quantity_g || 0), 0);
  const totalValue = inventory.reduce((sum, c) => sum + gramsToLbs(c.current_green_quantity_g) * c.price_per_lb, 0);

  const resetForm = () => {
    setFormData({
      name: "",
      origin: "",
      lot_code: "",
      supplier: "",
      price_per_lb: "",
      quantity_lbs: "",
      purchase_date: "",
      notes: "",
    });
    setEditingCoffee(null);
  };

  const handleAddOrEdit = async () => {
    setIsSubmitting(true);
    try {
      if (editingCoffee) {
        const result = await updateCoffeeInventory(editingCoffee.id, {
          name: formData.name,
          origin: formData.origin,
          lot_code: formData.lot_code || undefined,
          supplier: formData.supplier || undefined,
          price_per_lb: parseFloat(formData.price_per_lb),
          notes: formData.notes || undefined,
        });
        if (result.error) {
          alert(result.error);
        } else {
          setIsAddDialogOpen(false);
          resetForm();
          window.location.reload();
        }
      } else {
        const result = await createCoffeeInventory({
          name: formData.name,
          origin: formData.origin,
          lot_code: formData.lot_code || undefined,
          supplier: formData.supplier || undefined,
          price_per_lb: parseFloat(formData.price_per_lb),
          quantity_lbs: parseFloat(formData.quantity_lbs),
          purchase_date: formData.purchase_date || undefined,
          notes: formData.notes || undefined,
        });
        if (result.error) {
          alert(result.error);
        } else {
          setIsAddDialogOpen(false);
          resetForm();
          window.location.reload();
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAdjustQuantity = async () => {
    if (!adjustingCoffee) return;
    setIsSubmitting(true);
    try {
      const quantity = parseFloat(adjustmentData.quantity);
      // For manual_green_adjust, use the signed value from the user
      // For deductions (roast, sale), always negative
      const actualChange = adjustmentData.change_type === "manual_green_adjust" 
        ? quantity  // User enters positive to add, negative to subtract
        : -Math.abs(quantity);  // Always deduct for roast/sale
      
      const result = await adjustInventoryQuantity(
        adjustingCoffee.id,
        adjustmentData.change_type,
        actualChange,
        adjustmentData.notes || undefined
      );
      
      if (result.error) {
        alert(result.error);
      } else {
        setIsAdjustDialogOpen(false);
        setAdjustingCoffee(null);
        setAdjustmentData({ change_type: "manual_green_adjust", quantity: "", notes: "" });
        window.location.reload();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this coffee? This cannot be undone.")) {
      return;
    }
    const result = await deleteCoffeeInventory(id);
    if (result.error) {
      alert(result.error);
    } else {
      window.location.reload();
    }
  };

  const openEditDialog = (coffee: CoffeeInventory) => {
    setEditingCoffee(coffee);
    setFormData({
      name: coffee.name,
      origin: coffee.origin,
      lot_code: coffee.lot_code || "",
      supplier: coffee.supplier || "",
      price_per_lb: coffee.price_per_lb.toString(),
      quantity_lbs: (coffee.initial_quantity_g / LBS_TO_GRAMS).toFixed(2),
      purchase_date: coffee.purchase_date || "",
      notes: coffee.notes || "",
    });
    setIsAddDialogOpen(true);
  };

  const openAdjustDialog = (coffee: CoffeeInventory) => {
    setAdjustingCoffee(coffee);
    setAdjustmentData({ change_type: "manual_green_adjust", quantity: "", notes: "" });
    setIsAdjustDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Coffee Inventory</h1>
          <p className="text-muted-foreground">
            Manage your green and roasted coffee stock
          </p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
          setIsAddDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Coffee
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingCoffee ? "Edit Coffee" : "Add New Coffee"}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Ethiopia Yirgacheffe"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="origin">Origin *</Label>
                  <Input
                    id="origin"
                    value={formData.origin}
                    onChange={(e) => setFormData({ ...formData, origin: e.target.value })}
                    placeholder="e.g., Ethiopia"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="lot_code">Lot Code</Label>
                  <Input
                    id="lot_code"
                    value={formData.lot_code}
                    onChange={(e) => setFormData({ ...formData, lot_code: e.target.value })}
                    placeholder="e.g., 12345"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="supplier">Supplier</Label>
                  <Input
                    id="supplier"
                    value={formData.supplier}
                    onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                    placeholder="e.g., Supplier Name"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="price_per_lb">Price per lb ($) *</Label>
                  <Input
                    id="price_per_lb"
                    type="number"
                    step="0.01"
                    value={formData.price_per_lb}
                    onChange={(e) => setFormData({ ...formData, price_per_lb: e.target.value })}
                    placeholder="e.g., 6.50"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="quantity_lbs">Initial Quantity (lbs) *</Label>
                  <Input
                    id="quantity_lbs"
                    type="number"
                    step="0.01"
                    value={formData.quantity_lbs}
                    onChange={(e) => setFormData({ ...formData, quantity_lbs: e.target.value })}
                    placeholder="e.g., 50"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="purchase_date">Purchase Date</Label>
                  <Input
                    id="purchase_date"
                    type="date"
                    value={formData.purchase_date}
                    onChange={(e) => setFormData({ ...formData, purchase_date: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Tasting notes, supplier info, etc."
                  rows={3}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => {
                setIsAddDialogOpen(false);
                resetForm();
              }}>
                Cancel
              </Button>
              <Button
                onClick={handleAddOrEdit}
                disabled={isSubmitting || !formData.name || !formData.origin || !formData.price_per_lb || !formData.quantity_lbs}
              >
                {isSubmitting ? "Saving..." : editingCoffee ? "Save Changes" : "Add Coffee"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by name, origin, or supplier..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Inventory Table */}
      <Card>
        <CardContent className="p-0">
          {/* Desktop Table */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Coffee</TableHead>
                  <TableHead>Origin</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead className="text-right">Price/lb</TableHead>
                  <TableHead className="text-right">Green Qty</TableHead>
                  <TableHead className="text-right">Roasted Qty</TableHead>
                  <TableHead className="text-right">Total Value</TableHead>
                  <TableHead className="w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInventory.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center">
                      {searchQuery ? "No coffees found matching your search." : "No coffees in inventory. Add your first coffee to get started!"}
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {filteredInventory.map((coffee) => {
                      const greenLbs = gramsToLbs(coffee.current_green_quantity_g);
                      const roastedLbs = gramsToLbs(coffee.current_roasted_quantity_g || 0);
                      const totalCoffeeValue = greenLbs * coffee.price_per_lb;
                      return (
                        <TableRow key={coffee.id}>
                          <TableCell>
                            <div className="font-medium">{coffee.name}</div>
                          </TableCell>
                          <TableCell>{coffee.origin}</TableCell>
                          <TableCell className="text-muted-foreground">{coffee.supplier || "-"}</TableCell>
                          <TableCell className="text-right">${coffee.price_per_lb.toFixed(2)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              {greenLbs < 5 && greenLbs > 0 && (
                                <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30 text-xs">
                                  Low
                                </Badge>
                              )}
                              <span>{greenLbs.toFixed(1)} lbs</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">{roastedLbs.toFixed(1)} lbs</TableCell>
                          <TableCell className="text-right font-medium">${totalCoffeeValue.toFixed(2)}</TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => openAdjustDialog(coffee)}
                                title="Adjust quantity"
                              >
                                <Scale className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => openEditDialog(coffee)}
                                title="Edit"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={() => handleDelete(coffee.id)}
                                title="Delete"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {/* Totals Row */}
                    <TableRow className="bg-muted/50 font-medium">
                      <TableCell colSpan={4} className="text-right">Totals</TableCell>
                      <TableCell className="text-right">{totalGreenLbs.toFixed(1)} lbs</TableCell>
                      <TableCell className="text-right">{totalRoastedLbs.toFixed(1)} lbs</TableCell>
                      <TableCell className="text-right">${totalValue.toFixed(2)}</TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  </>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Card Layout */}
          <div className="md:hidden divide-y">
            {filteredInventory.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground">
                {searchQuery ? "No coffees found matching your search." : "No coffees in inventory. Add your first coffee to get started!"}
              </div>
            ) : (
              <>
                {filteredInventory.map((coffee) => {
                  const greenLbs = gramsToLbs(coffee.current_green_quantity_g);
                  const roastedLbs = gramsToLbs(coffee.current_roasted_quantity_g || 0);
                  const totalCoffeeValue = greenLbs * coffee.price_per_lb;
                  return (
                    <div key={coffee.id} className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-medium">{coffee.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {coffee.origin} {coffee.supplier ? `• ${coffee.supplier}` : ""}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openAdjustDialog(coffee)}
                          >
                            <Scale className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEditDialog(coffee)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => handleDelete(coffee.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-3 text-sm">
                        <div>
                          <div className="text-muted-foreground">Price/lb</div>
                          <div className="font-medium">${coffee.price_per_lb.toFixed(2)}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Total Value</div>
                          <div className="font-medium">${totalCoffeeValue.toFixed(2)}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Green Qty</div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{greenLbs.toFixed(1)} lbs</span>
                            {greenLbs < 5 && greenLbs > 0 && (
                              <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30 text-xs">
                                Low
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Roasted Qty</div>
                          <div className="font-medium">{roastedLbs.toFixed(1)} lbs</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {/* Mobile Totals */}
                <div className="p-4 bg-muted/50">
                  <div className="text-sm font-medium text-muted-foreground mb-2">Totals</div>
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div>
                      <div className="text-muted-foreground">Green</div>
                      <div className="font-medium">{totalGreenLbs.toFixed(1)} lbs</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Roasted</div>
                      <div className="font-medium">{totalRoastedLbs.toFixed(1)} lbs</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Value</div>
                      <div className="font-medium">${totalValue.toFixed(2)}</div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Adjust Quantity Dialog */}
      <Dialog open={isAdjustDialogOpen} onOpenChange={setIsAdjustDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust Inventory: {adjustingCoffee?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Adjustment Type</Label>
              <Select
                value={adjustmentData.change_type}
                onValueChange={(value) => setAdjustmentData({ ...adjustmentData, change_type: value as typeof adjustmentData.change_type })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual_green_adjust">
                    <div className="flex items-center gap-2">
                      <Scale className="h-4 w-4 text-blue-600" />
                      Manual Adjustment (+/-)
                    </div>
                  </SelectItem>
                  <SelectItem value="roast_deduct">
                    <div className="flex items-center gap-2">
                      <TrendingDown className="h-4 w-4 text-amber-600" />
                      Roast (Deduct Stock)
                    </div>
                  </SelectItem>
                  <SelectItem value="sale_deduct">
                    <div className="flex items-center gap-2">
                      <TrendingDown className="h-4 w-4 text-red-600" />
                      Sale (Deduct Stock)
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="adjust_quantity">Quantity (lbs)</Label>
              <Input
                id="adjust_quantity"
                type="number"
                step="0.01"
                value={adjustmentData.quantity}
                onChange={(e) => setAdjustmentData({ ...adjustmentData, quantity: e.target.value })}
                placeholder="Enter amount"
              />
              <p className="text-xs text-muted-foreground">
                Current stock: {gramsToLbs(adjustingCoffee?.current_green_quantity_g || 0).toFixed(1)} lbs
                {adjustmentData.quantity && (
                  <>
                    {" → "}
                    {adjustmentData.change_type === "manual_green_adjust"
                      ? ((gramsToLbs(adjustingCoffee?.current_green_quantity_g || 0) || 0) + (parseFloat(adjustmentData.quantity) || 0)).toFixed(1)
                      : ((gramsToLbs(adjustingCoffee?.current_green_quantity_g || 0) || 0) - Math.abs(parseFloat(adjustmentData.quantity) || 0)).toFixed(1)
                    } lbs after adjustment
                  </>
                )}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="adjust_notes">Notes (optional)</Label>
              <Textarea
                id="adjust_notes"
                value={adjustmentData.notes}
                onChange={(e) => setAdjustmentData({ ...adjustmentData, notes: e.target.value })}
                placeholder="Reason for adjustment..."
                rows={2}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsAdjustDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAdjustQuantity}
              disabled={isSubmitting || !adjustmentData.quantity}
            >
              {isSubmitting ? "Saving..." : "Apply Adjustment"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

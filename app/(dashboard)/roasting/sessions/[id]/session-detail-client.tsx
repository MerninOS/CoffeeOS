"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  ArrowLeft,
  Plus,
  Trash2,
  Edit,
  Package,
  ClipboardList,
  AlertTriangle,
  Clock,
} from "lucide-react";
import {
  createBatch,
  updateBatch,
  deleteBatch,
  fulfillRoastRequest,
} from "../../actions";

interface Batch {
  id: string;
  coffee_name: string;
  lot_code: string | null;
  price_basis: "per_lb" | "per_kg";
  price_value: number;
  green_weight_g: number;
  roasted_weight_g: number;
  rejects_g: number;
  roast_minutes: number;
  batch_date: string;
  energy_kwh: number | null;
  kwh_rate: number | null;
  sellable_g: number;
  loss_percent: number;
  green_cost_per_g: number;
  component_id: string | null;
  created_at: string;
}

interface Session {
  id: string;
  session_date: string;
  vendor_name: string;
  rate_per_hour: number;
  cost_mode: "toll_roasting" | "power_usage" | "co_roasting";
  rate_per_lb: number | null;
  machine_energy_kwh_per_hour: number | null;
  kwh_rate: number | null;
  setup_minutes: number;
  cleanup_minutes: number;
  billing_granularity_minutes: number;
  allocation_mode: string;
  notes: string | null;
}

interface CoffeeInventory {
  id: string;
  name: string;
  origin: string;
  lot_code: string | null;
  supplier: string | null;
  price_per_lb: number;
  current_green_quantity_g: number;
}

// Conversion: 1 lb = 453.592 grams
const LBS_TO_GRAMS = 453.592;

interface RoastRequest {
  id: string;
  green_coffee_id: string;
  coffee_name: string;
  requested_roasted_g: number;
  fulfilled_roasted_g: number;
  priority: "low" | "normal" | "high" | "urgent";
  status: "pending" | "in_progress";
  due_date: string | null;
  order_id: string | null;
  notes: string | null;
  green_coffee_inventory?: {
    name: string;
    origin: string;
  };
}

interface SessionDetailClientProps {
  session: Session;
  batches: Batch[];
  coffeeInventory: CoffeeInventory[];
  pendingRequests: RoastRequest[];
}

const defaultBatchData = {
  coffeeInventoryId: "",
  coffeeName: "",
  lotCode: "",
  priceBasis: "per_lb" as "per_lb" | "per_kg",
  priceValue: "",
  greenWeightG: "",
  roastedWeightG: "",
  rejectsG: "0",
  roastMinutes: "",
  energyKwh: "",
};

export function SessionDetailClient({
  session,
  batches: initialBatches,
  coffeeInventory,
  pendingRequests,
}: SessionDetailClientProps) {
  const router = useRouter();
  const [batches, setBatches] = useState(initialBatches);
  const [isAddBatchOpen, setIsAddBatchOpen] = useState(false);
  const [editingBatch, setEditingBatch] = useState<Batch | null>(null);
  const [deleteBatchId, setDeleteBatchId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [batchData, setBatchData] = useState(defaultBatchData);
  const [selectedRequestId, setSelectedRequestId] = useState<string>("");

  const handleAddBatch = async () => {
    const roastMinutesRequired = session.cost_mode !== "co_roasting";
    if (!batchData.coffeeName || !batchData.greenWeightG || !batchData.roastedWeightG || (roastMinutesRequired && !batchData.roastMinutes) || !batchData.priceValue) {
      alert(`Please fill in all required fields: Coffee Name, Price, Green Weight, Roasted Weight${roastMinutesRequired ? ", and Roast Duration" : ""}`);
      return;
    }

    setIsSubmitting(true);
    const result = await createBatch({
      sessionId: session.id,
      coffeeInventoryId: batchData.coffeeInventoryId || undefined,
      coffeeName: batchData.coffeeName,
      lotCode: batchData.lotCode || undefined,
      priceBasis: batchData.priceBasis,
      priceValue: parseFloat(batchData.priceValue),
      greenWeightG: parseFloat(batchData.greenWeightG),
      roastedWeightG: parseFloat(batchData.roastedWeightG),
      rejectsG: parseFloat(batchData.rejectsG) || 0,
      roastMinutes: parseFloat(batchData.roastMinutes),
      batchDate: session.session_date,
      energyKwh: batchData.energyKwh ? parseFloat(batchData.energyKwh) : undefined,
    });

    if (result.error) {
      setIsSubmitting(false);
      alert(result.error);
      return;
    }

    // If a roast request was selected, fulfill it with this batch
    if (result.batch && selectedRequestId) {
      const roastedWeightG = parseFloat(batchData.roastedWeightG);
      const fulfillResult = await fulfillRoastRequest({
        requestId: selectedRequestId,
        batchId: result.batch.id,
        quantityG: roastedWeightG,
      });
      if (fulfillResult.error) {
        console.warn("Failed to fulfill roast request:", fulfillResult.error);
      }
    }

    setIsSubmitting(false);

    if (result.batch) {
      setBatches([...batches, result.batch]);
      setIsAddBatchOpen(false);
      setBatchData(defaultBatchData);
      setSelectedRequestId("");
      router.refresh(); // Refresh to update pending requests
    }
  };

  const handleUpdateBatch = async () => {
    if (!editingBatch) return;
    setIsSubmitting(true);

    const result = await updateBatch(editingBatch.id, {
      coffeeName: batchData.coffeeName || undefined,
      lotCode: batchData.lotCode || undefined,
      priceBasis: batchData.priceBasis,
      priceValue: parseFloat(batchData.priceValue) || undefined,
      greenWeightG: parseFloat(batchData.greenWeightG) || undefined,
      roastedWeightG: parseFloat(batchData.roastedWeightG) || undefined,
      rejectsG: parseFloat(batchData.rejectsG) || 0,
      roastMinutes: parseFloat(batchData.roastMinutes) || undefined,
      energyKwh: batchData.energyKwh ? parseFloat(batchData.energyKwh) : undefined,
    });
    setIsSubmitting(false);

    if (result.error) {
      alert(result.error);
      return;
    }

    // Refresh to get recalculated values
    router.refresh();
    setEditingBatch(null);
    setBatchData(defaultBatchData);
  };

  const handleDeleteBatch = async () => {
    if (!deleteBatchId) return;

    const result = await deleteBatch(deleteBatchId);
    if (result.error) {
      alert(result.error);
    } else {
      setBatches(batches.filter((b) => b.id !== deleteBatchId));
    }
    setDeleteBatchId(null);
  };

  const openEditBatch = (batch: Batch) => {
    setEditingBatch(batch);
    setBatchData({
      coffeeInventoryId: "",
      coffeeName: batch.coffee_name,
      lotCode: batch.lot_code || "",
      priceBasis: batch.price_basis,
      priceValue: batch.price_value.toString(),
      greenWeightG: batch.green_weight_g.toString(),
      roastedWeightG: batch.roasted_weight_g.toString(),
      rejectsG: batch.rejects_g.toString(),
      roastMinutes: batch.roast_minutes.toString(),
      energyKwh: batch.energy_kwh?.toString() || "",
    });
  };

  const totalGreenG = batches.reduce((sum, b) => sum + b.green_weight_g, 0);
  const totalRoastedG = batches.reduce((sum, b) => sum + b.roasted_weight_g, 0);
  const totalSellableG = batches.reduce((sum, b) => sum + b.sellable_g, 0);
  const avgLossPercent = batches.length > 0
    ? batches.reduce((sum, b) => sum + b.loss_percent, 0) / batches.length
    : null;

  // Calculate total roast time and toll cost
  const totalRoastMinutes = batches.reduce((sum, b) => sum + b.roast_minutes, 0);
  const totalSessionMinutes = session.setup_minutes + totalRoastMinutes + session.cleanup_minutes;
  const billableMinutes = Math.ceil(totalSessionMinutes / session.billing_granularity_minutes) * session.billing_granularity_minutes;
  const sessionTollCost =
    session.cost_mode === "co_roasting"
      ? batches.reduce((sum, b) => sum + (b.green_weight_g / 453.592) * Number(session.rate_per_lb || 0), 0)
      : session.cost_mode === "power_usage"
      ? (billableMinutes / 60) *
        (session.machine_energy_kwh_per_hour || 0) *
        (session.kwh_rate || 0)
      : (billableMinutes / 60) * session.rate_per_hour;

  // Handle coffee inventory selection
  const handleCoffeeSelect = (coffeeId: string) => {
    const coffee = coffeeInventory.find((c) => c.id === coffeeId);
    if (coffee) {
      setBatchData({
        ...batchData,
        coffeeInventoryId: coffeeId,
        coffeeName: coffee.name,
        lotCode: coffee.lot_code || "",
        priceBasis: "per_lb",
        priceValue: coffee.price_per_lb.toString(),
      });
    }
  };

  const selectedCoffee = coffeeInventory.find((c) => c.id === batchData.coffeeInventoryId);
  
  // Helper to convert grams to lbs
  const gramsToLbs = (g: number) => g / LBS_TO_GRAMS;

  // Helper function for selecting a roast request
  const handleRequestSelect = (requestId: string) => {
    setSelectedRequestId(requestId);
    const request = pendingRequests.find((r) => r.id === requestId);
    if (request) {
      // Find the matching coffee in inventory
      const coffee = coffeeInventory.find((c) => c.id === request.green_coffee_id);
      if (coffee) {
        handleCoffeeSelect(coffee.id);
      }
    }
  };

  const selectedRequest = pendingRequests.find((r) => r.id === selectedRequestId);

  const batchFormFields = (
    <div className="grid gap-4 py-4">
      {/* Roast Request Selection */}
      {pendingRequests.length > 0 && !editingBatch && (
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4" />
            Fulfill a Roast Request (optional)
          </Label>
          <Select
            value={selectedRequestId}
            onValueChange={handleRequestSelect}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a request to fulfill..." />
            </SelectTrigger>
            <SelectContent>
              {pendingRequests.map((request) => {
                const remainingG = request.requested_roasted_g - request.fulfilled_roasted_g;
                const isOverdue = request.due_date && new Date(request.due_date) < new Date();
                return (
                  <SelectItem key={request.id} value={request.id}>
                    <div className="flex items-center gap-2">
                      {request.priority === "urgent" && <AlertTriangle className="h-3 w-3 text-red-500" />}
                      {request.priority === "high" && <Clock className="h-3 w-3 text-amber-500" />}
                      <span>{request.green_coffee_inventory?.name || "Unknown"}</span>
                      <span className="text-muted-foreground text-xs">
                        - {remainingG.toLocaleString()} g needed
                        {isOverdue && " (overdue)"}
                      </span>
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          {selectedRequest && (
            <p className="text-xs text-muted-foreground">
              Request needs {(selectedRequest.requested_roasted_g - selectedRequest.fulfilled_roasted_g).toLocaleString()} g
              {selectedRequest.due_date && ` by ${new Date(selectedRequest.due_date).toLocaleDateString()}`}
              {selectedRequest.notes && ` - ${selectedRequest.notes}`}
            </p>
          )}
        </div>
      )}

      {/* Coffee Inventory Selection */}
      {coffeeInventory.length > 0 && (
        <div className="space-y-2">
          <Label>Select from Inventory</Label>
          <Select
            value={batchData.coffeeInventoryId}
            onValueChange={handleCoffeeSelect}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select coffee from inventory..." />
            </SelectTrigger>
            <SelectContent>
              {coffeeInventory.map((coffee) => (
                <SelectItem key={coffee.id} value={coffee.id}>
                  <div className="flex items-center justify-between gap-4">
                    <span>{coffee.name}</span>
                    <span className="text-muted-foreground text-xs">
                      {gramsToLbs(coffee.current_green_quantity_g).toFixed(1)} lbs @ ${coffee.price_per_lb.toFixed(2)}/lb
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedCoffee && (
            <p className="text-xs text-muted-foreground">
              {selectedCoffee.origin} {selectedCoffee.supplier ? `- ${selectedCoffee.supplier}` : ""} 
              {selectedCoffee.lot_code ? ` | Lot: ${selectedCoffee.lot_code}` : ""}
              {" | "}Available: {gramsToLbs(selectedCoffee.current_green_quantity_g).toFixed(1)} lbs
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="coffeeName">Coffee Name *</Label>
          <Input
            id="coffeeName"
            value={batchData.coffeeName}
            onChange={(e) =>
              setBatchData({ ...batchData, coffeeName: e.target.value })
            }
            placeholder="e.g., Ethiopia Yirgacheffe"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lotCode">Lot Code</Label>
          <Input
            id="lotCode"
            value={batchData.lotCode}
            onChange={(e) =>
              setBatchData({ ...batchData, lotCode: e.target.value })
            }
            placeholder="e.g., LOT-2024-001"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="priceBasis">Price Basis *</Label>
          <Select
            value={batchData.priceBasis}
            onValueChange={(value: "per_lb" | "per_kg") =>
              setBatchData({ ...batchData, priceBasis: value })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="per_lb">Per Pound</SelectItem>
              <SelectItem value="per_kg">Per Kilogram</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="priceValue">
            Green Price (${batchData.priceBasis === "per_lb" ? "/lb" : "/kg"}) *
          </Label>
          <Input
            id="priceValue"
            type="number"
            step="0.01"
            value={batchData.priceValue}
            onChange={(e) =>
              setBatchData({ ...batchData, priceValue: e.target.value })
            }
            placeholder="e.g., 5.50"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="greenWeightG">Green Weight (g) *</Label>
          <Input
            id="greenWeightG"
            type="number"
            value={batchData.greenWeightG}
            onChange={(e) =>
              setBatchData({ ...batchData, greenWeightG: e.target.value })
            }
            placeholder="e.g., 5000"
          />
          {batchData.greenWeightG && (
            <p className="text-xs text-muted-foreground">
              {(parseFloat(batchData.greenWeightG) / LBS_TO_GRAMS).toFixed(2)} lbs
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="roastedWeightG">Roasted Weight (g) *</Label>
          <Input
            id="roastedWeightG"
            type="number"
            value={batchData.roastedWeightG}
            onChange={(e) =>
              setBatchData({ ...batchData, roastedWeightG: e.target.value })
            }
            placeholder="e.g., 4250"
          />
          {batchData.roastedWeightG && (
            <p className="text-xs text-muted-foreground">
              {(parseFloat(batchData.roastedWeightG) / LBS_TO_GRAMS).toFixed(2)} lbs
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="rejectsG">Rejects (g)</Label>
          <Input
            id="rejectsG"
            type="number"
            value={batchData.rejectsG}
            onChange={(e) =>
              setBatchData({ ...batchData, rejectsG: e.target.value })
            }
            placeholder="0"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="roastMinutes">Roast Duration (min) *</Label>
          <Input
            id="roastMinutes"
            type="number"
            step="0.5"
            value={batchData.roastMinutes}
            onChange={(e) =>
              setBatchData({ ...batchData, roastMinutes: e.target.value })
            }
            placeholder="e.g., 12"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="energyKwh">Energy (kWh)</Label>
          <Input
            id="energyKwh"
            type="number"
            step="0.01"
            value={batchData.energyKwh}
            onChange={(e) =>
              setBatchData({ ...batchData, energyKwh: e.target.value })
            }
            placeholder="Optional"
          />
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header - Stacked on mobile */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 sm:gap-4">
          <Button variant="ghost" size="icon" asChild className="shrink-0">
            <Link href="/roasting">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base sm:text-lg font-semibold">
                {format(new Date(session.session_date), "MMM d, yyyy")}
              </h2>
              <Badge variant="outline" className="shrink-0">{session.vendor_name}</Badge>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground truncate">
              {session.cost_mode === "co_roasting"
                ? `$${Number(session.rate_per_lb || 0).toFixed(2)}/lb (green)`
                : session.cost_mode === "power_usage"
                ? `${session.machine_energy_kwh_per_hour || 0} kWh/hr | $${(
                    session.kwh_rate || 0
                  ).toFixed(4)}/kWh | ${session.billing_granularity_minutes} min billing`
                : `$${session.rate_per_hour}/hr | ${session.billing_granularity_minutes} min billing`}
            </p>
          </div>
        </div>
        <Dialog open={isAddBatchOpen} onOpenChange={setIsAddBatchOpen}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto">
              <Plus className="mr-2 h-4 w-4" />
              Add Batch
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Add New Batch</DialogTitle>
              <DialogDescription>
                Record the details of your roasting batch
              </DialogDescription>
            </DialogHeader>
            {batchFormFields}
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsAddBatchOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddBatch}
                disabled={isSubmitting || !batchData.coffeeName || !batchData.greenWeightG || !batchData.roastedWeightG || (session.cost_mode !== "co_roasting" && !batchData.roastMinutes) || !batchData.priceValue}
              >
                {isSubmitting ? "Adding..." : "Add Batch"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards - Compact on mobile, full on desktop */}
      {/* Mobile: Single card with key stats */}
      <Card className="md:hidden">
        <CardContent className="py-4">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold">{batches.length}</div>
              <div className="text-xs text-muted-foreground">Batches</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{(totalSellableG / 1000).toFixed(1)}<span className="text-sm">kg</span></div>
              <div className="text-xs text-muted-foreground">Sellable</div>
            </div>
            <div>
              <div className="text-2xl font-bold">${sessionTollCost.toFixed(0)}</div>
              <div className="text-xs text-muted-foreground">Toll</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Desktop: Full stats grid */}
      <div className="hidden md:grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Batches
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{batches.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Green Weight
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(totalGreenG / 1000).toFixed(2)} kg</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Sellable Weight
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(totalSellableG / 1000).toFixed(2)} kg</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Avg Loss %
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {avgLossPercent !== null ? `${avgLossPercent.toFixed(1)}%` : "-"}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Session Toll
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${sessionTollCost.toFixed(2)}</div>
            {session.cost_mode !== "co_roasting" && (
              <p className="text-xs text-muted-foreground">{billableMinutes} min billed</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Pending Roast Requests Banner */}
      {pendingRequests.length > 0 && (
        <Card className="border-amber-500/50 bg-amber-500/5">
          <CardContent className="py-3 sm:py-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="rounded-full bg-amber-500/10 p-2 shrink-0">
                  <ClipboardList className="h-4 w-4 sm:h-5 sm:w-5 text-amber-600" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold">
                    {pendingRequests.length} Pending Request{pendingRequests.length !== 1 ? "s" : ""}
                  </h3>
                  <p className="text-xs text-muted-foreground truncate">
                    {pendingRequests.map((r) => r.green_coffee_inventory?.name || "Unknown").join(", ")}
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                onClick={() => setIsAddBatchOpen(true)}
                className="w-full sm:w-auto shrink-0"
              >
                <Plus className="mr-1 h-4 w-4" />
                Fulfill Request
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Batch Grid */}
      {batches.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8 sm:py-12">
            <div className="rounded-full bg-muted p-3 sm:p-4 mb-3 sm:mb-4">
              <Package className="h-6 w-6 sm:h-8 sm:w-8 text-muted-foreground" />
            </div>
            <h3 className="text-base sm:text-lg font-semibold mb-2">No Batches Yet</h3>
            <p className="text-sm text-muted-foreground text-center mb-4 px-4">
              Add your first batch to start tracking
            </p>
            <Button onClick={() => setIsAddBatchOpen(true)} className="w-full sm:w-auto">
              <Plus className="mr-2 h-4 w-4" />
              Add First Batch
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3 sm:space-y-0 sm:grid sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {batches.map((batch) => {
            // Compute per-batch cost breakdown
            const greenCostPerG = batch.green_cost_per_g;
            const totalGreenCost = greenCostPerG * batch.green_weight_g;
            let roastingCostPerG = 0;
            let totalCostPerG = 0;

            if (batch.sellable_g > 0) {
              if (session.cost_mode === "co_roasting") {
                const roastingCost = (batch.green_weight_g / 453.592) * Number(session.rate_per_lb || 0);
                roastingCostPerG = roastingCost / batch.sellable_g;
                totalCostPerG = (totalGreenCost + roastingCost) / batch.sellable_g;
              } else {
                const batchCount = Math.max(batches.length, 1);
                const batchEffectiveMinutes =
                  batch.roast_minutes +
                  (session.setup_minutes + session.cleanup_minutes) / batchCount;
                const batchAllocatedCost =
                  totalSessionMinutes > 0
                    ? sessionTollCost * (batchEffectiveMinutes / totalSessionMinutes)
                    : 0;
                roastingCostPerG = batchAllocatedCost / batch.sellable_g;
                totalCostPerG = (totalGreenCost + batchAllocatedCost) / batch.sellable_g;
              }
            }

            return (
            <Card key={batch.id}>
              <CardHeader className="pb-2 px-4 sm:px-6">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <CardTitle className="text-base truncate">
                      {batch.coffee_name}
                    </CardTitle>
                    {batch.lot_code && (
                      <p className="text-xs text-muted-foreground truncate">
                        Lot: {batch.lot_code}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => openEditBatch(batch)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => setDeleteBatchId(batch.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-4 sm:px-6 pb-4">
                <div className="grid grid-cols-3 gap-x-2 gap-y-2 text-sm">
                  <div>
                    <span className="text-xs text-muted-foreground block">Green</span>
                    <span className="font-medium">{batch.green_weight_g}g</span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block">Roasted</span>
                    <span className="font-medium">{batch.roasted_weight_g}g</span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block">Loss</span>
                    <span
                      className={`font-medium ${
                        batch.loss_percent > 18
                          ? "text-destructive"
                          : batch.loss_percent < 12
                            ? "text-amber-600"
                            : "text-green-600"
                      }`}
                    >
                      {batch.loss_percent.toFixed(1)}%
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block">Sellable</span>
                    <span className="font-medium">{batch.sellable_g}g</span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block">Time</span>
                    <span className="font-medium">{batch.roast_minutes}min</span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block">Price</span>
                    <span className="font-medium">
                      ${batch.price_value}/{batch.price_basis === "per_lb" ? "lb" : "kg"}
                    </span>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t">
                  <p className="text-xs text-muted-foreground mb-1.5 uppercase tracking-wide font-semibold">Cost / gram</p>
                  <div className="grid grid-cols-3 gap-x-2 text-sm">
                    <div>
                      <span className="text-xs text-muted-foreground block">Green</span>
                      <span className="font-medium">${greenCostPerG.toFixed(5)}</span>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground block">Roasting</span>
                      <span className="font-medium">${roastingCostPerG.toFixed(5)}</span>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground block">Total</span>
                      <span className="font-semibold">${totalCostPerG.toFixed(5)}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            );
          })}
        </div>
      )}

      {/* Edit Batch Dialog */}
      <Dialog open={!!editingBatch} onOpenChange={(open) => !open && setEditingBatch(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Batch</DialogTitle>
            <DialogDescription>Update the batch details</DialogDescription>
          </DialogHeader>
          {batchFormFields}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingBatch(null)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateBatch} disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deleteBatchId}
        onOpenChange={(open) => !open && setDeleteBatchId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Batch?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete this
              batch record.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteBatch}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

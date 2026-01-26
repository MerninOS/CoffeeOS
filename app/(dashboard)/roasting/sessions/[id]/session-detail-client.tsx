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
} from "lucide-react";
import {
  createBatch,
  updateBatch,
  deleteBatch,
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
  setup_minutes: number;
  cleanup_minutes: number;
  billing_granularity_minutes: number;
  allocation_mode: string;
  notes: string | null;
}

interface SessionDetailClientProps {
  session: Session;
  batches: Batch[];
}

const defaultBatchData = {
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
}: SessionDetailClientProps) {
  const router = useRouter();
  const [batches, setBatches] = useState(initialBatches);
  const [isAddBatchOpen, setIsAddBatchOpen] = useState(false);
  const [editingBatch, setEditingBatch] = useState<Batch | null>(null);
  const [deleteBatchId, setDeleteBatchId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [batchData, setBatchData] = useState(defaultBatchData);

  const handleAddBatch = async () => {
    if (!batchData.coffeeName || !batchData.greenWeightG || !batchData.roastedWeightG || !batchData.roastMinutes || !batchData.priceValue) {
      alert("Please fill in all required fields: Coffee Name, Price, Green Weight, Roasted Weight, and Roast Duration");
      return;
    }

    setIsSubmitting(true);
    const result = await createBatch({
      sessionId: session.id,
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
    setIsSubmitting(false);

    if (result.error) {
      alert(result.error);
      return;
    }

    if (result.batch) {
      setBatches([...batches, result.batch]);
      setIsAddBatchOpen(false);
      setBatchData(defaultBatchData);
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
  const sessionTollCost = (billableMinutes / 60) * session.rate_per_hour;

  const batchFormFields = (
    <div className="grid gap-4 py-4">
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/roasting">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold">
                {format(new Date(session.session_date), "MMMM d, yyyy")}
              </h2>
              <Badge variant="outline">{session.vendor_name}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              ${session.rate_per_hour}/hr | {session.billing_granularity_minutes} min billing
              {session.notes && ` | ${session.notes}`}
            </p>
          </div>
        </div>
        <Dialog open={isAddBatchOpen} onOpenChange={setIsAddBatchOpen}>
          <DialogTrigger asChild>
            <Button>
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
                disabled={isSubmitting || !batchData.coffeeName || !batchData.greenWeightG || !batchData.roastedWeightG || !batchData.roastMinutes || !batchData.priceValue}
              >
                {isSubmitting ? "Adding..." : "Add Batch"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-5">
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
            <p className="text-xs text-muted-foreground">{billableMinutes} min billed</p>
          </CardContent>
        </Card>
      </div>

      {/* Batch Grid */}
      {batches.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="rounded-full bg-muted p-4 mb-4">
              <Package className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No Batches Yet</h3>
            <p className="text-muted-foreground text-center mb-4">
              Add your first batch to start tracking this session
            </p>
            <Button onClick={() => setIsAddBatchOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add First Batch
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {batches.map((batch) => (
            <Card key={batch.id} className="relative">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">
                    {batch.coffee_name}
                  </CardTitle>
                  <div className="flex items-center gap-1">
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
                {batch.lot_code && (
                  <p className="text-sm text-muted-foreground">
                    Lot: {batch.lot_code}
                  </p>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Green:</span>{" "}
                    <span className="font-medium">{batch.green_weight_g}g</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Roasted:</span>{" "}
                    <span className="font-medium">{batch.roasted_weight_g}g</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Sellable:</span>{" "}
                    <span className="font-medium">{batch.sellable_g}g</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Loss:</span>{" "}
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
                    <span className="text-muted-foreground">Duration:</span>{" "}
                    <span className="font-medium">{batch.roast_minutes} min</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Price:</span>{" "}
                    <span className="font-medium">
                      ${batch.price_value}/{batch.price_basis === "per_lb" ? "lb" : "kg"}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
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

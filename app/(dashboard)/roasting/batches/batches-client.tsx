"use client";

import { useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  MoreHorizontal,
  Trash2,
  Eye,
  Package,
  Plus,
} from "lucide-react";
import { deleteBatch, createComponentFromBatch, addToExistingComponent } from "../actions";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface Batch {
  id: string;
  coffee_name: string;
  lot_code: string | null;
  price_basis: "per_lb" | "per_kg";
  price_value: number;
  green_weight_g: number;
  roasted_weight_g: number;
  rejects_g: number;
  sellable_g: number;
  loss_percent: number;
  roast_minutes: number;
  batch_date: string;
  energy_kwh: number | null;
  kwh_rate: number | null;
  green_cost_per_g: number;
  component_id: string | null;
  created_at: string;
  roasting_sessions: {
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
    session_toll_cost: number | null;
  } | null;
  components: {
    id: string;
    name: string;
  } | null;
}

interface ExistingComponent {
  id: string;
  name: string;
  cost_per_unit: number;
  unit: string;
  type: string;
}

interface BatchesClientProps {
  initialBatches: Batch[];
  existingComponents: ExistingComponent[];
}

const UNITS = ["g", "oz", "lb", "kg"];
const COST_PER_UNIT_DECIMALS = 8;

const getSessionAggForBatch = (batch: Batch, allBatches: Batch[]) => {
  if (!batch.roasting_sessions) {
    return { totalRoastMinutes: batch.roast_minutes || 0, batchCount: 1 };
  }

  const sessionId = batch.roasting_sessions.id;
  const sessionBatches = allBatches.filter((b) => b.roasting_sessions?.id === sessionId);
  const totalRoastMinutes = sessionBatches.reduce(
    (sum, b) => sum + (b.roast_minutes || 0),
    0
  );

  return {
    totalRoastMinutes,
    batchCount: Math.max(sessionBatches.length, 1),
  };
};

const getSessionCostForBatch = (batch: Batch, allBatches: Batch[]) => {
  if (!batch.roasting_sessions) return 0;

  const session = batch.roasting_sessions;

  if (session.cost_mode === "co_roasting") {
    // Co-roasting: charged per pound of green coffee, summed across all batches in session
    const sessionId = session.id;
    const sessionBatches = allBatches.filter((b) => b.roasting_sessions?.id === sessionId);
    return sessionBatches.reduce(
      (sum, b) => sum + (b.green_weight_g / 453.592) * (session.rate_per_lb || 0),
      0
    );
  }

  const { totalRoastMinutes } = getSessionAggForBatch(batch, allBatches);
  const totalSessionMinutes =
    (session.setup_minutes || 0) +
    totalRoastMinutes +
    (session.cleanup_minutes || 0);
  const billableMinutes =
    Math.ceil(totalSessionMinutes / (session.billing_granularity_minutes || 15)) *
    (session.billing_granularity_minutes || 15);

  if (session.cost_mode === "power_usage") {
    return (
      (billableMinutes / 60) *
      (session.machine_energy_kwh_per_hour || 0) *
      (session.kwh_rate || 0)
    );
  }

  return (billableMinutes / 60) * (session.rate_per_hour || 0);
};

const getBatchCostPerGram = (batch: Batch, allBatches: Batch[]) => {
  if (batch.sellable_g <= 0) return 0;

  const session = batch.roasting_sessions;
  const totalGreenCost = batch.green_cost_per_g * batch.green_weight_g;

  if (session?.cost_mode === "co_roasting") {
    const roastingCost = (batch.green_weight_g / 453.592) * (session.rate_per_lb || 0);
    return (totalGreenCost + roastingCost) / batch.sellable_g;
  }

  const { totalRoastMinutes, batchCount } = getSessionAggForBatch(batch, allBatches);
  const setupMinutes = session?.setup_minutes || 0;
  const cleanupMinutes = session?.cleanup_minutes || 0;
  const totalSessionMinutes = setupMinutes + totalRoastMinutes + cleanupMinutes;
  const batchEffectiveMinutes =
    (batch.roast_minutes || 0) + (setupMinutes + cleanupMinutes) / batchCount;
  const sessionCost = getSessionCostForBatch(batch, allBatches);
  const allocatedSessionCost =
    totalSessionMinutes > 0
      ? sessionCost * (batchEffectiveMinutes / totalSessionMinutes)
      : 0;

  return (totalGreenCost + allocatedSessionCost) / batch.sellable_g;
};

export function BatchesClient({ initialBatches, existingComponents }: BatchesClientProps) {
  const [batches, setBatches] = useState(initialBatches);
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [createComponentBatch, setCreateComponentBatch] =
    useState<Batch | null>(null);
  const [componentMode, setComponentMode] = useState<"new" | "existing">("new");
  const [selectedComponentId, setSelectedComponentId] = useState<string>("");
  const [componentFormData, setComponentFormData] = useState({
    name: "",
    costPerUnit: "",
    unit: "g",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filteredBatches = batches.filter((batch) => {
    const query = searchQuery.toLowerCase();
    return (
      batch.coffee_name?.toLowerCase().includes(query) ||
      batch.lot_code?.toLowerCase().includes(query)
    );
  });

  const handleDelete = async () => {
    if (!deleteId) return;

    const result = await deleteBatch(deleteId);
    if (result.error) {
      alert(result.error);
    } else {
      setBatches(batches.filter((b) => b.id !== deleteId));
    }
    setDeleteId(null);
  };

  const openCreateComponent = (batch: Batch) => {
    setCreateComponentBatch(batch);
    // Pre-fill with suggested values
    const suggestedName = `Roasted ${batch.coffee_name}`;
    const costPerG = getBatchCostPerGram(batch, batches);
    setComponentFormData({
      name: suggestedName,
      costPerUnit: costPerG.toFixed(COST_PER_UNIT_DECIMALS),
      unit: "g",
    });
    // Reset mode and selection
    setComponentMode("new");
    setSelectedComponentId("");
  };

  const handleCreateComponent = async () => {
    if (!createComponentBatch) return;
    setIsSubmitting(true);

    if (componentMode === "existing" && selectedComponentId) {
      // Add to existing component
      const result = await addToExistingComponent(
        createComponentBatch.id,
        selectedComponentId
      );
      setIsSubmitting(false);

      if (result.error) {
        alert(result.error);
        return;
      }

      if (result.component) {
        const selectedComp = existingComponents.find(c => c.id === selectedComponentId);
        // Update the batch in our local state to show it's linked
        setBatches(
          batches.map((b) =>
            b.id === createComponentBatch.id
              ? {
                  ...b,
                  component_id: result.component.id,
                  components: { id: result.component.id, name: result.component.name },
                }
              : b
          )
        );
        alert(
          `Added to "${selectedComp?.name}". Cost updated from $${result.previousCost?.toFixed(
            COST_PER_UNIT_DECIMALS
          )} to $${result.newAveragedCost?.toFixed(COST_PER_UNIT_DECIMALS)} per gram.`
        );
        setCreateComponentBatch(null);
        setComponentFormData({ name: "", costPerUnit: "", unit: "g" });
        setSelectedComponentId("");
      }
    } else {
      // Create new component
      const result = await createComponentFromBatch(createComponentBatch.id, {
        name: componentFormData.name,
        costPerUnit: parseFloat(componentFormData.costPerUnit),
        unit: componentFormData.unit,
      });
      setIsSubmitting(false);

      if (result.error) {
        alert(result.error);
        return;
      }

      if (result.component) {
        // Update the batch in our local state to show it's linked
        setBatches(
          batches.map((b) =>
            b.id === createComponentBatch.id
              ? {
                  ...b,
                  component_id: result.component.id,
                  components: { id: result.component.id, name: result.component.name },
                }
              : b
          )
        );
        setCreateComponentBatch(null);
        setComponentFormData({ name: "", costPerUnit: "", unit: "g" });
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">All Batches</h2>
          <p className="text-sm text-muted-foreground">
            View all roasting batches across sessions
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative w-full md:max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by coffee name or lot code..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {batches.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="rounded-full bg-muted p-4 mb-4">
              <Package className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No Batches Yet</h3>
            <p className="text-muted-foreground text-center mb-4">
              Create a roasting session and add batches to see them here
            </p>
            <Button asChild>
              <Link href="/roasting">Go to Sessions</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
        {/* Mobile card layout */}
        <div className="space-y-2 md:hidden">
          {filteredBatches.map((batch) => (
            <div key={batch.id} className="rounded-lg border p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{batch.coffee_name}</p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    {batch.roasting_sessions ? (
                      <Link
                        href={`/roasting/sessions/${batch.roasting_sessions.id}`}
                        className="hover:underline"
                      >
                        {format(new Date(batch.roasting_sessions.session_date), "MMM d, yyyy")}
                      </Link>
                    ) : (
                      <span>{format(new Date(batch.batch_date), "MMM d, yyyy")}</span>
                    )}
                    {batch.lot_code && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">{batch.lot_code}</Badge>
                    )}
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {batch.roasting_sessions && (
                      <DropdownMenuItem asChild>
                        <Link href={`/roasting/sessions/${batch.roasting_sessions.id}`}>
                          <Eye className="mr-2 h-4 w-4" />
                          View Session
                        </Link>
                      </DropdownMenuItem>
                    )}
                    {!batch.component_id && (
                      <DropdownMenuItem onClick={() => openCreateComponent(batch)}>
                        <Package className="mr-2 h-4 w-4" />
                        Create Component
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => setDeleteId(batch.id)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="mt-2 grid grid-cols-4 gap-1 text-xs">
                <div>
                  <span className="text-muted-foreground">Green</span>
                  <p className="font-medium">{batch.green_weight_g.toFixed(0)}g</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Roasted</span>
                  <p className="font-medium">{batch.roasted_weight_g.toFixed(0)}g</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Loss</span>
                  <p className={`font-medium ${
                    batch.loss_percent > 18
                      ? "text-destructive"
                      : batch.loss_percent < 12
                        ? "text-amber-600"
                        : "text-green-600"
                  }`}>
                    {batch.loss_percent.toFixed(1)}%
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Sellable</span>
                  <p className="font-medium">{batch.sellable_g.toFixed(0)}g</p>
                </div>
              </div>

              {batch.components ? (
                <div className="mt-2">
                  <Link
                    href="/components"
                    className="inline-flex items-center gap-1 text-xs hover:underline"
                  >
                    <Package className="h-3 w-3" />
                    {batch.components.name}
                  </Link>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2 h-7 w-full text-xs"
                  onClick={() => openCreateComponent(batch)}
                >
                  <Plus className="mr-1 h-3 w-3" />
                  Create Component
                </Button>
              )}
            </div>
          ))}
        </div>

        {/* Desktop table layout */}
        <Card className="hidden md:block">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Coffee</TableHead>
                  <TableHead>Session</TableHead>
                  <TableHead>Lot Code</TableHead>
                  <TableHead className="text-right">Green (g)</TableHead>
                  <TableHead className="text-right">Roasted (g)</TableHead>
                  <TableHead className="text-right">Loss %</TableHead>
                  <TableHead className="text-right">Sellable (g)</TableHead>
                  <TableHead>Component</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBatches.map((batch) => (
                  <TableRow key={batch.id}>
                    <TableCell className="font-medium">
                      {batch.coffee_name}
                    </TableCell>
                    <TableCell>
                      {batch.roasting_sessions ? (
                        <Link
                          href={`/roasting/sessions/${batch.roasting_sessions.id}`}
                          className="hover:underline"
                        >
                          {format(
                            new Date(batch.roasting_sessions.session_date),
                            "MMM d, yyyy"
                          )}
                        </Link>
                      ) : (
                        format(new Date(batch.batch_date), "MMM d, yyyy")
                      )}
                    </TableCell>
                    <TableCell>
                      {batch.lot_code ? (
                        <Badge variant="outline">{batch.lot_code}</Badge>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {batch.green_weight_g.toFixed(0)}
                    </TableCell>
                    <TableCell className="text-right">
                      {batch.roasted_weight_g.toFixed(0)}
                    </TableCell>
                    <TableCell className="text-right">
                      <span
                        className={
                          batch.loss_percent > 18
                            ? "text-destructive"
                            : batch.loss_percent < 12
                              ? "text-amber-600"
                              : "text-green-600"
                        }
                      >
                        {batch.loss_percent.toFixed(1)}%
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {batch.sellable_g.toFixed(0)}
                    </TableCell>
                    <TableCell>
                      {batch.components ? (
                        <Link
                          href="/components"
                          className="text-sm hover:underline flex items-center gap-1"
                        >
                          <Package className="h-3 w-3" />
                          {batch.components.name}
                        </Link>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => openCreateComponent(batch)}
                        >
                          <Plus className="mr-1 h-3 w-3" />
                          Create
                        </Button>
                      )}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {batch.roasting_sessions && (
                            <DropdownMenuItem asChild>
                              <Link
                                href={`/roasting/sessions/${batch.roasting_sessions.id}`}
                              >
                                <Eye className="mr-2 h-4 w-4" />
                                View Session
                              </Link>
                            </DropdownMenuItem>
                          )}
                          {!batch.component_id && (
                            <DropdownMenuItem
                              onClick={() => openCreateComponent(batch)}
                            >
                              <Package className="mr-2 h-4 w-4" />
                              Create Component
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => setDeleteId(batch.id)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        </>
      )}

      {/* Create Component Dialog */}
      <Dialog
        open={!!createComponentBatch}
        onOpenChange={() => setCreateComponentBatch(null)}
      >
        <DialogContent>
          <DialogHeader>
<DialogTitle>Add Roasted Coffee to Component</DialogTitle>
  <DialogDescription>
  Create a new component or add to an existing one for COGS calculations
  </DialogDescription>
  </DialogHeader>
  <div className="space-y-4 py-4">
  {/* Mode Selection */}
  {existingComponents.length > 0 && (
    <div className="space-y-3">
      <Label>What would you like to do?</Label>
      <RadioGroup
        value={componentMode}
        onValueChange={(value) => setComponentMode(value as "new" | "existing")}
        className="flex gap-4"
      >
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="new" id="mode-new" />
          <Label htmlFor="mode-new" className="cursor-pointer font-normal">Create new component</Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="existing" id="mode-existing" />
          <Label htmlFor="mode-existing" className="cursor-pointer font-normal">Add to existing</Label>
        </div>
      </RadioGroup>
    </div>
  )}

  {/* Existing Component Selection */}
  {componentMode === "existing" && existingComponents.length > 0 && (
    <div className="space-y-2">
      <Label>Select Component</Label>
      <Select
        value={selectedComponentId}
        onValueChange={setSelectedComponentId}
      >
        <SelectTrigger>
          <SelectValue placeholder="Choose a component..." />
        </SelectTrigger>
        <SelectContent>
          {existingComponents.map((comp) => (
            <SelectItem key={comp.id} value={comp.id}>
              <div className="flex items-center justify-between gap-4">
                <span>{comp.name}</span>
                <span className="text-muted-foreground text-xs">
                  ${comp.cost_per_unit.toFixed(COST_PER_UNIT_DECIMALS)}/{comp.unit}
                </span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {selectedComponentId && (
        <p className="text-xs text-muted-foreground">
          Current price will be averaged with this batch&apos;s cost per gram
        </p>
      )}
    </div>
  )}

  {/* New Component Fields */}
  {componentMode === "new" && (
    <>
      <div className="space-y-2">
        <Label htmlFor="componentName">Component Name</Label>
        <Input
          id="componentName"
          value={componentFormData.name}
          onChange={(e) =>
            setComponentFormData({
              ...componentFormData,
              name: e.target.value,
            })
          }
          placeholder="e.g., Roasted Ethiopia Yirgacheffe"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="costPerUnit">Cost per Unit</Label>
          <Input
            id="costPerUnit"
            type="number"
            step="0.00000001"
            value={componentFormData.costPerUnit}
            onChange={(e) =>
              setComponentFormData({
                ...componentFormData,
                costPerUnit: e.target.value,
              })
            }
            placeholder="0.00"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="unit">Unit</Label>
          <Select
            value={componentFormData.unit}
            onValueChange={(value) =>
              setComponentFormData({ ...componentFormData, unit: value })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {UNITS.map((unit) => (
                <SelectItem key={unit} value={unit}>
                  {unit}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </>
  )}
            {createComponentBatch && (
              <div className="rounded-lg border bg-muted/50 p-3 text-sm">
                <p className="font-medium mb-1">Batch Details:</p>
                <ul className="text-muted-foreground space-y-0.5">
                  <li>Coffee: {createComponentBatch.coffee_name}</li>
                  <li>Lot: {createComponentBatch.lot_code || "N/A"}</li>
                  <li>Sellable Weight: {createComponentBatch.sellable_g.toFixed(0)}g</li>
                  <li>Loss: {createComponentBatch.loss_percent.toFixed(1)}%</li>
                </ul>
              </div>
            )}
          </div>
<DialogFooter>
  <Button
    variant="outline"
    onClick={() => setCreateComponentBatch(null)}
  >
    Cancel
  </Button>
  <Button
    onClick={handleCreateComponent}
    disabled={
      isSubmitting ||
      (componentMode === "new" && (!componentFormData.name || !componentFormData.costPerUnit)) ||
      (componentMode === "existing" && !selectedComponentId)
    }
  >
    {isSubmitting
      ? componentMode === "existing" ? "Adding..." : "Creating..."
      : componentMode === "existing"
        ? "Add to Component"
        : "Create Component"}
  </Button>
  </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Batch?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this batch. This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
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

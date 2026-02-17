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
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
import { Plus, MoreHorizontal, Trash2, Eye, Flame } from "lucide-react";
import { createSession, deleteSession } from "./actions";

export interface Session {
  id: string;
  session_date: string;
  vendor_name: string;
  rate_per_hour: number;
  cost_mode: "toll_roasting" | "power_usage";
  machine_energy_kwh_per_hour: number | null;
  kwh_rate: number | null;
  setup_minutes: number;
  cleanup_minutes: number;
  billing_granularity_minutes: number;
  allocation_mode: string;
  billable_minutes: number | null;
  session_toll_cost: number | null;
  notes: string | null;
  created_at: string;
  batch_count: number;
  total_green_weight_g: number;
  total_roasted_weight_g: number;
}

interface SessionsClientProps {
  initialSessions: Session[];
  hideHeader?: boolean;
}

export function SessionsClient({ initialSessions, hideHeader = false }: SessionsClientProps) {
  const router = useRouter();
  const [sessions, setSessions] = useState(initialSessions);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    sessionDate: format(new Date(), "yyyy-MM-dd"),
    vendorName: "",
    costMode: "toll_roasting" as "toll_roasting" | "power_usage",
    ratePerHour: "",
    machineEnergyKwhPerHour: "",
    kwhRate: "",
    setupMinutes: "0",
    cleanupMinutes: "0",
    billingGranularityMinutes: "15",
    allocationMode: "time_weighted",
    notes: "",
  });

  const handleCreate = async () => {
    if (!formData.vendorName) {
      alert("Please fill in vendor name");
      return;
    }

    if (formData.costMode === "toll_roasting" && !formData.ratePerHour) {
      alert("Please fill in hourly rate for toll roasting");
      return;
    }

    if (
      formData.costMode === "power_usage" &&
      (!formData.machineEnergyKwhPerHour || !formData.kwhRate)
    ) {
      alert("Please fill in machine energy usage and kWh rate");
      return;
    }

    setIsSubmitting(true);
    const result = await createSession({
      sessionDate: formData.sessionDate,
      vendorName: formData.vendorName,
      costMode: formData.costMode,
      ratePerHour:
        formData.costMode === "toll_roasting"
          ? parseFloat(formData.ratePerHour)
          : 0,
      machineEnergyKwhPerHour:
        formData.costMode === "power_usage"
          ? parseFloat(formData.machineEnergyKwhPerHour)
          : undefined,
      kwhRate:
        formData.costMode === "power_usage"
          ? parseFloat(formData.kwhRate)
          : undefined,
      setupMinutes: parseInt(formData.setupMinutes) || 0,
      cleanupMinutes: parseInt(formData.cleanupMinutes) || 0,
      billingGranularityMinutes: parseInt(formData.billingGranularityMinutes) || 15,
      allocationMode: formData.allocationMode,
      notes: formData.notes || undefined,
    });
    setIsSubmitting(false);

    if (result.error) {
      alert(result.error);
      return;
    }

    if (result.session) {
      setSessions([
        {
          ...result.session,
          batch_count: 0,
          total_green_weight_g: 0,
          total_roasted_weight_g: 0,
        },
        ...sessions,
      ]);
      setIsCreateOpen(false);
      setFormData({
        sessionDate: format(new Date(), "yyyy-MM-dd"),
        vendorName: "",
        costMode: "toll_roasting",
        ratePerHour: "",
        machineEnergyKwhPerHour: "",
        kwhRate: "",
        setupMinutes: "0",
        cleanupMinutes: "0",
        billingGranularityMinutes: "15",
        allocationMode: "time_weighted",
        notes: "",
      });
      // Navigate to the new session
      router.push(`/roasting/sessions/${result.session.id}`);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    const result = await deleteSession(deleteId);
    if (result.error) {
      alert(result.error);
    } else {
      setSessions(sessions.filter((s) => s.id !== deleteId));
    }
    setDeleteId(null);
  };

  const calculateWeightLoss = (green: number, roasted: number) => {
    if (!green || !roasted) return null;
    return ((green - roasted) / green) * 100;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Roasting Sessions</h2>
          <p className="text-sm text-muted-foreground">
            View and manage your roasting sessions
          </p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto">
              <Plus className="mr-2 h-4 w-4" />
              New Session
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Roasting Session</DialogTitle>
              <DialogDescription>
                Start a new roasting session to track your batches
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="sessionDate">Session Date</Label>
                  <Input
                    id="sessionDate"
                    type="date"
                    value={formData.sessionDate}
                    onChange={(e) =>
                      setFormData({ ...formData, sessionDate: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vendorName">Vendor / Roastery Name</Label>
                  <Input
                    id="vendorName"
                    value={formData.vendorName}
                    onChange={(e) =>
                      setFormData({ ...formData, vendorName: e.target.value })
                    }
                    placeholder="e.g., Mill City Roasters"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2 rounded-md border p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <Label htmlFor="costModeToggle">Roasting Cost Method</Label>
                    <p className="text-xs text-muted-foreground">
                      {formData.costMode === "toll_roasting"
                        ? "Using toll roasting hourly rate"
                        : "Using machine power usage (kWh)"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Toll</span>
                    <Switch
                      id="costModeToggle"
                      checked={formData.costMode === "power_usage"}
                      onCheckedChange={(checked) =>
                        setFormData({
                          ...formData,
                          costMode: checked ? "power_usage" : "toll_roasting",
                        })
                      }
                    />
                    <span className="text-xs text-muted-foreground">Power</span>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {formData.costMode === "toll_roasting" ? (
                  <div className="space-y-2">
                    <Label htmlFor="ratePerHour">Rate per Hour ($)</Label>
                    <Input
                      id="ratePerHour"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.ratePerHour}
                      onChange={(e) =>
                        setFormData({ ...formData, ratePerHour: e.target.value })
                      }
                      placeholder="e.g., 75.00"
                      required
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="machineEnergyKwhPerHour">Machine Usage (kWh/hr)</Label>
                    <Input
                      id="machineEnergyKwhPerHour"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.machineEnergyKwhPerHour}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          machineEnergyKwhPerHour: e.target.value,
                        })
                      }
                      placeholder="e.g., 6.5"
                      required
                    />
                  </div>
                )}
                {formData.costMode === "power_usage" && (
                  <div className="space-y-2">
                    <Label htmlFor="kwhRate">Cost per kWh ($)</Label>
                    <Input
                      id="kwhRate"
                      type="number"
                      step="0.0001"
                      min="0"
                      value={formData.kwhRate}
                      onChange={(e) =>
                        setFormData({ ...formData, kwhRate: e.target.value })
                      }
                      placeholder="e.g., 0.1350"
                      required
                    />
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="billingGranularityMinutes">Billing Granularity (min)</Label>
                <Input
                  id="billingGranularityMinutes"
                  type="number"
                  min="1"
                  value={formData.billingGranularityMinutes}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      billingGranularityMinutes: e.target.value,
                    })
                  }
                />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="setupMinutes">Setup Time (min)</Label>
                  <Input
                    id="setupMinutes"
                    type="number"
                    min="0"
                    value={formData.setupMinutes}
                    onChange={(e) =>
                      setFormData({ ...formData, setupMinutes: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cleanupMinutes">Cleanup Time (min)</Label>
                  <Input
                    id="cleanupMinutes"
                    type="number"
                    min="0"
                    value={formData.cleanupMinutes}
                    onChange={(e) =>
                      setFormData({ ...formData, cleanupMinutes: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes (optional)</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData({ ...formData, notes: e.target.value })
                  }
                  placeholder="Any notes for this session..."
                  rows={2}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={isSubmitting}>
                {isSubmitting ? "Creating..." : "Create Session"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {sessions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="rounded-full bg-muted p-4 mb-4">
              <Flame className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No Sessions Yet</h3>
            <p className="text-muted-foreground text-center mb-4">
              Start tracking your roasting by creating your first session
            </p>
            <Button onClick={() => setIsCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create First Session
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Summary Cards - Hidden on mobile, show all 3 on desktop */}
          <div className="hidden md:grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Sessions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{sessions.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Batches
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {sessions.reduce((sum, s) => sum + s.batch_count, 0)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Roasted (g)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {sessions
                    .reduce((sum, s) => sum + s.total_roasted_weight_g, 0)
                    .toFixed(0)}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Desktop Sessions Table */}
          <Card className="hidden md:block">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead className="text-center">Batches</TableHead>
                    <TableHead className="text-right">Green (g)</TableHead>
                    <TableHead className="text-right">Roasted (g)</TableHead>
                    <TableHead className="text-right">Weight Loss</TableHead>
                    <TableHead className="text-right">Toll Cost</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessions.map((session) => {
                    const weightLoss = calculateWeightLoss(
                      session.total_green_weight_g,
                      session.total_roasted_weight_g
                    );

                    return (
                      <TableRow key={session.id}>
                        <TableCell>
                          <Link
                            href={`/roasting/sessions/${session.id}`}
                            className="font-medium hover:underline"
                          >
                            {format(new Date(session.session_date), "MMM d, yyyy")}
                          </Link>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {session.vendor_name}
                        </TableCell>
                        <TableCell className="text-center">
                          {session.batch_count}
                        </TableCell>
                        <TableCell className="text-right">
                          {session.total_green_weight_g.toFixed(0)}
                        </TableCell>
                        <TableCell className="text-right">
                          {session.total_roasted_weight_g.toFixed(0)}
                        </TableCell>
                        <TableCell className="text-right">
                          {weightLoss !== null ? (
                            <span
                              className={
                                weightLoss > 18
                                  ? "text-destructive"
                                  : weightLoss < 12
                                    ? "text-amber-600"
                                    : "text-green-600"
                              }
                            >
                              {weightLoss.toFixed(1)}%
                            </span>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {session.session_toll_cost !== null
                            ? `$${session.session_toll_cost.toFixed(2)}`
                            : "-"}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem asChild>
                                <Link href={`/roasting/sessions/${session.id}`}>
                                  <Eye className="mr-2 h-4 w-4" />
                                  View Details
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => setDeleteId(session.id)}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Mobile Sessions List */}
          <div className="md:hidden space-y-3">
            {sessions.map((session) => {
              const weightLoss = calculateWeightLoss(
                session.total_green_weight_g,
                session.total_roasted_weight_g
              );

              return (
                <Card key={session.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <Link
                          href={`/roasting/sessions/${session.id}`}
                          className="font-semibold text-base hover:underline block"
                        >
                          {format(new Date(session.session_date), "MMM d, yyyy")}
                        </Link>
                        <p className="text-sm text-muted-foreground truncate">
                          {session.vendor_name}
                        </p>
                      </div>
                      <Badge variant="secondary" className="shrink-0">
                        {session.batch_count} {session.batch_count === 1 ? "batch" : "batches"}
                      </Badge>
                    </div>

                    <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground block text-xs">Roasted</span>
                        <span className="font-medium">{session.total_roasted_weight_g.toFixed(0)}g</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-xs">Loss</span>
                        {weightLoss !== null ? (
                          <span
                            className={`font-medium ${weightLoss > 18
                                ? "text-destructive"
                                : weightLoss < 12
                                  ? "text-amber-600"
                                  : "text-green-600"
                              }`}
                          >
                            {weightLoss.toFixed(1)}%
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-xs">Cost</span>
                        <span className="font-medium">
                          {session.session_toll_cost !== null
                            ? `$${session.session_toll_cost.toFixed(2)}`
                            : "-"}
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 flex gap-2">
                      <Button asChild variant="default" size="sm" className="flex-1">
                        <Link href={`/roasting/sessions/${session.id}`}>
                          <Eye className="mr-2 h-4 w-4" />
                          View Session
                        </Link>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDeleteId(session.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Session?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this roasting session and all its
              batches. This action cannot be undone.
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

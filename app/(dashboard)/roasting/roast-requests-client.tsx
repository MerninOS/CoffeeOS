"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Plus,
  MoreHorizontal,
  Edit,
  Trash2,
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  Coffee,
} from "lucide-react";
import {
  createRoastRequest,
  updateRoastRequest,
  deleteRoastRequest,
} from "./actions";

interface CoffeeInventory {
  id: string;
  name: string;
  origin: string;
  current_green_quantity_g: number;
}

interface RoastRequest {
  id: string;
  coffee_inventory_id: string;
  requested_quantity_g: number;
  fulfilled_quantity_g: number;
  priority: "low" | "normal" | "high" | "urgent";
  status: "pending" | "in_progress" | "completed" | "cancelled";
  due_date: string | null;
  order_id: string | null;
  notes: string | null;
  created_at: string;
  green_coffee_inventory?: {
    name: string;
    origin: string;
  };
}

interface RoastRequestsClientProps {
  requests: RoastRequest[];
  coffeeInventory: CoffeeInventory[];
}

const LBS_TO_GRAMS = 453.592;
const gramsToLbs = (g: number) => g / LBS_TO_GRAMS;

const priorityConfig = {
  low: { label: "Low", className: "bg-muted text-muted-foreground" },
  normal: { label: "Normal", className: "bg-blue-500/10 text-blue-600 border-blue-500/30" },
  high: { label: "High", className: "bg-amber-500/10 text-amber-600 border-amber-500/30" },
  urgent: { label: "Urgent", className: "bg-red-500/10 text-red-600 border-red-500/30" },
};

const statusConfig = {
  pending: { label: "Pending", icon: Clock, className: "bg-muted text-muted-foreground" },
  in_progress: { label: "In Progress", icon: Coffee, className: "bg-blue-500/10 text-blue-600 border-blue-500/30" },
  completed: { label: "Completed", icon: CheckCircle2, className: "bg-green-500/10 text-green-600 border-green-500/30" },
  cancelled: { label: "Cancelled", icon: XCircle, className: "bg-red-500/10 text-red-600 border-red-500/30" },
};

export function RoastRequestsClient({ requests, coffeeInventory }: RoastRequestsClientProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRequest, setEditingRequest] = useState<RoastRequest | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    coffeeInventoryId: "",
    quantityG: "",
    priority: "normal" as "low" | "normal" | "high" | "urgent",
    dueDate: "",
    notes: "",
  });

  const resetForm = () => {
    setFormData({
      coffeeInventoryId: "",
      quantityG: "",
      priority: "normal",
      dueDate: "",
      notes: "",
    });
    setEditingRequest(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const openEditDialog = (request: RoastRequest) => {
    setEditingRequest(request);
    setFormData({
      coffeeInventoryId: request.coffee_inventory_id,
      quantityG: request.requested_quantity_g.toString(),
      priority: request.priority,
      dueDate: request.due_date || "",
      notes: request.notes || "",
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.coffeeInventoryId || !formData.quantityG) return;
    setIsSubmitting(true);

    try {
      const quantityG = parseFloat(formData.quantityG);

      if (editingRequest) {
        const result = await updateRoastRequest(editingRequest.id, {
          requestedQuantityG: quantityG,
          priority: formData.priority,
          dueDate: formData.dueDate || undefined,
          notes: formData.notes || undefined,
        });
        if (result.error) {
          alert(result.error);
          return;
        }
      } else {
        const result = await createRoastRequest({
          coffeeInventoryId: formData.coffeeInventoryId,
          requestedQuantityG: quantityG,
          priority: formData.priority,
          dueDate: formData.dueDate || undefined,
          notes: formData.notes || undefined,
        });
        if (result.error) {
          alert(result.error);
          return;
        }
      }

      setIsDialogOpen(false);
      resetForm();
      window.location.reload();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this roast request?")) return;
    
    const result = await deleteRoastRequest(id);
    if (result.error) {
      alert(result.error);
      return;
    }
    window.location.reload();
  };

  const handleStatusChange = async (id: string, status: "pending" | "in_progress" | "completed" | "cancelled") => {
    const result = await updateRoastRequest(id, { status });
    if (result.error) {
      alert(result.error);
      return;
    }
    window.location.reload();
  };

  // Sort by priority (urgent first) then by due date
  const sortedRequests = [...requests].sort((a, b) => {
    const priorityOrder = { urgent: 0, high: 1, normal: 2, low: 3 };
    if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }
    if (a.due_date && b.due_date) {
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
    }
    if (a.due_date) return -1;
    if (b.due_date) return 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const pendingRequests = sortedRequests.filter(r => r.status === "pending" || r.status === "in_progress");
  const completedRequests = sortedRequests.filter(r => r.status === "completed" || r.status === "cancelled");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Roast Requests</h2>
          <p className="text-sm text-muted-foreground">
            Track and manage roasting requests from orders
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="mr-2 h-4 w-4" />
          New Request
        </Button>
      </div>

      {/* Active Requests */}
      {pendingRequests.length > 0 && (
        <Card>
          <CardContent className="p-0">
            {/* Desktop Table */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Coffee</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[80px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingRequests.map((request) => {
                    const StatusIcon = statusConfig[request.status].icon;
                    const progressPercent = (request.fulfilled_quantity_g / request.requested_quantity_g) * 100;
                    const isOverdue = request.due_date && new Date(request.due_date) < new Date() && request.status !== "completed";
                    
                    return (
                      <TableRow key={request.id}>
                        <TableCell>
                          <div className="font-medium">
                            {request.green_coffee_inventory?.name || "Unknown"}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {request.green_coffee_inventory?.origin || ""}
                          </div>
                        </TableCell>
<TableCell>
                                          {request.requested_quantity_g.toLocaleString()} g
                                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-primary rounded-full transition-all"
                                style={{ width: `${Math.min(progressPercent, 100)}%` }}
                              />
                            </div>
<span className="text-sm text-muted-foreground">
                                              {request.fulfilled_quantity_g.toLocaleString()} / {request.requested_quantity_g.toLocaleString()} g
                                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={priorityConfig[request.priority].className}>
                            {priorityConfig[request.priority].label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {request.due_date ? (
                            <div className="flex items-center gap-1">
                              {isOverdue && <AlertTriangle className="h-4 w-4 text-red-500" />}
                              <span className={isOverdue ? "text-red-500" : ""}>
                                {new Date(request.due_date).toLocaleDateString()}
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={statusConfig[request.status].className}>
                            <StatusIcon className="mr-1 h-3 w-3" />
                            {statusConfig[request.status].label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEditDialog(request)}>
                                <Edit className="mr-2 h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleStatusChange(request.id, "completed")}>
                                <CheckCircle2 className="mr-2 h-4 w-4" />
                                Mark Complete
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleStatusChange(request.id, "cancelled")}>
                                <XCircle className="mr-2 h-4 w-4" />
                                Cancel
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleDelete(request.id)}
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
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden divide-y">
              {pendingRequests.map((request) => {
                const StatusIcon = statusConfig[request.status].icon;
                const progressPercent = (request.fulfilled_quantity_g / request.requested_quantity_g) * 100;
                const isOverdue = request.due_date && new Date(request.due_date) < new Date() && request.status !== "completed";

                return (
                  <div key={request.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-medium">
                          {request.green_coffee_inventory?.name || "Unknown"}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {request.green_coffee_inventory?.origin || ""}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={priorityConfig[request.priority].className}>
                          {priorityConfig[request.priority].label}
                        </Badge>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditDialog(request)}>
                              <Edit className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleStatusChange(request.id, "completed")}>
                              <CheckCircle2 className="mr-2 h-4 w-4" />
                              Mark Complete
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleStatusChange(request.id, "cancelled")}>
                              <XCircle className="mr-2 h-4 w-4" />
                              Cancel
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDelete(request.id)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Progress</span>
                        <span>{request.fulfilled_quantity_g.toLocaleString()} / {request.requested_quantity_g.toLocaleString()} g</span>
                      </div>
                      <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
                          style={{ width: `${Math.min(progressPercent, 100)}%` }}
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <Badge variant="outline" className={statusConfig[request.status].className}>
                        <StatusIcon className="mr-1 h-3 w-3" />
                        {statusConfig[request.status].label}
                      </Badge>
                      {request.due_date && (
                        <div className="flex items-center gap-1">
                          {isOverdue && <AlertTriangle className="h-4 w-4 text-red-500" />}
                          <span className={isOverdue ? "text-red-500" : "text-muted-foreground"}>
                            Due: {new Date(request.due_date).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {pendingRequests.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Coffee className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-medium">No active roast requests</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Create a roast request manually or from an order to get started.
            </p>
            <Button onClick={openCreateDialog} className="mt-4">
              <Plus className="mr-2 h-4 w-4" />
              New Request
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Completed Requests */}
      {completedRequests.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-muted-foreground">Completed & Cancelled</h3>
          <Card>
            <CardContent className="p-0">
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Coffee</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Completed</TableHead>
                      <TableHead className="w-[80px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {completedRequests.slice(0, 5).map((request) => {
                      const StatusIcon = statusConfig[request.status].icon;
                      return (
                        <TableRow key={request.id} className="opacity-75">
                          <TableCell>
                            <div className="font-medium">
                              {request.green_coffee_inventory?.name || "Unknown"}
                            </div>
                          </TableCell>
<TableCell>
                                            {request.requested_quantity_g.toLocaleString()} g
                                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={statusConfig[request.status].className}>
                              <StatusIcon className="mr-1 h-3 w-3" />
                              {statusConfig[request.status].label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {new Date(request.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => handleDelete(request.id)}
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
              <div className="md:hidden divide-y">
                {completedRequests.slice(0, 5).map((request) => {
                  const StatusIcon = statusConfig[request.status].icon;
                  return (
                    <div key={request.id} className="p-4 opacity-75">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">
                            {request.green_coffee_inventory?.name || "Unknown"}
                          </div>
<div className="text-sm text-muted-foreground">
                                            {request.requested_quantity_g.toLocaleString()} g
                                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={statusConfig[request.status].className}>
                            <StatusIcon className="mr-1 h-3 w-3" />
                            {statusConfig[request.status].label}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => handleDelete(request.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingRequest ? "Edit Roast Request" : "New Roast Request"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Coffee</Label>
              <Select
                value={formData.coffeeInventoryId}
                onValueChange={(value) => setFormData({ ...formData, coffeeInventoryId: value })}
                disabled={!!editingRequest}
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
              <Label>Quantity (grams)</Label>
              <Input
                type="number"
                step="1"
                value={formData.quantityG}
                onChange={(e) => setFormData({ ...formData, quantityG: e.target.value })}
                placeholder="Enter quantity in grams"
              />
            </div>

            <div className="space-y-2">
              <Label>Priority</Label>
              <Select
                value={formData.priority}
                onValueChange={(value: "low" | "normal" | "high" | "urgent") =>
                  setFormData({ ...formData, priority: value })
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
                value={formData.dueDate}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Add any notes..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !formData.coffeeInventoryId || !formData.quantityG}
            >
              {isSubmitting ? "Saving..." : editingRequest ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

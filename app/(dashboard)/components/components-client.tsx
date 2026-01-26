"use client";

import React from "react";

import { useState } from "react";
import { createComponent, updateComponent, deleteComponent } from "./actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus,
  Pencil,
  Trash2,
  Layers,
  Search,
  AlertCircle,
  Loader2,
} from "lucide-react";

interface Component {
  id: string;
  name: string;
  type: string;
  cost_per_unit: number;
  unit: string;
  notes: string | null;
  created_at: string;
}

interface ComponentsClientProps {
  initialComponents: Component[];
}

// Types must match the database CHECK constraint: ('ingredient', 'labor', 'packaging', 'other')
const COMPONENT_TYPES = [
  { value: "ingredient", label: "Ingredient" },
  { value: "labor", label: "Labor" },
  { value: "packaging", label: "Packaging" },
  { value: "other", label: "Other" },
];

const UNITS = ["unit", "oz", "lb", "g", "kg", "ml", "L", "each", "hour"];

const CATEGORIES = ["ingredient", "labor", "packaging", "other"];

export function ComponentsClient({ initialComponents }: ComponentsClientProps) {
  const [components, setComponents] = useState(initialComponents);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingComponent, setEditingComponent] = useState<Component | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    category: "",
    costPerUnit: "",
    unit: "",
    description: "",
  });

  const filteredComponents = components.filter(
    (component) =>
      component.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      component.type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group by category
  const groupedComponents = filteredComponents.reduce(
    (acc, component) => {
      if (!acc[component.type]) {
        acc[component.type] = [];
      }
      acc[component.type].push(component);
      return acc;
    },
    {} as Record<string, Component[]>
  );

  const openCreateDialog = () => {
    setEditingComponent(null);
    setFormData({
      name: "",
      category: "",
      costPerUnit: "",
      unit: "",
      description: "",
    });
    setIsDialogOpen(true);
  };

  const openEditDialog = (component: Component) => {
    setEditingComponent(component);
    setFormData({
      name: component.name,
      category: component.type,
      costPerUnit: component.cost_per_unit.toString(),
      unit: component.unit,
      description: component.notes || "",
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);

    const data = {
      name: formData.name,
      type: formData.category,
      costPerUnit: parseFloat(formData.costPerUnit),
      unit: formData.unit,
      notes: formData.description || undefined,
    };

    if (editingComponent) {
      const result = await updateComponent(editingComponent.id, data);
      if (result.error) {
        setMessage({ type: "error", text: result.error });
      } else {
        setComponents(
          components.map((c) =>
            c.id === editingComponent.id
              ? {
                  ...c,
                  name: data.name,
                  type: data.type,
                  cost_per_unit: data.costPerUnit,
                  unit: data.unit,
                  notes: data.notes || null,
                }
              : c
          )
        );
        setMessage({ type: "success", text: "Component updated successfully" });
        setIsDialogOpen(false);
      }
    } else {
      const result = await createComponent(data);
      if (result.error) {
        setMessage({ type: "error", text: result.error });
      } else if (result.component) {
        setComponents([...components, result.component]);
        setMessage({ type: "success", text: "Component created successfully" });
        setIsDialogOpen(false);
      }
    }

    setIsLoading(false);
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    setIsLoading(true);
    const result = await deleteComponent(deleteId);

    if (result.error) {
      setMessage({ type: "error", text: result.error });
    } else {
      setComponents(components.filter((c) => c.id !== deleteId));
      setMessage({ type: "success", text: "Component deleted successfully" });
    }

    setIsLoading(false);
    setDeleteId(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Components</h1>
          <p className="text-muted-foreground">
            Manage your cost components for COGS calculations
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="mr-2 h-4 w-4" />
          Add Component
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

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Component Library</CardTitle>
              <CardDescription>
                {components.length} component{components.length !== 1 ? "s" : ""}{" "}
                defined
              </CardDescription>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search components..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {Object.keys(groupedComponents).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Layers className="mb-4 h-12 w-12 text-muted-foreground" />
              <h3 className="text-lg font-medium">No components found</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {components.length === 0
                  ? "Create your first component to start tracking costs"
                  : "Try adjusting your search query"}
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedComponents).map(([type, items]) => (
                <div key={type}>
                  <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                    <Badge variant="outline" className="capitalize">{type}</Badge>
                    <span className="text-muted-foreground">
                      ({items.length})
                    </span>
                  </h3>
                  <div className="overflow-x-auto rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead className="text-right">
                            Cost per Unit
                          </TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.map((component) => (
                          <TableRow key={component.id}>
                            <TableCell className="font-medium">
                              {component.name}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {component.notes || "-"}
                            </TableCell>
                            <TableCell className="text-right">
                              ${component.cost_per_unit.toFixed(2)}/
                              {component.unit}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openEditDialog(component)}
                                >
                                  <Pencil className="h-4 w-4" />
                                  <span className="sr-only">Edit</span>
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setDeleteId(component.id)}
                                  className="text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                  <span className="sr-only">Delete</span>
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingComponent ? "Edit Component" : "Create Component"}
            </DialogTitle>
            <DialogDescription>
              {editingComponent
                ? "Update the component details below"
                : "Add a new cost component to your library"}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  placeholder="e.g., 12oz Kraft Bag"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="category">Type</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(value) =>
                      setFormData({ ...formData, category: value })
                    }
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {COMPONENT_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="unit">Unit</Label>
                  <Select
                    value={formData.unit}
                    onValueChange={(value) =>
                      setFormData({ ...formData, unit: value })
                    }
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select unit" />
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
              <div className="space-y-2">
                <Label htmlFor="costPerUnit">Cost per Unit ($)</Label>
                <Input
                  id="costPerUnit"
                  type="number"
                  step="0.0001"
                  min="0"
                  placeholder="0.00"
                  value={formData.costPerUnit}
                  onChange={(e) =>
                    setFormData({ ...formData, costPerUnit: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description (optional)</Label>
                <Textarea
                  id="description"
                  placeholder="Additional details about this component"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  rows={2}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                {editingComponent ? "Save Changes" : "Create Component"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Component</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this component? This action cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isLoading ? (
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

"use client";

import React, { useState } from "react";
import { createComponent, updateComponent, deleteComponent } from "./actions";
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

const COST_PER_UNIT_DECIMALS = 8;

interface ComponentsClientProps {
  initialComponents: Component[];
}

const COMPONENT_TYPES = [
  { value: "ingredient", label: "Ingredient" },
  { value: "labor", label: "Labor" },
  { value: "packaging", label: "Packaging" },
  { value: "other", label: "Other" },
];

const UNITS = ["unit", "oz", "lb", "g", "kg", "ml", "L", "each", "hour"];

// ── Mernin' primitives ───────────────────────────────────────────────────────

function Btn({
  children,
  variant = "primary",
  size = "md",
  disabled,
  onClick,
  type = "button",
  className = "",
}: {
  children: React.ReactNode;
  variant?: "primary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md";
  disabled?: boolean;
  onClick?: () => void;
  type?: "button" | "submit";
  className?: string;
}) {
  const base =
    "inline-flex items-center justify-center font-body font-extrabold uppercase tracking-widest transition-all duration-100 cursor-pointer disabled:opacity-50 disabled:pointer-events-none";
  const sizes = {
    sm: "text-[0.65rem] px-3 py-1.5 gap-1",
    md: "text-[0.7rem] px-4 py-2 gap-1.5",
  };
  const variants = {
    primary:
      "bg-tomato text-cream border-[2.5px] border-espresso rounded-full shadow-[3px_3px_0_#1C0F05] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_#1C0F05] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none",
    outline:
      "bg-transparent text-espresso border-[2.5px] border-espresso rounded-full shadow-[3px_3px_0_#1C0F05] hover:bg-espresso hover:text-cream active:translate-x-0.5 active:translate-y-0.5 active:shadow-none",
    ghost:
      "bg-transparent text-espresso border-[2px] border-transparent rounded-lg hover:bg-fog/40 active:bg-fog/60",
    danger:
      "bg-tomato text-cream border-[2.5px] border-espresso rounded-full shadow-[3px_3px_0_#1C0F05] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_#1C0F05] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none",
  };
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

function FieldLabel({
  children,
  htmlFor,
}: {
  children: React.ReactNode;
  htmlFor?: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="block text-[0.65rem] font-extrabold uppercase tracking-widest text-espresso font-body mb-1"
    >
      {children}
    </label>
  );
}

function MerninInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full bg-chalk border-[2.5px] border-espresso rounded-xl px-3 py-2 font-body text-sm text-espresso placeholder:text-espresso/30 shadow-[3px_3px_0_#1C0F05] focus:outline-none focus:-translate-x-0.5 focus:-translate-y-0.5 focus:shadow-[4px_4px_0_#E8442A] focus:border-tomato transition-all ${props.className ?? ""}`}
    />
  );
}

function MerninTextarea(
  props: React.TextareaHTMLAttributes<HTMLTextAreaElement>
) {
  return (
    <textarea
      {...props}
      className={`w-full bg-chalk border-[2.5px] border-espresso rounded-xl px-3 py-2 font-body text-sm text-espresso placeholder:text-espresso/30 shadow-[3px_3px_0_#1C0F05] focus:outline-none focus:-translate-x-0.5 focus:-translate-y-0.5 focus:shadow-[4px_4px_0_#E8442A] focus:border-tomato transition-all resize-none ${props.className ?? ""}`}
    />
  );
}

const TYPE_COLORS: Record<string, string> = {
  ingredient: "bg-sky/20 text-espresso border-sky",
  labor: "bg-honey/20 text-espresso border-honey",
  packaging: "bg-sun/30 text-espresso border-sun",
  other: "bg-fog/60 text-espresso border-fog",
};

function TypePill({ type }: { type: string }) {
  const colors = TYPE_COLORS[type] ?? "bg-fog/60 text-espresso border-fog";
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[0.6rem] font-extrabold uppercase tracking-widest border-[2px] font-body ${colors}`}
    >
      {type}
    </span>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export function ComponentsClient({ initialComponents }: ComponentsClientProps) {
  const [components, setComponents] = useState(initialComponents);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingComponent, setEditingComponent] = useState<Component | null>(
    null
  );
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    category: "",
    costPerUnit: "",
    unit: "",
    description: "",
  });

  const filteredComponents = components.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const groupedComponents = filteredComponents.reduce(
    (acc, c) => {
      if (!acc[c.type]) acc[c.type] = [];
      acc[c.type].push(c);
      return acc;
    },
    {} as Record<string, Component[]>
  );

  const openCreateDialog = () => {
    setEditingComponent(null);
    setFormData({ name: "", category: "", costPerUnit: "", unit: "", description: "" });
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
              ? { ...c, name: data.name, type: data.type, cost_per_unit: data.costPerUnit, unit: data.unit, notes: data.notes || null }
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
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-[28px] md:text-[36px] font-extrabold uppercase tracking-tight leading-none text-espresso">
            Components
          </h1>
          <p className="text-[13px] text-espresso/60 font-body mt-1">
            {components.length} component{components.length !== 1 ? "s" : ""} defined
          </p>
        </div>
        <Btn onClick={openCreateDialog} size="sm">
          <Plus className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Add Component</span>
          <span className="sm:hidden">Add</span>
        </Btn>
      </div>

      {/* Message */}
      {message && (
        <div
          className={`flex items-center gap-2 rounded-xl border-[2.5px] p-3 text-sm font-body font-bold ${
            message.type === "error"
              ? "bg-tomato/10 border-tomato text-tomato"
              : "bg-matcha/10 border-matcha text-matcha"
          }`}
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          {message.text}
        </div>
      )}

      {/* Component Library panel */}
      <div className="bg-chalk border-[3px] border-espresso rounded-[16px] shadow-flat-md overflow-hidden">
        {/* Panel header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-5 py-4 border-b-2 border-espresso bg-cream">
          <h2 className="font-body font-extrabold text-sm uppercase tracking-widest text-espresso">
            Component Library
          </h2>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-espresso/40 pointer-events-none" />
            <MerninInput
              placeholder="Search components..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Content */}
        <div className="p-5">
          {Object.keys(groupedComponents).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-full bg-fog/40 border-[3px] border-espresso flex items-center justify-center mb-4">
                <Layers className="h-7 w-7 text-espresso/50" />
              </div>
              <p className="font-body font-extrabold text-sm uppercase tracking-widest text-espresso">
                Nothing here yet
              </p>
              <p className="mt-1 text-xs text-espresso/50 font-body">
                {components.length === 0
                  ? "Add your first component to start tracking costs"
                  : "Try adjusting your search"}
              </p>
            </div>
          ) : (
            <div className="space-y-8">
              {Object.entries(groupedComponents).map(([type, items]) => (
                <div key={type}>
                  {/* Group header */}
                  <div className="flex items-center gap-2 mb-3">
                    <TypePill type={type} />
                    <span className="text-xs text-espresso/50 font-body font-bold">
                      {items.length}
                    </span>
                  </div>

                  {/* Mobile cards */}
                  <div className="space-y-2 md:hidden">
                    {items.map((component) => (
                      <div
                        key={component.id}
                        className="bg-cream border-[2.5px] border-espresso rounded-[16px] shadow-[3px_3px_0_#1C0F05] p-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="font-body font-extrabold text-sm text-espresso">
                              {component.name}
                            </p>
                            {component.notes && (
                              <p className="mt-0.5 text-xs text-espresso/50 font-body line-clamp-2">
                                {component.notes}
                              </p>
                            )}
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            <Btn
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditDialog(component)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Btn>
                            <Btn
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeleteId(component.id)}
                              className="text-tomato hover:text-tomato"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Btn>
                          </div>
                        </div>
                        <p className="mt-2 text-sm font-extrabold font-body text-espresso">
                          ${component.cost_per_unit.toFixed(COST_PER_UNIT_DECIMALS)}/{component.unit}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Desktop table */}
                  <div className="hidden md:block overflow-x-auto">
                    <div className="min-w-[560px]">
                      {/* Table header */}
                      <div className="grid grid-cols-[minmax(160px,1fr)_minmax(200px,2fr)_160px_80px] gap-x-4 px-4 py-2 border-b-[2px] border-espresso">
                        {["Name", "Description", "Cost / Unit", ""].map((h) => (
                          <span
                            key={h}
                            className={`text-[0.6rem] font-extrabold uppercase tracking-widest text-espresso/60 font-body ${h === "Cost / Unit" ? "text-right" : h === "" ? "text-right" : ""}`}
                          >
                            {h}
                          </span>
                        ))}
                      </div>
                      {/* Table rows */}
                      {items.map((component, i) => (
                        <div
                          key={component.id}
                          className={`grid grid-cols-[minmax(160px,1fr)_minmax(200px,2fr)_160px_80px] gap-x-4 px-4 py-3 items-center ${i < items.length - 1 ? "border-b-[1.5px] border-dashed border-fog" : ""} hover:bg-cream/60 transition-colors`}
                        >
                          <span className="font-body font-extrabold text-sm text-espresso truncate">
                            {component.name}
                          </span>
                          <span className="font-body text-sm text-espresso/60 truncate">
                            {component.notes || "—"}
                          </span>
                          <span className="font-body font-extrabold text-sm text-espresso text-right tabular-nums">
                            ${component.cost_per_unit.toFixed(COST_PER_UNIT_DECIMALS)}/{component.unit}
                          </span>
                          <div className="flex items-center justify-end gap-1">
                            <Btn
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditDialog(component)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Btn>
                            <Btn
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeleteId(component.id)}
                              className="text-tomato hover:text-tomato"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Btn>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md p-0 gap-0 border-[3px] border-espresso rounded-[16px] overflow-hidden bg-chalk shadow-[8px_8px_0_#1C0F05]">
          <div className="bg-cream border-b-[3px] border-espresso px-6 py-4">
            <DialogHeader>
              <DialogTitle className="font-body font-extrabold uppercase tracking-widest text-espresso text-sm">
                {editingComponent ? "Edit Component" : "New Component"}
              </DialogTitle>
            </DialogHeader>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="px-6 py-5 space-y-4">
              <div>
                <FieldLabel htmlFor="name">Name</FieldLabel>
                <MerninInput
                  id="name"
                  placeholder="e.g., 12oz Kraft Bag"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <FieldLabel htmlFor="category">Type</FieldLabel>
                  <Select
                    value={formData.category}
                    onValueChange={(v) => setFormData({ ...formData, category: v })}
                    required
                  >
                    <SelectTrigger className="border-[2.5px] border-espresso rounded-xl bg-chalk shadow-[3px_3px_0_#1C0F05] font-body text-sm">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {COMPONENT_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <FieldLabel htmlFor="unit">Unit</FieldLabel>
                  <Select
                    value={formData.unit}
                    onValueChange={(v) => setFormData({ ...formData, unit: v })}
                    required
                  >
                    <SelectTrigger className="border-[2.5px] border-espresso rounded-xl bg-chalk shadow-[3px_3px_0_#1C0F05] font-body text-sm">
                      <SelectValue placeholder="Select unit" />
                    </SelectTrigger>
                    <SelectContent>
                      {UNITS.map((u) => (
                        <SelectItem key={u} value={u}>
                          {u}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <FieldLabel htmlFor="costPerUnit">Cost per Unit ($)</FieldLabel>
                <MerninInput
                  id="costPerUnit"
                  type="number"
                  step="0.00000001"
                  min="0"
                  placeholder="0.00"
                  value={formData.costPerUnit}
                  onChange={(e) => setFormData({ ...formData, costPerUnit: e.target.value })}
                  required
                />
              </div>
              <div>
                <FieldLabel htmlFor="description">Description (optional)</FieldLabel>
                <MerninTextarea
                  id="description"
                  placeholder="Additional details about this component"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                />
              </div>
            </div>
            <div className="bg-cream border-t-[3px] border-espresso px-6 py-4 flex justify-end gap-2">
              <Btn
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                disabled={isLoading}
              >
                Cancel
              </Btn>
              <Btn type="submit" disabled={isLoading}>
                {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                {editingComponent ? "Save Changes" : "Create"}
              </Btn>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="max-w-sm p-0 gap-0 border-[3px] border-espresso rounded-[16px] overflow-hidden bg-chalk shadow-[8px_8px_0_#1C0F05]">
          <div className="bg-cream border-b-[3px] border-espresso px-6 py-4">
            <AlertDialogHeader>
              <AlertDialogTitle className="font-body font-extrabold uppercase tracking-widest text-espresso text-sm">
                Delete Component
              </AlertDialogTitle>
              <AlertDialogDescription className="font-body text-sm text-espresso/60 mt-1">
                This can&apos;t be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
          </div>
          <AlertDialogFooter className="px-6 py-4 flex justify-end gap-2">
            <AlertDialogCancel
              disabled={isLoading}
              className="inline-flex items-center justify-center font-body font-extrabold uppercase tracking-widest text-[0.7rem] px-4 py-2 bg-transparent text-espresso border-[2.5px] border-espresso rounded-full shadow-[3px_3px_0_#1C0F05] hover:bg-espresso hover:text-cream transition-all cursor-pointer"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isLoading}
              className="inline-flex items-center justify-center gap-1.5 font-body font-extrabold uppercase tracking-widest text-[0.7rem] px-4 py-2 bg-tomato text-cream border-[2.5px] border-espresso rounded-full shadow-[3px_3px_0_#1C0F05] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_#1C0F05] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer"
            >
              {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

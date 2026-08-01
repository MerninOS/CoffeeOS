"use client";

/**
 * /components — state, handlers and composition only.
 *
 * CoffeeOS#73 Stage A reduced this from 594 lines by moving the primitives, the
 * grouped table and the two dialogs into ./components/. Nothing here changed
 * behaviour and no class string moved: the pre-existing baselines are the proof.
 * Stage B replaces the loud markup that remains below.
 */

import React, { useState } from "react";
import { createComponent, updateComponent, deleteComponent } from "./actions";
import { Plus, Search, AlertCircle } from "lucide-react";
import { Btn, MerninInput } from "./components/LoudPrimitives";
import { ComponentsTable } from "./components/ComponentsTable";
import {
  ComponentFormDialog,
  DeleteComponentDialog,
} from "./components/ComponentDialogs";
import type { Component, ComponentFormData } from "./components/types";

interface ComponentsClientProps {
  initialComponents: Component[];
}

const EMPTY_FORM: ComponentFormData = {
  name: "",
  category: "",
  costPerUnit: "",
  unit: "",
  description: "",
};

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

  const [formData, setFormData] = useState<ComponentFormData>(EMPTY_FORM);

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
    setFormData(EMPTY_FORM);
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
        <Btn onClick={openCreateDialog} size="sm" testId="add-component">
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
              data-testid="component-search"
              placeholder="Search components..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Content */}
        <div className="p-5">
          <ComponentsTable
            groupedComponents={groupedComponents}
            totalCount={components.length}
            onEdit={openEditDialog}
            onDelete={setDeleteId}
          />
        </div>
      </div>

      <ComponentFormDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        editingComponent={editingComponent}
        formData={formData}
        setFormData={setFormData}
        isLoading={isLoading}
        onSubmit={handleSubmit}
      />

      <DeleteComponentDialog
        open={!!deleteId}
        onOpenChange={() => setDeleteId(null)}
        isLoading={isLoading}
        onConfirm={handleDelete}
      />
    </div>
  );
}

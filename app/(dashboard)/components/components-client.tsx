"use client";

/**
 * /components on the instrument design system (CoffeeOS#73 Stage B).
 *
 * This screen is the input side of every margin figure in CoffeeOS: a
 * component's cost_per_unit multiplies through product_components and
 * product_variant_components into product cost, and through order_components
 * into order margin. It is visited rarely — a setup screen — which is exactly
 * why it leads with the count of components nobody has priced rather than with
 * the count of components.
 */

import React, { useState } from "react";
import { Plus, Search, Package } from "lucide-react";
import { Button, EmptyState, InlineBanner, Input } from "@merninos/ui/instrument";
import { isUncosted } from "@/lib/components/format";
import { mono, sans } from "@/lib/instrument/tokens";
import {
  createComponent,
  updateComponent,
  deleteComponent,
  getComponentUsage,
  type ComponentUsage,
} from "./actions";
import { Worksheet } from "./components/Worksheet";
import { UncostedHero } from "./components/UncostedHero";
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

const TYPE_ORDER = ["ingredient", "labor", "packaging", "other"];

const PAGE_TITLE: React.CSSProperties = {
  fontFamily: "var(--font-display)",
  fontVariationSettings: "var(--display-settings)",
  fontWeight: "var(--display-weight)" as unknown as number,
  letterSpacing: "var(--display-tracking)",
  fontSize: "var(--fs-display)",
  lineHeight: 1,
  color: "var(--ink)",
  margin: 0,
};

export function ComponentsClient({ initialComponents }: ComponentsClientProps) {
  const [components, setComponents] = useState(initialComponents);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingComponent, setEditingComponent] = useState<Component | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  /**
   * Fetched when the confirm OPENS, not on page load — the list does not need
   * it, and it is three queries per component. `null` means "still checking",
   * which the dialog renders as such rather than as "nothing uses this".
   */
  const [deleteUsage, setDeleteUsage] = useState<ComponentUsage | null>(null);
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

  const uncosted = components.filter(isUncosted).length;

  /**
   * The strip is the type census — what TypePill's four coloured counts used to
   * say, minus the decoration. Deliberately NOT a median or average cost: these
   * figures are $/lb, $/oz, $/hour and $/each, so a single statistic across them
   * is a number with no referent.
   */
  const census = TYPE_ORDER.map((type) => ({
    label: type,
    value: String(components.filter((c) => c.type === type).length),
  })).filter((s) => s.value !== "0");

  const openCreateDialog = () => {
    setEditingComponent(null);
    setFormData(EMPTY_FORM);
    setIsDialogOpen(true);
  };

  const openDeleteDialog = async (id: string) => {
    setDeleteId(id);
    setDeleteUsage(null);
    const { usage } = await getComponentUsage(id);
    // Ignore a result that arrived after the dialog was dismissed or retargeted.
    setDeleteId((current) => {
      if (current === id && usage) setDeleteUsage(usage);
      return current;
    });
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
        setMessage({ type: "success", text: "Component updated" });
        setIsDialogOpen(false);
      }
    } else {
      const result = await createComponent(data);
      if (result.error) {
        setMessage({ type: "error", text: result.error });
      } else if (result.component) {
        setComponents([...components, result.component]);
        setMessage({ type: "success", text: "Component added" });
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
      setMessage({ type: "success", text: "Component deleted" });
    }
    setIsLoading(false);
    setDeleteId(null);
    setDeleteUsage(null);
  };

  return (
    <div
      style={{
        maxWidth: "var(--content-max)",
        margin: "0 auto",
        padding: "var(--space-6)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--gap-section)",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "var(--space-4)",
          flexWrap: "wrap",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <h1 style={PAGE_TITLE}>Components</h1>
          <p
            style={{
              ...sans,
              color: "var(--ink-muted)",
              margin: "8px 0 0",
              maxWidth: 620,
            }}
          >
            The atoms of cost. Every figure here multiplies through product recipes
            into order margin.
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          data-testid="add-component"
          onClick={openCreateDialog}
          iconLeft={<Plus style={{ width: 15, height: 15 }} strokeWidth={1.5} />}
        >
          Add component
        </Button>
      </div>

      {components.length > 0 && (
        <UncostedHero uncosted={uncosted} total={components.length} census={census} />
      )}

      {message && (
        <InlineBanner
          tone={message.type === "error" ? "danger" : "success"}
          title={message.text}
        />
      )}

      {uncosted > 0 && (
        <InlineBanner
          tone="danger"
          title={`${uncosted} ${uncosted === 1 ? "component has" : "components have"} no cost`}
        >
          They read <strong>not set</strong>, never <strong>$0.00</strong> — a missing
          figure is a claim about the data, not about the component. Until each one is
          priced, every product built on it understates its cost and overstates its
          margin.
        </InlineBanner>
      )}

      {/* Search — still the only filter, unchanged from before the conversion. */}
      {components.length > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-3)",
            flexWrap: "wrap",
          }}
        >
          <div style={{ flex: "0 1 320px", minWidth: 220 }}>
            <Input
              data-testid="component-search"
              aria-label="Search components"
              placeholder="Search components"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leading={<Search style={{ width: 15, height: 15 }} strokeWidth={1.5} />}
            />
          </div>
          {searchQuery && (
            <span
              style={{
                ...sans,
                fontSize: "var(--fs-caption)",
                color: "var(--ink-muted)",
              }}
            >
              {filteredComponents.length} of {components.length} match “{searchQuery}”
            </span>
          )}
        </div>
      )}

      {components.length === 0 ? (
        <div
          style={{
            border: "1px solid var(--hairline)",
            borderRadius: "var(--r-md)",
            background: "var(--surface)",
          }}
        >
          <EmptyState
            icon={<Package style={{ width: 22, height: 22 }} strokeWidth={1.5} />}
            title="No components yet"
            description="Add the things your products are made of — green coffee, bags, labor — and what each one costs per unit."
            action={
              <Button
                variant="primary"
                size="sm"
                onClick={openCreateDialog}
                iconLeft={<Plus style={{ width: 15, height: 15 }} strokeWidth={1.5} />}
              >
                Add component
              </Button>
            }
          />
        </div>
      ) : filteredComponents.length === 0 ? (
        <div
          style={{
            border: "1px solid var(--hairline)",
            borderRadius: "var(--r-md)",
            background: "var(--surface)",
          }}
        >
          <EmptyState
            compact
            icon={<Search style={{ width: 22, height: 22 }} strokeWidth={1.5} />}
            title="Nothing matches that"
            description={`No component name or type contains “${searchQuery}”.`}
          />
        </div>
      ) : (
        <Worksheet
          components={filteredComponents}
          onEdit={openEditDialog}
          onDelete={openDeleteDialog}
        />
      )}

      <p
        style={{
          ...mono,
          fontSize: "var(--fs-caption)",
          color: "var(--ink-muted)",
          margin: 0,
        }}
      >
        Four decimals, extended only when four would round a real cost to zero.
      </p>

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
        onOpenChange={() => {
          setDeleteId(null);
          setDeleteUsage(null);
        }}
        isLoading={isLoading}
        onConfirm={handleDelete}
        usage={deleteUsage}
      />
    </div>
  );
}

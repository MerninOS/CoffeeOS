"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Package } from "lucide-react";
import { EmptyState, Input } from "@merninos/ui/instrument";
import { sans } from "@/lib/instrument/tokens";
import { deleteBatch, createComponentFromBatch, addToExistingComponent } from "../actions";
import type { Batch, ExistingComponent } from "../components/batches/types";
import { getBatchCostPerGram, COST_PER_UNIT_DECIMALS } from "../components/batches/costing";
import { Btn } from "../components/batches/primitives";
import { BatchesTable } from "../components/batches/BatchesTable";
import { BatchCard } from "../components/batches/BatchCard";
import { ComponentDialog } from "../components/batches/ComponentDialog";
import { DeleteDialog } from "../components/batches/DeleteDialog";

interface BatchesClientProps {
  initialBatches: Batch[];
  existingComponents: ExistingComponent[];
}

export function BatchesClient({ initialBatches, existingComponents }: BatchesClientProps) {
  const router = useRouter();
  const [batches, setBatches] = useState(initialBatches);
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [createComponentBatch, setCreateComponentBatch] = useState<Batch | null>(null);
  const [componentMode, setComponentMode] = useState<"new" | "existing">("new");
  const [selectedComponentId, setSelectedComponentId] = useState<string>("");
  const [componentFormData, setComponentFormData] = useState({
    name: "",
    costPerUnit: "",
    unit: "g",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filteredBatches = batches.filter((batch) => {
    const q = searchQuery.toLowerCase();
    return batch.coffee_name?.toLowerCase().includes(q) || batch.lot_code?.toLowerCase().includes(q);
  });

  const handleDelete = async () => {
    if (!deleteId) return;
    const result = await deleteBatch(deleteId);
    if (result.error) { alert(result.error); } else {
      setBatches(batches.filter((b) => b.id !== deleteId));
    }
    setDeleteId(null);
  };

  const openCreateComponent = (batch: Batch) => {
    setCreateComponentBatch(batch);
    const costPerG = getBatchCostPerGram(batch, batches);
    setComponentFormData({
      name: `Roasted ${batch.coffee_name}`,
      costPerUnit: costPerG.toFixed(COST_PER_UNIT_DECIMALS),
      unit: "g",
    });
    setComponentMode("new");
    setSelectedComponentId("");
  };

  const handleCreateComponent = async () => {
    if (!createComponentBatch) return;
    setIsSubmitting(true);

    if (componentMode === "existing" && selectedComponentId) {
      const result = await addToExistingComponent(createComponentBatch.id, selectedComponentId);
      setIsSubmitting(false);
      if (result.error) { alert(result.error); return; }
      if (result.component) {
        const selectedComp = existingComponents.find((c) => c.id === selectedComponentId);
        setBatches(batches.map((b) =>
          b.id === createComponentBatch.id
            ? { ...b, component_id: result.component.id, components: { id: result.component.id, name: result.component.name } }
            : b
        ));
        alert(
          `Added to "${selectedComp?.name}". Cost updated from $${result.previousCost?.toFixed(COST_PER_UNIT_DECIMALS)} to $${result.newAveragedCost?.toFixed(COST_PER_UNIT_DECIMALS)} per gram.`
        );
        setCreateComponentBatch(null);
        setComponentFormData({ name: "", costPerUnit: "", unit: "g" });
        setSelectedComponentId("");
      }
    } else {
      const result = await createComponentFromBatch(createComponentBatch.id, {
        name: componentFormData.name,
        costPerUnit: parseFloat(componentFormData.costPerUnit),
        unit: componentFormData.unit,
      });
      setIsSubmitting(false);
      if (result.error) { alert(result.error); return; }
      if (result.component) {
        setBatches(batches.map((b) =>
          b.id === createComponentBatch.id
            ? { ...b, component_id: result.component.id, components: { id: result.component.id, name: result.component.name } }
            : b
        ));
        setCreateComponentBatch(null);
        setComponentFormData({ name: "", costPerUnit: "", unit: "g" });
      }
    }
  };

  return (
    <div className="p-6" style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      <div>
        <h2 style={{ fontFamily: "var(--font-sans)", fontSize: "var(--fs-title-sm)", fontWeight: "var(--fw-semibold)" as unknown as number, color: "var(--ink)" }}>
          All Batches
        </h2>
        <p style={{ ...sans, fontSize: "var(--fs-caption)", color: "var(--ink-muted)", marginTop: 2 }}>
          View all roasting batches across sessions · weights in lb
        </p>
      </div>

      {/* Search */}
      <div className="relative w-full md:max-w-sm">
        <Search
          size={14}
          style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--ink-subtle)", pointerEvents: "none" }}
        />
        <Input
          data-testid="batches-search"
          type="text"
          placeholder="Search by coffee name or lot code..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ paddingLeft: 32 }}
        />
      </div>

      {batches.length === 0 ? (
        <EmptyState
          icon={<Package size={28} strokeWidth={1.5} />}
          title="No Batches Yet"
          description="Create a roasting session and add batches to see them here"
          action={<Btn onClick={() => router.push("/roasting")}>Go to Sessions</Btn>}
        />
      ) : (
        <div style={{ border: "1px solid var(--hairline)", borderRadius: "var(--r-md)", overflow: "hidden", background: "var(--surface)" }}>
          {/* Mobile card layout */}
          <BatchCard
            batches={filteredBatches}
            onCreateComponent={openCreateComponent}
            onDelete={setDeleteId}
          />

          {/* Desktop table */}
          <BatchesTable
            batches={filteredBatches}
            onCreateComponent={openCreateComponent}
            onDelete={setDeleteId}
          />
        </div>
      )}

      {/* Create Component Dialog */}
      <ComponentDialog
        createComponentBatch={createComponentBatch}
        existingComponents={existingComponents}
        componentMode={componentMode}
        setComponentMode={setComponentMode}
        selectedComponentId={selectedComponentId}
        setSelectedComponentId={setSelectedComponentId}
        componentFormData={componentFormData}
        setComponentFormData={setComponentFormData}
        isSubmitting={isSubmitting}
        onClose={() => setCreateComponentBatch(null)}
        onSubmit={handleCreateComponent}
      />

      {/* Delete Confirmation */}
      <DeleteDialog
        deleteId={deleteId}
        onOpenChange={() => setDeleteId(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}

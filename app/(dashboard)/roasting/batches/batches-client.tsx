"use client";

import { useState } from "react";
import { Search, Package } from "lucide-react";
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
    <div className="p-6 space-y-6">
      <div>
        <h2 className="font-extrabold text-[17px] uppercase tracking-[.04em] text-espresso">
          All Batches
        </h2>
        <p className="text-[12px] text-espresso/50 font-medium mt-0.5">
          View all roasting batches across sessions
        </p>
      </div>

      {/* Search */}
      <div className="relative w-full md:max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-espresso/40" />
        <input
          type="text"
          placeholder="Search by coffee name or lot code..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-3 py-2 rounded-[8px] border-[2.5px] border-espresso bg-cream text-[13px] font-medium text-espresso placeholder:text-espresso/30 shadow-[2px_2px_0_#1C0F05] focus:outline-none focus:shadow-[2px_2px_0_#E8442A] focus:border-tomato"
        />
      </div>

      {batches.length === 0 ? (
        <div className="bg-chalk border-[3px] border-espresso rounded-[16px] shadow-flat-md flex flex-col items-center justify-center py-14 text-center px-6">
          <Package size={36} strokeWidth={1.5} className="text-espresso/20 mb-3" />
          <h3 className="font-extrabold text-[15px] uppercase tracking-[.04em] text-espresso mb-1">
            No Batches Yet
          </h3>
          <p className="text-[12px] text-espresso/50 font-medium mb-4">
            Create a roasting session and add batches to see them here
          </p>
          <Btn href="/roasting">Go to Sessions</Btn>
        </div>
      ) : (
        <>
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
        </>
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

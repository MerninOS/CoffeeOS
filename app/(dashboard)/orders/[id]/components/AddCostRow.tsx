"use client";

import { useState } from "react";
import { Button, Input } from "@merninos/ui/instrument";
import { Plus } from "lucide-react";

/**
 * Adding a custom cost, in place at the foot of its worksheet group.
 *
 * Replaces a Radix dialog. The edit now happens on the row whose number it
 * changes, which is the point of the worksheet: an operator assembling a cost
 * never leaves the ledger they are assembling.
 *
 * Collapsed by default so the group reads as data rather than a form. Opening is
 * local state — the parent owns the field values because it owns the submit
 * handler, and splitting that would put the validation somewhere the handler
 * cannot see it.
 */
export function AddCostRow({
  newCostDescription,
  setNewCostDescription,
  newCostAmount,
  setNewCostAmount,
  handleAddCustomCost,
  isPending,
}: {
  newCostDescription: string;
  setNewCostDescription: (v: string) => void;
  newCostAmount: string;
  setNewCostAmount: (v: string) => void;
  handleAddCustomCost: () => void;
  isPending: boolean;
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <div style={{ padding: "4px 8px" }}>
        <Button
          size="sm"
          variant="tertiary"
          iconLeft={<Plus size={14} strokeWidth={1.5} />}
          onClick={() => setOpen(true)}
        >
          Add cost
        </Button>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        alignItems: "center",
        padding: "8px 12px",
        background: "var(--surface-hover)",
        flexWrap: "wrap",
      }}
    >
      <div style={{ flex: "1 1 260px", maxWidth: 340 }}>
        <Input
          size="sm"
          placeholder="What is the charge for?"
          aria-label="Description"
          value={newCostDescription}
          onChange={(e) => setNewCostDescription(e.target.value)}
        />
      </div>
      <div style={{ width: 104 }}>
        <Input
          size="sm"
          mono
          placeholder="0.00"
          aria-label="Amount"
          value={newCostAmount}
          onChange={(e) => setNewCostAmount(e.target.value)}
        />
      </div>
      <Button
        size="sm"
        variant="primary"
        disabled={isPending}
        onClick={() => {
          handleAddCustomCost();
          setOpen(false);
        }}
      >
        Add cost
      </Button>
      <Button size="sm" variant="tertiary" onClick={() => setOpen(false)}>
        Cancel
      </Button>
    </div>
  );
}

"use client";

import { useState } from "react";
import { Button, Input, Select } from "@merninos/ui/instrument";
import { Plus } from "lucide-react";
import { money } from "../../components/tokens";
import type { Component } from "./types";

/**
 * Adding an order component, in place at the foot of its worksheet group.
 *
 * Replaces a Radix dialog, for the same reason as AddCostRow: the edit belongs
 * on the row whose number it changes.
 *
 * Uses Instrument's `Select`, which is a NATIVE `<select>`. That is fine here —
 * a short list of the owner's components, no search needed — but it is the
 * reason the capability test drives it with `selectOption()` rather than
 * clicking a listbox. Anything needing a searchable or clickable listbox keeps
 * Radix and gets retokenized instead.
 */
export function AddComponentRow({
  components,
  selectedComponentId,
  setSelectedComponentId,
  componentQuantity,
  setComponentQuantity,
  handleAddComponent,
  isPending,
}: {
  components: Component[];
  selectedComponentId: string;
  setSelectedComponentId: (v: string) => void;
  componentQuantity: string;
  setComponentQuantity: (v: string) => void;
  handleAddComponent: () => Promise<boolean>;
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
          disabled={isPending}
          onClick={() => setOpen(true)}
        >
          Add component
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
        <Select
          size="sm"
          aria-label="Component"
          value={selectedComponentId}
          onChange={(e) => setSelectedComponentId(e.target.value)}
        >
          <option value="">Select a component…</option>
          {components.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({money(c.cost_per_unit)}/unit)
            </option>
          ))}
        </Select>
      </div>
      <div style={{ width: 84 }}>
        <Input
          size="sm"
          mono
          aria-label="Quantity"
          value={componentQuantity}
          onChange={(e) => setComponentQuantity(e.target.value)}
        />
      </div>
      <Button
        size="sm"
        variant="primary"
        disabled={isPending}
        /* Close ONLY on success. Closing regardless discards what the
           operator typed and hides the failure — the dialogs this replaced
           closed inside `if (result.success)`. */
        onClick={async () => {
          if (await handleAddComponent()) setOpen(false);
        }}
      >
        Add component
      </Button>
      <Button size="sm" variant="tertiary" onClick={() => setOpen(false)}>
        Cancel
      </Button>
    </div>
  );
}

"use client";

import { useState } from "react";
import { Button, IconButton, Input, Select } from "@merninos/ui/instrument";
import { Plus, X } from "lucide-react";
import { mono, overline, sans } from "../../components/tokens";
import type { AssignedCoffee, CoffeeStock } from "./types";

/**
 * Roasted coffee pulled for this order.
 *
 * Deliberately OUTSIDE the worksheet and visually unlike it. This is a
 * FULFILLMENT record — it draws down roasted stock — and contributes nothing to
 * COGS. The old page wore the same bordered panel chrome as the three cost
 * panels, so it read as a fourth cost, and the copy now says outright that it
 * is not. A capability test asserts the same thing in behaviour: assigning
 * coffee must not move COGS.
 *
 * The empty case is one quiet line, NOT `EmptyState`: that component is sized
 * for a page whose whole job is missing, and here it out-shouted the worksheet
 * above it — which is the actual subject of the page. Found in the design mock.
 *
 * `coffee-assignment` is a test contract: a row and the "total pulled" line
 * carry the same gram figure, so text alone cannot address one of them.
 */
export function CoffeeBlock({
  coffeeStock,
  selectedCoffeeId,
  setSelectedCoffeeId,
  coffeeAmount,
  setCoffeeAmount,
  handleAssignCoffee,
  isPending,
  assignedCoffeeList,
  totalAssignedCoffeeG,
  gramsToLbs,
  setDeleteAssignmentId,
}: {
  coffeeStock: CoffeeStock[];
  selectedCoffeeId: string;
  setSelectedCoffeeId: (v: string) => void;
  coffeeAmount: string;
  setCoffeeAmount: (v: string) => void;
  handleAssignCoffee: () => Promise<boolean>;
  isPending: boolean;
  assignedCoffeeList: AssignedCoffee[];
  totalAssignedCoffeeG: number;
  gramsToLbs: (g: number) => string;
  setDeleteAssignmentId: (id: string | null) => void;
}) {
  const [adding, setAdding] = useState(false);
  const empty = assignedCoffeeList.length === 0;
  const ROW = "minmax(0,1fr) 120px 100px 30px";

  return (
    <div style={{ marginTop: 32 }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
          paddingBottom: 8,
          borderBottom: "1px solid var(--hairline-strong)",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
          <span style={{ ...overline, color: "var(--ink)" }}>Roasted coffee pulled</span>
          <span style={{ ...sans, fontSize: "var(--fs-caption)", color: "var(--ink-subtle)" }}>
            Draws down roasted stock. Not part of COGS.
          </span>
        </div>
        {!adding && (
          <Button
            size="sm"
            variant="secondary"
            iconLeft={<Plus size={14} strokeWidth={1.5} />}
            disabled={isPending}
          onClick={() => setAdding(true)}
          >
            Pull coffee
          </Button>
        )}
      </div>

      {assignedCoffeeList.map((a) => (
        <div
          key={a.id}
          data-testid="coffee-assignment"
          style={{
            display: "grid",
            gridTemplateColumns: ROW,
            gap: 12,
            alignItems: "center",
            padding: "9px 0",
            borderBottom: "1px solid var(--hairline)",
          }}
        >
          <span style={{ ...sans, color: "var(--ink)" }}>{a.coffeeName}</span>
          <span style={{ ...mono, textAlign: "right", color: "var(--ink)" }}>
            {a.amountG.toLocaleString()} g
          </span>
          <span
            style={{
              ...mono,
              textAlign: "right",
              fontSize: "var(--fs-caption)",
              color: "var(--ink-subtle)",
            }}
          >
            {gramsToLbs(a.amountG)} lb
          </span>
          <IconButton
            size="sm"
            icon={<X size={14} strokeWidth={1.5} />}
            aria-label={`Return ${a.coffeeName} to stock`}
            onClick={() => setDeleteAssignmentId(a.id)}
          />
        </div>
      ))}

      {adding && (
        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            padding: "10px 0",
            borderBottom: "1px solid var(--hairline)",
            flexWrap: "wrap",
          }}
        >
          <div style={{ flex: "1 1 260px", maxWidth: 340 }}>
            <Select
              size="sm"
              aria-label="Roasted coffee"
              value={selectedCoffeeId}
              onChange={(e) => setSelectedCoffeeId(e.target.value)}
            >
              <option value="">Select a coffee…</option>
              {coffeeStock.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.roasted_stock_g.toLocaleString()} g available)
                </option>
              ))}
            </Select>
          </div>
          <div style={{ width: 120 }}>
            <Input
              size="sm"
              mono
              placeholder="grams"
              aria-label="Amount in grams"
              value={coffeeAmount}
              onChange={(e) => setCoffeeAmount(e.target.value)}
            />
          </div>
          <Button
            size="sm"
            variant="primary"
            disabled={isPending}
            onClick={() => {
              handleAssignCoffee();
              setAdding(false);
            }}
          >
            Pull coffee
          </Button>
          <Button size="sm" variant="tertiary" onClick={() => setAdding(false)}>
            Cancel
          </Button>
        </div>
      )}

      {empty && !adding && (
        <div style={{ ...sans, color: "var(--ink-subtle)", padding: "12px 0" }}>
          Nothing pulled yet. Assign roasted coffee when you pack this order.
        </div>
      )}

      {!empty && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: ROW,
            gap: 12,
            alignItems: "center",
            padding: "9px 0",
          }}
        >
          <span style={{ ...overline, color: "var(--ink-muted)" }}>Total pulled</span>
          <span style={{ ...mono, textAlign: "right", fontSize: "var(--fs-data)" }}>
            {totalAssignedCoffeeG.toLocaleString()} g
          </span>
          <span
            style={{
              ...mono,
              textAlign: "right",
              fontSize: "var(--fs-caption)",
              color: "var(--ink-subtle)",
            }}
          >
            {gramsToLbs(totalAssignedCoffeeG)} lb
          </span>
          <span />
        </div>
      )}
    </div>
  );
}

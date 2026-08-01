"use client";

/**
 * One worksheet for the whole component library.
 *
 * CoffeeOS#73 Stage B. Replaces ComponentsTable.tsx, which built a separate
 * `min-w-[560px]` grid per type group (so columns did not align across groups)
 * plus a duplicate `md:hidden` card list for mobile. Here every row of every
 * group lands on the same four tracks, and there is one rendering.
 *
 * Type was a colour — TypePill painted ingredient/labor/packaging/other in
 * sky/honey/sun/fog, which is chrome the roast ramp explicitly forbids and was
 * the first thing the eye landed on. It is now a ruled section band carrying its
 * count and, when it has any, its uncosted count. The only colour left on this
 * screen is --danger on a missing figure.
 */

import React from "react";
import { Pencil, Trash2 } from "lucide-react";
import { IconButton } from "@merninos/ui/instrument";
import { fmtCost, isUncosted, COST_NOT_SET } from "@/lib/components/format";
import { mono, overline, sans } from "@/lib/instrument/tokens";
import { GRID } from "./tokens";
import type { Component } from "./types";

const TYPE_ORDER = ["ingredient", "labor", "packaging", "other"];

const HEAD: React.CSSProperties = {
  ...overline,
  padding: "0 12px",
  height: 32,
  display: "flex",
  alignItems: "center",
  whiteSpace: "nowrap",
  minWidth: 0,
  background: "var(--surface-sunken)",
  borderBottom: "1px solid var(--hairline-strong)",
};

const CELL: React.CSSProperties = {
  padding: "0 12px",
  minHeight: 40,
  minWidth: 0,
  display: "flex",
  alignItems: "center",
  fontSize: "var(--fs-body)",
};

const RIGHT: React.CSSProperties = { justifyContent: "flex-end" };
const TRUNC: React.CSSProperties = {
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

function GroupRow({
  label,
  count,
  uncosted,
}: {
  label: string;
  count: number;
  uncosted: number;
}) {
  return (
    <div
      style={{
        gridColumn: "1 / -1",
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "0 12px",
        height: 30,
        background: "var(--surface-sunken)",
        borderTop: "1px solid var(--hairline-strong)",
        borderBottom: "1px solid var(--hairline)",
      }}
    >
      <span style={{ ...overline, color: "var(--ink-muted)" }}>{label}</span>
      <span style={{ ...mono, fontSize: "var(--fs-overline)", color: "var(--ink-subtle)" }}>
        {count}
      </span>
      {uncosted > 0 && (
        <span
          data-testid="group-uncosted"
          style={{ ...mono, fontSize: "var(--fs-overline)", color: "var(--danger)" }}
        >
          {uncosted} {COST_NOT_SET}
        </span>
      )}
    </div>
  );
}

/**
 * Two states. A missing figure is a claim about the DATA — nobody has priced
 * this — where "$0.00" would be a claim about the component, that it is free and
 * the margin above it is real. Same language /orders adopted in CoffeeOS#68.
 *
 * The state is read from the value via isUncosted, never from the formatted
 * string, so the two cannot collide again if the formatting rule changes.
 */
export function CostCell({ component }: { component: Component }) {
  if (isUncosted(component)) {
    return (
      <span
        data-testid="row-cost"
        style={{ ...mono, fontSize: "var(--fs-caption)", color: "var(--danger)" }}
      >
        {COST_NOT_SET}
      </span>
    );
  }
  return (
    <span
      data-testid="row-cost"
      style={{ display: "inline-flex", alignItems: "baseline", gap: 2 }}
    >
      <span style={mono}>{fmtCost(component.cost_per_unit)}</span>
      <span style={{ ...mono, fontSize: "var(--fs-overline)", color: "var(--ink-subtle)" }}>
        /{component.unit}
      </span>
    </span>
  );
}

/**
 * Row actions are revealed on hover, and equally on keyboard focus — an action
 * you can only reach with a mouse is not an action for everyone. `opacity` alone
 * would leave them focusable but invisible, which is worse than hidden.
 */
function Row({
  component,
  onEdit,
  onDelete,
}: {
  component: Component;
  onEdit: (component: Component) => void;
  onDelete: (id: string) => void;
}) {
  const [active, setActive] = React.useState(false);
  const reveal = {
    onMouseEnter: () => setActive(true),
    onMouseLeave: () => setActive(false),
    onFocus: () => setActive(true),
    onBlur: () => setActive(false),
  };

  const rule = { borderBottom: "1px solid var(--hairline)" };
  const bg = active ? "var(--surface-hover)" : "transparent";
  const cell = { ...CELL, ...rule, background: bg };

  return (
    /**
     * `subgrid` rather than `display: contents`: the row needs to be a real box
     * so the capability specs can select it (`display: contents` produces no
     * bounding box, so Playwright reports every row as not visible and
     * `[data-testid="component-row"]:visible` matches nothing). Subgrid keeps
     * the columns defined once on the parent, which is the whole point of the
     * conversion — every group measured against one ruler.
     */
    <div
      data-testid="component-row"
      style={{
        gridColumn: "1 / -1",
        display: "grid",
        gridTemplateColumns: "subgrid",
      }}
      {...reveal}
    >
      <div style={{ ...cell, ...sans }}>
        <span data-testid="row-name" style={TRUNC}>
          {component.name}
        </span>
      </div>
      <div style={{ ...cell, ...sans, color: "var(--ink-muted)" }}>
        {component.notes ? (
          <span style={TRUNC}>{component.notes}</span>
        ) : (
          <span style={{ ...mono, color: "var(--ink-subtle)" }}>—</span>
        )}
      </div>
      <div style={{ ...cell, ...RIGHT }}>
        <CostCell component={component} />
      </div>
      {/* The fade lives on an inner wrapper, NOT on the cell. `opacity` applies
          to the element's border too, so fading the cell itself broke each row's
          hairline under this column — a visible gap at the right edge of every
          unhovered row. */}
      <div style={{ ...cell, padding: "0 6px", justifyContent: "flex-end" }}>
        <div
          style={{
            display: "flex",
            gap: 2,
            opacity: active ? 1 : 0,
            transition: "opacity 140ms var(--ease)",
          }}
        >
        <IconButton
          size="sm"
          data-testid="row-edit"
          aria-label={`Edit ${component.name}`}
          onClick={() => onEdit(component)}
          icon={<Pencil style={{ width: 15, height: 15 }} strokeWidth={1.5} />}
        />
        <IconButton
          size="sm"
          data-testid="row-delete"
          aria-label={`Delete ${component.name}`}
          onClick={() => onDelete(component.id)}
          icon={<Trash2 style={{ width: 15, height: 15 }} strokeWidth={1.5} />}
        />
        </div>
      </div>
    </div>
  );
}

export function Worksheet({
  components,
  onEdit,
  onDelete,
}: {
  components: Component[];
  onEdit: (component: Component) => void;
  onDelete: (id: string) => void;
}) {
  const groups = TYPE_ORDER.map(
    (type) => [type, components.filter((c) => c.type === type)] as const
  ).filter(([, items]) => items.length > 0);

  return (
    <div
      style={{
        border: "1px solid var(--hairline)",
        borderRadius: "var(--r-md)",
        overflow: "hidden",
        background: "var(--surface)",
      }}
    >
      <div data-testid="worksheet" style={{ display: "grid", gridTemplateColumns: GRID }}>
        <div style={HEAD}>Name</div>
        <div style={HEAD}>Notes</div>
        <div style={{ ...HEAD, ...RIGHT }}>Cost / unit</div>
        <div style={HEAD} />

        {groups.map(([type, items]) => (
          <React.Fragment key={type}>
            <GroupRow
              label={type}
              count={items.length}
              uncosted={items.filter(isUncosted).length}
            />
            {items.map((component) => (
              <Row
                key={component.id}
                component={component}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

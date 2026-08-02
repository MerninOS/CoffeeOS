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

/**
 * Colour, border and type only — NO layout.
 *
 * Inline styles beat classes, so a `display: "flex"` here would override the
 * `.cw-headcell { display: none }` that drops the column headers when the
 * worksheet stacks. That exact mistake silently defeated the first attempt at
 * the /orders/[id] stacked layout. Layout lives in app/globals.css.
 */
const HEAD: React.CSSProperties = {
  ...overline,
  padding: "0 12px",
  height: 32,
  whiteSpace: "nowrap",
  background: "var(--surface-sunken)",
  borderBottom: "1px solid var(--hairline-strong)",
};

const CELL: React.CSSProperties = {
  padding: "0 12px",
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
 * The column header, repeated inline when the worksheet stacks and the real
 * headers are gone. A stacked column of bare numbers is not a table.
 */
function FigureLabel() {
  return (
    <span
      className="cw-figure-label"
      style={{ ...overline, color: "var(--ink-subtle)" }}
    >
      Cost / unit
    </span>
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
      <span style={{ display: "inline-flex", alignItems: "baseline", gap: 6 }}>
        <FigureLabel />
        <span
          data-testid="row-cost"
          style={{ ...mono, fontSize: "var(--fs-caption)", color: "var(--danger)" }}
        >
          {COST_NOT_SET}
        </span>
      </span>
    );
  }
  return (
    <span style={{ display: "inline-flex", alignItems: "baseline", gap: 6 }}>
      <FigureLabel />
    <span
      data-testid="row-cost"
      style={{ display: "inline-flex", alignItems: "baseline", gap: 2 }}
    >
      <span style={mono}>{fmtCost(component.cost_per_unit)}</span>
      <span style={{ ...mono, fontSize: "var(--fs-overline)", color: "var(--ink-subtle)" }}>
        /{component.unit}
      </span>
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
  onDelete: (id: string) => void | Promise<void>;
}) {
  const [active, setActive] = React.useState(false);
  const reveal = {
    onMouseEnter: () => setActive(true),
    onMouseLeave: () => setActive(false),
    onFocus: () => setActive(true),
    onBlur: () => setActive(false),
  };

  const bg = active ? "var(--surface-hover)" : "transparent";

  return (
    /**
     * One column stacked below 900px, `subgrid` above it (app/globals.css).
     *
     * Subgrid rather than `display: contents` at the wide end: the row must be a
     * real box so the capability specs can select it — `display: contents`
     * produces no bounding box, so Playwright reports every row as not visible
     * and `[data-testid="component-row"]:visible` matches nothing. Subgrid also
     * keeps the columns defined once on the parent, which is the point of the
     * conversion: every group measured against one ruler.
     *
     * The rule sits on the ROW, not on each cell — stacked cells would otherwise
     * each draw their own line.
     */
    <div
      data-testid="component-row"
      className="cw-row"
      style={{ background: bg, borderBottom: "1px solid var(--hairline)" }}
      {...reveal}
    >
      <div className="cw-cell" style={{ ...CELL, ...sans }}>
        <span data-testid="row-name" style={TRUNC}>
          {component.name}
        </span>
      </div>
      <div className="cw-cell" style={{ ...CELL, ...sans, color: "var(--ink-muted)" }}>
        {component.notes ? (
          <span style={TRUNC}>{component.notes}</span>
        ) : (
          <span style={{ ...mono, color: "var(--ink-subtle)" }}>—</span>
        )}
      </div>
      <div className="cw-cell" style={{ ...CELL, ...RIGHT }}>
        <CostCell component={component} />
      </div>
      {/* The fade lives on an inner wrapper, NOT on the cell. `opacity` applies
          to the element's border too, so fading the cell itself broke each row's
          hairline under this column — a visible gap at the right edge of every
          unhovered row. */}
      <div className="cw-cell cw-actions" style={{ ...CELL, padding: "0 6px" }}>
        {/* Always visible when stacked — there is no hover on a touch device, so
            a hover-only control is simply unreachable there. The old mobile card
            list showed both buttons outright; this restores that. The fade is a
            wide-viewport affordance and lives in CSS, because an inline opacity
            would beat the media query. */}
        <div className="cw-rowactions" data-active={active ? "true" : "false"}>
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
  onDelete: (id: string) => void | Promise<void>;
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
      <div
        data-testid="worksheet"
        className="cw-grid"
        style={{ ["--cw-grid" as string]: GRID } as React.CSSProperties}
      >
        <div className="cw-headcell" style={HEAD}>Name</div>
        <div className="cw-headcell" style={HEAD}>Notes</div>
        <div className="cw-headcell" style={{ ...HEAD, ...RIGHT }}>Cost / unit</div>
        <div className="cw-headcell" style={HEAD} />

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

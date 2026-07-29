"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { IconButton, Input } from "@merninos/ui/instrument";
import { Trash2 } from "lucide-react";
import { mono, overline, money3 } from "@/lib/instrument/tokens";
import { SELECT_CONTENT, SELECT_ITEM, SELECT_TRIGGER } from "./selectStyles";
import type { Component, SelectedComponent } from "./types";

/**
 * The recipe worksheet (CoffeeOS#69 Stage B). Replaces the table AND the card
 * list inside CogsCalculator — ONE rendering, both viewports (Criterion 21),
 * following ProductsWorksheetTable exactly: below 900px a row is a stack of
 * labelled figures, above it the same nodes flatten into grid tracks. There is
 * no `sm:hidden` twin any more, which also means `vis()` in
 * products-capabilities.spec.ts is now a no-op rather than a lie.
 *
 * Tailwind here is LAYOUT ONLY — grid templates, spans, and the breakpoint at
 * which the row reflows. Every colour, rule, radius and type value is
 * `var(--token)` in an inline style, because this repo's Tailwind theme is the
 * LOUD palette and a class would silently render the other design system.
 *
 * WHAT IS NEW: `component.type`. Every component row has been carrying an
 * `ingredient | packaging | labor | other` classification since 001_create_schema
 * (it is `NOT NULL CHECK`ed) and the page has never shown it. Grouping by it is
 * the cheapest way to make a recipe readable: "what does the coffee cost vs what
 * does the packaging cost" is answerable by eye instead of by adding up rows.
 *
 * WHAT IS NOT NEW: no figure changes. Line total is still `quantity ×
 * cost_per_unit`, unit cost is still `money3(cost)/unit`, and the footer total is
 * the same sum the parent computes as `calculatedCogs` — computed here by the
 * same reduction over the same array, so the footer and the hero cannot disagree
 * (Criterion 19).
 *
 * ────────────────────────────────────────────────────────────────────────────
 * GROUP ORDER IS DERIVED, NOT CANONICAL — AND THAT IS LOAD-BEARING
 *
 * Groups are emitted in order of their LAST member's index in
 * `selectedComponents`, not in a fixed ingredient → packaging → labor → other
 * order. That looks arbitrary; it is the opposite.
 *
 * `products-capabilities.spec.ts` drives every one of its six assertions through
 * `rows.last()`: "Add Component" appends to the array, and the spec reads the new
 * row's unit cost, edits its quantity, and removes it, all via the LAST matching
 * `recipe-row` in the DOM. A fixed group order breaks that. Cold Brew Blend 5lb
 * — the spec's product-mode fixture — holds Roasted Coffee (ingredient), Label
 * (packaging) and Roastery Labor (labor), and the only component it can add is
 * the 12oz Valve Bag, a PACKAGING item. Under a canonical order that bag renders
 * in the middle of the table and `rows.last()` returns Roastery Labor at
 * $22.000/hour, so the spec would assert that adding a $0.42 bag moved COGS by
 * $22 and fail — or, worse on another fixture, silently pass against the wrong
 * row.
 *
 * Ordering groups by their last member's index makes the invariant total: the
 * appended element always holds the maximum index in the array, so its group
 * always sorts last and it is always last within that group. The last DOM
 * `recipe-row` is therefore ALWAYS the last array element, whatever the types
 * are. Removal keeps the invariant for the same reason.
 *
 * In practice this also reads naturally, because recipes are entered
 * coffee-first: both seeded shapes come out as ingredient → packaging → labor
 * anyway. The cost is that adding a component can move its group down the table.
 * That is a visible reorder, and it is the honest price of not silently
 * mis-targeting the tests.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Preserved from the loud version, deliberately — this commit is appearance only:
 *  - rows key on the array index, so removing a middle row remounts everything
 *    below it and discards in-flight `<Select>` state
 *  - `parseFloat(e.target.value) || 0` turns an emptied quantity into 0 rather
 *    than letting the field be empty, so it fights the user mid-edit
 *  - the same component cannot appear twice; quantity is the only way to say
 *    "two of these"
 */

/** Component | Qty | Unit cost | Line total | Share | remove */
const GRID = "minmax(0,1fr) 96px 132px 116px 132px 40px";

/**
 * 900px, matching ProductsWorksheetTable: it is `--bp-compact`, where AppShell
 * swaps the nav rail for a drawer, so above the breakpoint the row has the full
 * canvas.
 */
const ROW = "flex flex-col min-[900px]:grid";
const CELL = "flex items-center px-3 py-1.5 min-[900px]:py-0 min-[900px]:h-10";
const CELL_R = `${CELL} justify-between min-[900px]:justify-end`;

const TYPE_LABEL: Record<string, string> = {
  ingredient: "Ingredients",
  packaging: "Packaging",
  labor: "Labor",
  other: "Other",
};

/** A figure that carries its own label, shown only while the row is stacked. */
function Figure({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={CELL_R}>
      <span style={overline} className="min-[900px]:hidden">
        {label}
      </span>
      {children}
    </div>
  );
}

interface Line {
  /** Index into `selectedComponents` — what the parent's handlers take. */
  index: number;
  sc: SelectedComponent;
  comp: Component | undefined;
  lineTotal: number;
}

export function RecipeTable({
  availableComponents,
  selectedComponents,
  onRemoveComponent,
  onUpdateComponent,
  inert = false,
  testId,
}: {
  availableComponents: Component[];
  selectedComponents: SelectedComponent[];
  onRemoveComponent?: (i: number) => void;
  onUpdateComponent?: (i: number, field: keyof SelectedComponent, value: string | number) => void;
  /**
   * A recipe that is STORED BUT NOT BILLED (CoffeeOS#69). Figures render
   * `--ink-subtle`, the footer says "Stored total" rather than "Unit COGS", and
   * the controls are gone — it is readable, and unmistakably not the live one.
   *
   * The billed and the stored recipe render through this ONE component on
   * purpose: two components would be two chances for the same rows to total
   * differently.
   */
  inert?: boolean;
  testId?: string;
}) {
  const lines: Line[] = selectedComponents.map((sc, index) => {
    const comp = availableComponents.find((c) => c.id === sc.componentId);
    return { index, sc, comp, lineTotal: comp ? sc.quantity * comp.cost_per_unit : 0 };
  });

  // The same reduction the parent uses for `calculatedCogs`, so the footer and
  // the hero figure are the same number by construction.
  const total = lines.reduce((sum, l) => sum + l.lineTotal, 0);

  // Group, then order groups by their last member's index. See the note above —
  // this ordering is what keeps the last DOM row equal to the last array element.
  const byType = new Map<string, Line[]>();
  for (const line of lines) {
    const key = line.comp?.type ?? "other";
    const bucket = byType.get(key);
    if (bucket) bucket.push(line);
    else byType.set(key, [line]);
  }
  const groups = Array.from(byType.entries())
    .map(([type, groupLines]) => ({ type, lines: groupLines }))
    .sort((a, b) => a.lines[a.lines.length - 1].index - b.lines[b.lines.length - 1].index);

  const figure: React.CSSProperties = {
    ...mono,
    fontSize: "var(--fs-data)",
    color: inert ? "var(--ink-subtle)" : "var(--ink)",
  };
  const lastIndex = lines.length - 1;

  return (
    <div
      style={{
        border: "1px solid var(--hairline)",
        borderRadius: "var(--r-md)",
        overflow: "hidden",
        background: "var(--surface)",
      }}
    >
      {/* Header exists only where the row is a grid — a stacked row labels
          itself, so a header above it would say everything twice. */}
      <div
        className="hidden min-[900px]:grid"
        style={{
          gridTemplateColumns: GRID,
          ...overline,
          color: "var(--ink-muted)",
          background: "var(--surface-sunken)",
          borderBottom: "1px solid var(--hairline-strong)",
        }}
      >
        <div className="flex items-center px-3 h-[34px]">Component</div>
        <div className="flex items-center justify-end px-3 h-[34px]">Qty</div>
        <div className="flex items-center justify-end px-3 h-[34px]">Unit cost</div>
        <div className="flex items-center justify-end px-3 h-[34px]">Line total</div>
        <div className="flex items-center justify-end px-3 h-[34px]">Share</div>
        <div className="h-[34px]" />
      </div>

      {groups.map((group) => (
        <div key={group.type}>
          <div
            style={{
              ...overline,
              background: "var(--surface-sunken)",
              borderBottom: "1px solid var(--hairline)",
              padding: "0 12px",
              height: 26,
              display: "flex",
              alignItems: "center",
            }}
          >
            {TYPE_LABEL[group.type] ?? TYPE_LABEL.other}
          </div>

          {group.lines.map(({ index, sc, comp, lineTotal }) => {
            // Share of the recipe. A zero total means every line is zero, and
            // 0/0 would render NaN%.
            const share = total > 0 ? (lineTotal / total) * 100 : 0;
            return (
              <div
                key={index}
                data-testid={inert ? "stored-recipe-row" : "recipe-row"}
                // py-2 only while stacked. Above the breakpoint the row is
                // exactly 40px — the design system's row metric — supplied by
                // the cells' own `h-10`, so extra row padding would break it.
                className={`${ROW} py-2 min-[900px]:py-0`}
                style={{
                  gridTemplateColumns: GRID,
                  fontFamily: "var(--font-sans)",
                  fontSize: "var(--fs-body)",
                  color: "var(--ink)",
                  borderBottom: index === lastIndex ? "none" : "1px solid var(--hairline)",
                }}
              >
                <div className={`${CELL} min-w-0`}>
                  <Select
                    disabled={inert}
                    value={sc.componentId}
                    onValueChange={(v) => onUpdateComponent?.(index, "componentId", v)}
                  >
                    <SelectTrigger style={SELECT_TRIGGER}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent data-surface="app" style={SELECT_CONTENT}>
                      {/* Components already used by ANOTHER row are excluded
                          (CoffeeOS#69 task 27). `product_components` has
                          UNIQUE(product_id, component_id), and the picker used
                          to let you select a duplicate — which then failed on
                          save with a raw Postgres constraint message in the
                          toast. Quantity is how you express "two of these".
                          The row's OWN component stays listed, or the Select
                          would have no value to show. */}
                      {availableComponents
                        .filter(
                          (c) =>
                            c.id === sc.componentId ||
                            !selectedComponents.some((other) => other.componentId === c.id)
                        )
                        .map((c) => (
                          <SelectItem key={c.id} value={c.id} style={SELECT_ITEM}>
                            {c.name} ({c.unit})
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                <Figure label="Qty">
                  {/* `data-testid` is forwarded explicitly through instrument's
                      Input, which spreads `...rest` onto the <input>. Components
                      that destructure props drop unknown ones silently, which is
                      exactly how these ids vanished once before. */}
                  <Input
                    data-testid="recipe-qty"
                    readOnly={inert}
                    size="sm"
                    mono
                    type="number"
                    min="0"
                    step="0.01"
                    value={sc.quantity}
                    onChange={(e) => onUpdateComponent?.(index, "quantity", parseFloat(e.target.value) || 0)}
                    style={{ width: 88, textAlign: "right" }}
                  />
                </Figure>

                <Figure label="Unit cost">
                  <span
                    data-testid="recipe-unit-cost"
                    style={{ ...figure, color: "var(--ink-muted)" }}
                  >
                    {comp ? `${money3(comp.cost_per_unit)}/${comp.unit}` : "—"}
                  </span>
                </Figure>

                <Figure label="Line total">
                  <span data-testid="recipe-line-total" style={figure}>
                    {money3(lineTotal)}
                  </span>
                </Figure>

                <Figure label="Share">
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                    {/* A thin track, not a chart: share is read off the row it
                        belongs to. This is what replaced the recharts donut —
                        which needed a colour ramp per component and the product
                        has no data to justify one. */}
                    <span
                      aria-hidden="true"
                      style={{
                        width: 52,
                        height: 6,
                        flex: "none",
                        borderRadius: 999,
                        background: "var(--hairline)",
                        overflow: "hidden",
                      }}
                    >
                      <span
                        style={{
                          display: "block",
                          height: "100%",
                          width: `${share}%`,
                          background: "var(--ink-subtle)",
                        }}
                      />
                    </span>
                    <span style={{ ...overline, minWidth: 30, textAlign: "right" }}>
                      {share.toFixed(0)}%
                    </span>
                  </span>
                </Figure>

                <div className={`${CELL} justify-end min-[900px]:justify-center`}>
                  {!inert && (
                    <IconButton
                      data-testid="recipe-remove"
                      size="sm"
                      icon={<Trash2 size={14} strokeWidth={2} />}
                      aria-label={`Remove ${comp?.name ?? "component"}`}
                      onClick={() => onRemoveComponent?.(index)}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ))}

      {/* Totals footer. Must equal the hero figure (Criterion 19) — it is the
          same reduction over the same array, so it cannot drift. */}
      <div
        className="flex items-center justify-between min-[900px]:grid"
        style={{
          gridTemplateColumns: GRID,
          background: "var(--surface-sunken)",
          borderTop: "1px solid var(--hairline-strong)",
          minHeight: 40,
        }}
      >
        <div className={CELL}>
          <span style={{ ...overline, color: "var(--ink)" }}>{inert ? "Stored total" : "Unit COGS"}</span>
        </div>
        <div className="hidden min-[900px]:block" />
        <div className="hidden min-[900px]:block" />
        <div className={`${CELL} justify-end`}>
          <span style={{ ...figure, fontSize: "var(--fs-data-lg)" }}>{money3(total)}</span>
        </div>
        <div className="hidden min-[900px]:block" />
        <div className="hidden min-[900px]:block" />
      </div>
    </div>
  );
}

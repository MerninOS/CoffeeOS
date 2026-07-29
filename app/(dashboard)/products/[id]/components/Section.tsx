"use client";

import type { CSSProperties, ReactNode } from "react";
import { overline, sans } from "@/lib/instrument/tokens";

/**
 * A ruled section header (CoffeeOS#69 Stage B).
 *
 * THIS REPLACES `Panel` FROM primitives.tsx, AND IT IS NOT A CARD.
 *
 * The loud page wrapped every block in a bordered, shadowed, cream-headed panel.
 * The worksheet model has no nested cards: content sits directly on the surface,
 * and a section is announced by an overline title over a single hairline rule.
 * That is the whole component — a title, an optional muted note, an optional
 * right-aligned action, and the rule. Everything below it is on the page, not
 * inside a box.
 *
 * The one bordered container on this page is RecipeTable, which earns it the way
 * the list page's filter bar does: it is a genuinely modular table, not chrome
 * wrapped around prose.
 *
 * Every value is `var(--token)` in an inline style. Tailwind's theme in this repo
 * is the LOUD palette, so a class here would silently render the other design
 * system inside the instrument shell.
 */
export function Section({
  title,
  note,
  action,
  children,
  style,
}: {
  title: string;
  /** Muted one-liner beside the title. Say what the figures below mean. */
  note?: ReactNode;
  /** Right-aligned control on the rule — one action, not a toolbar. */
  action?: ReactNode;
  children?: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <section
      style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", minWidth: 0, ...style }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          paddingBottom: 8,
          borderBottom: "1px solid var(--hairline-strong)",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", minWidth: 0 }}>
          {/* `--ink-muted` rather than the overline default `--ink-subtle`: this
              is the heading of the block, not a column label inside it. */}
          <span style={{ ...overline, color: "var(--ink-muted)" }}>{title}</span>
          {note && (
            <span style={{ ...sans, fontSize: "var(--fs-caption)", color: "var(--ink-muted)" }}>
              {note}
            </span>
          )}
        </div>
        {action && <div style={{ flex: "none" }}>{action}</div>}
      </div>
      {children}
    </section>
  );
}

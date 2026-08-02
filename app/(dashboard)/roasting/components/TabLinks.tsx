"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { overline } from "@/lib/instrument/tokens";

export interface TabLink {
  label: string;
  href: string;
  active: boolean;
  count?: number;
}

/**
 * The instrument tab visual, over real links.
 *
 * Deliberately NOT the design system's `Tabs`. That component renders
 * `<button onClick>`, and these tabs are navigation — `/roasting/batches` is its
 * own route, and the other three are `?tab=` views that should stay
 * bookmarkable. Swapping in buttons would silently remove cmd-click,
 * middle-click and "copy link address" from the entire tab bar: a regression no
 * screenshot and no capability test would catch, because everything still
 * renders and still works on a plain left-click.
 *
 * So the visual is reproduced — underline rail, 2px brand indicator, count pill
 * — over `<Link>`. See design.md decision 1.
 */
const RAIL: CSSProperties = {
  display: "flex",
  gap: 4,
  borderBottom: "1px solid var(--hairline)",
  overflowX: "auto",
};

export function TabLinks({ tabs }: { tabs: TabLink[] }) {
  return (
    <div role="tablist" style={RAIL}>
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          role="tab"
          aria-selected={t.active}
          data-testid={`tab-${t.label.toLowerCase().replace(/\s+/g, "-")}`}
          style={{
            position: "relative",
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            padding: "10px 12px",
            whiteSpace: "nowrap",
            textDecoration: "none",
            fontFamily: "var(--font-sans)",
            fontSize: "var(--fs-body)",
            fontWeight: t.active
              ? ("var(--fw-medium)" as unknown as number)
              : ("var(--fw-regular)" as unknown as number),
            color: t.active ? "var(--ink)" : "var(--ink-muted)",
            transition: "color var(--motion)",
          }}
        >
          {t.label}
          {t.count != null && (
            <span
              style={{
                ...overline,
                // The count is a figure, not a label — it must not uppercase or
                // pick up the overline's letter-spacing.
                textTransform: "none",
                letterSpacing: ".01em",
                padding: "1px 6px",
                borderRadius: "var(--r-pill)",
                background: t.active ? "var(--brand-soft)" : "var(--surface-sunken)",
                color: t.active ? "var(--brand-hover)" : "var(--ink-muted)",
              }}
            >
              {t.count}
            </span>
          )}
          {t.active && (
            <span
              aria-hidden="true"
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: -1,
                height: 2,
                background: "var(--brand)",
                borderRadius: 2,
              }}
            />
          )}
        </Link>
      ))}
    </div>
  );
}

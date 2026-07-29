import type { CSSProperties } from "react";

/**
 * Instrument styling for the two Radix `<Select>`s this page keeps — the recipe
 * row's component picker and the add-variant dialog's "copy COGS from".
 *
 * WHY RADIX AND NOT instrument's `Select`
 *
 * instrument's `Select` is a native `<select>`. Both call sites are already
 * driven by Radix's `onValueChange` and, in the recipe table's case, by tests
 * that click through the listbox. Swapping to a native control would change what
 * the keyboard and the tests reach, which is a behaviour change and not this
 * commit's job.
 *
 * WHY `SELECT_CONTENT` IS USED WITH `data-surface="app"` AT EVERY CALL SITE
 *
 * Radix portals the content to <body>, i.e. OUTSIDE the AppShell subtree that
 * scopes the instrument token layer. Without `data-surface="app"` on the content
 * root, every `var(--token)` below resolves to nothing and the listbox renders
 * unstyled — the same defect the list page's dialogs record. The attribute is
 * load-bearing, not defensive.
 *
 * These are inline styles rather than classes for the usual reason: the Tailwind
 * theme in this repo is the LOUD palette, and shadcn's own `border-input` /
 * `bg-popover` classes on these primitives resolve against it. Inline `var()`
 * wins over the class for each property it sets, which is why each object sets
 * background, border, radius, colour and type explicitly rather than relying on
 * a reset.
 */

export const SELECT_TRIGGER: CSSProperties = {
  width: "100%",
  height: 30,
  padding: "0 8px",
  background: "var(--surface)",
  border: "1px solid var(--hairline-strong)",
  borderRadius: "var(--r-sm)",
  boxShadow: "none",
  fontFamily: "var(--font-sans)",
  fontSize: "var(--fs-body)",
  fontWeight: "var(--fw-regular)" as unknown as number,
  color: "var(--ink)",
};

export const SELECT_CONTENT: CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--hairline-strong)",
  borderRadius: "var(--r-md)",
  boxShadow: "var(--shadow-pop)",
  color: "var(--ink)",
};

export const SELECT_ITEM: CSSProperties = {
  fontFamily: "var(--font-sans)",
  fontSize: "var(--fs-body)",
  color: "var(--ink)",
  borderRadius: "var(--r-sm)",
};

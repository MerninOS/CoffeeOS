import type { CSSProperties } from "react";

/**
 * The three type roles of the instrument design system, as inline-style objects.
 *
 * Identical in shape to the ones in app/(dashboard)/dashboard/page.tsx — the
 * reference conversion — and duplicated here rather than imported from a page
 * module. They are read as `var(--token)` on purpose: the Tailwind theme in this
 * repo is the LOUD Mernin' palette, so its font, colour, border and shadow
 * utilities resolve to the wrong design system. Nothing in this directory may take
 * a colour, border, radius, shadow or type value from a Tailwind class.
 *
 * `fontWeight` is cast because React types it `number | string` but rejects a
 * `var()` string; the CSS is valid.
 */

export const mono: CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontVariationSettings: "var(--data-settings)",
  fontWeight: "var(--data-weight)" as unknown as number,
  fontVariantNumeric: "tabular-nums",
};

export const overline: CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontVariationSettings: "var(--overline-settings)",
  fontWeight: "var(--overline-weight)" as unknown as number,
  textTransform: "uppercase",
  letterSpacing: "var(--overline-tracking)",
  fontSize: "var(--fs-overline)",
  color: "var(--ink-subtle)",
};

export const sans: CSSProperties = {
  fontFamily: "var(--font-sans)",
  fontSize: "var(--fs-body)",
  color: "var(--ink)",
};

/** Money, always with the glyph. The `$` is part of the value everywhere on this
 *  page — `tests/e2e/orders-capabilities.spec.ts` asserts `toHaveText("$12.34")`
 *  against the very elements these produce, so it may not be split into a
 *  separate unit slot. */
export const money = (n: number) => `$${n.toFixed(2)}`;

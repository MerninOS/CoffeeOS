import type { CSSProperties } from "react";

/**
 * The three type roles of the instrument design system, as inline-style objects.
 *
 * Deliberately a COPY of app/(dashboard)/orders/components/tokens.ts rather than
 * an import: it is a thirty-line constant, and importing it would make
 * /settings depend on /orders' internals across a route boundary. The orders
 * copy's own header argues for exactly this.
 *
 * They are read as `var(--token)` on purpose. The Tailwind theme in this repo is
 * the LOUD Mernin' palette, so its colour, border, shadow and font utilities
 * resolve to the wrong design system — and silently, because the result still
 * renders. Nothing in this directory may take a colour, border, radius, shadow
 * or type value from a Tailwind class; tests/unit/settings-tokens.spec.ts
 * enforces it.
 *
 * No `money` export — /settings renders no currency.
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

import type { CSSProperties } from "react";

/**
 * The three type roles of the instrument design system, as inline-style objects.
 * Canonical and app-wide.
 *
 * WHY THESE ARE READ AS `var(--token)` AND NEVER AS TAILWIND CLASSES
 *
 * The Tailwind theme in this repo is the LOUD Mernin' palette — `bg-cream`,
 * `text-espresso`, `shadow-flat-*` — and Tailwind v4's `@theme inline` bakes
 * literal values into utilities at build time. Instrument's tokens are scoped to
 * `[data-surface="app"]`, so a baked literal ignores that scope and silently
 * renders the other design system. Nothing on an operator surface may take a
 * colour, border, radius, shadow or type value from a Tailwind class. Tailwind is
 * for layout and breakpoints only.
 *
 * WHY THIS FILE EXISTS RATHER THAN A THIRD COPY
 *
 * `app/(dashboard)/orders/components/tokens.ts` says its duplication is
 * deliberate — "not imported across page modules" — and `/dashboard` carries a
 * third copy inline. CoffeeOS#69 overturns that, on one observation: these
 * objects hold `var(--token)` REFERENCES, not design values. A design-system
 * change propagates through CSS however many copies exist, so the copies
 * insulate against nothing. The only thing that can drift is the indirection
 * itself — and `/products` wanting a different `mono` than `/orders` would be a
 * bug, not a feature. Duplication earns its keep when copies might legitimately
 * diverge; these cannot.
 *
 * NOT `@merninos/ui/instrument`, which is where these ultimately belong: that
 * needs a package release, and CoffeeOS pins `"@merninos/ui": "^0.1.0"` — a
 * caret on a `0.x` locks the minor, so the range can never reach the 0.3.0 the
 * app is actually built against. Fixing that is its own task.
 *
 * `/orders` and `/dashboard` are NOT migrated onto this file by CoffeeOS#69 —
 * that would widen a /products conversion into a diff on two other pages and put
 * their baselines at risk for no benefit to the ticket. Each migration is a
 * one-line import change, provable by that page's own baselines.
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

/**
 * Money, always with the glyph, at two decimals.
 *
 * The `$` is part of the value because the e2e specs assert `toHaveText("$12.34")`
 * against the elements these produce — splitting the glyph into a separate unit
 * slot would break them silently.
 *
 * `/products/[id]` deliberately does NOT use this for unit economics: component
 * costs are `DECIMAL(18,8)` and a line at `$0.085/each` rounds to `$0.09` at two
 * decimals, so a five-line recipe visibly disagrees with its own total. That page
 * uses `money3`. The list shows price-like figures and uses this one.
 */
export const money = (n: number) => `$${n.toFixed(2)}`;

/** Unit economics, at three decimals. See the note on `money`. */
export const money3 = (n: number) => `$${n.toFixed(3)}`;

"use client";

import { Pill } from "./primitives";

/**
 * Margin display, moved out of products-client.tsx unchanged (CoffeeOS#69
 * Stage A). Three call sites shared it — the variant dropdown, the mobile card
 * list and the desktop table — which is why it moves as one unit rather than
 * being inlined three times.
 *
 * TWO KNOWN DEFECTS PRESERVED HERE ON PURPOSE. Stage A must not change
 * behaviour, so they are recorded rather than fixed:
 *
 * 1. `calcMargin` returns null when EITHER price or cogs is falsy, so `—` means
 *    "no price", "no recipe" and "a genuinely $0 recipe" indistinguishably.
 *    Spec Criteria 2 and 4 split those apart in Stage C.
 *
 * 2. `!cogs` is a truthiness test, so a product costed entirely from zero-cost
 *    components reads as uncosted forever. lib/orders/cogs.ts carries
 *    `hasRecipe` precisely because that is the wrong question; /products does
 *    not consume it yet.
 */

export const calcMargin = (price: number | null, cogs: number | null | undefined) => {
  if (!price || !cogs) return null;
  return ((price - cogs) / price) * 100;
};

export function MarginPill({ margin }: { margin: number | null }) {
  if (margin === null) return <span className="text-muted-foreground">—</span>;
  const variant = margin >= 30 ? "matcha" : margin >= 15 ? "sun" : "tomato";
  return <Pill variant={variant}>{margin.toFixed(1)}%</Pill>;
}

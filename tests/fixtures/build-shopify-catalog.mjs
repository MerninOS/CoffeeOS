/**
 * Generates tests/fixtures/shopify-catalog.json — the catalogue lib/shopify-client.ts
 * serves when SHOPIFY_FIXTURE_MODE=1.
 *
 *   node tests/fixtures/build-shopify-catalog.mjs
 *
 * Committed as a generator because one product needs 120 variants, and 120
 * hand-written objects is a file nobody will ever read or correctly edit.
 *
 * This fixture is paired with scripts/seed-demo-account.mjs. The shopify_id
 * values below in the 10000000xx range deliberately match seeded products so
 * they classify as CHANGED; the 90000000xx range is deliberately absent from the
 * seed so those classify as NEW. Reseeding with different ids breaks this pairing.
 *
 * What it does NOT try to cover: one case per compared field. That granularity
 * belongs to the diffProduct unit tests, which can express it without a database.
 * Here a CHANGED product may legitimately carry several field diffs at once —
 * which is also what real Shopify drift looks like.
 */

import { writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Fixed, never derived from the clock — a fixture that changes between runs
// cannot be asserted against.
const UPDATED_AT = "2026-07-01T12:00:00Z";

const variant = (id, title, price, sku) => ({
  id: `gid://shopify/ProductVariant/${id}`,
  title,
  price,
  sku,
  inventoryQuantity: 25,
});

const product = (id, title, handle, description, variants) => ({
  id: `gid://shopify/Product/${id}`,
  title,
  handle,
  description,
  vendor: "Mernin' Coffee Roasters",
  productType: "Coffee",
  updatedAt: UPDATED_AT,
  imageUrl: null,
  variants,
});

const products = [
  // ── CHANGED: matches seeded product 1000000005 (Kenya Nyeri AA) ────────────
  //
  // The first variant's price moves 24 -> 26. Because the sync derives
  // products.price and products.sku from the FIRST variant, this surfaces as a
  // product-level price diff AND a variant-level price diff on 10000000051.
  //
  // The second variant is byte-identical to what the seed stores, except its
  // price is written "26.0" against a stored 26.00. If price normalization is
  // broken it will report as changed, and the e2e assertion on which variants
  // differ will fail. That is the point of writing it this way.
  product(
    1000000005,
    "Kenya Nyeri AA",
    "kenya-nyeri-aa",
    "Costed per variant, and the variants agree.",
    [
      variant(10000000051, "12oz", "26.00", "KEN-NYERI-12"),
      variant(10000000052, "12oz Decaf", "26.0", "KEN-NYERI-12-DECAF"),
    ]
  ),

  // ── CHANGED: matches seeded 1000000006 (Sumatra Mandheling) ────────────────
  // The 2lb variant (10000000062) is gone from Shopify -> a "removed" variant
  // diff, and the sync should reap the stored row.
  product(
    1000000006,
    "Sumatra Mandheling",
    "sumatra-mandheling",
    "Variants disagree on cost — deliberately unknowable.",
    [variant(10000000061, "12oz", "20.00", "SUM-MAND-12")]
  ),

  // ── CHANGED: matches seeded 1000000007 (Costa Rica Tarrazu) ────────────────
  // A third variant appears -> an "added" variant diff. Also renames the
  // product, so this one carries both a field diff and a variant diff.
  product(
    1000000007,
    "Costa Rica Tarrazu — Washed",
    "costa-rica-tarrazu",
    "One variant costed, one with no recipe at all.",
    [
      variant(10000000071, "12oz", "21.00", "CRI-TARRAZU-12"),
      variant(10000000072, "Sample 4oz", "8.00", "CRI-TARRAZU-4OZ"),
      variant(10000000073, "2lb", "44.00", "CRI-TARRAZU-2LB"),
    ]
  ),

  // ── NEW: absent from the seed ──────────────────────────────────────────────
  product(
    9000000001,
    "Panama Geisha Reserve",
    "panama-geisha-reserve",
    "Small-lot, jasmine and bergamot.",
    [variant(90000000011, "8oz", "48.00", "PAN-GEISHA-8")]
  ),

  // ── NEW, and the one the exclusion tests decline ───────────────────────────
  // Leaving this unchecked must write an exclusion row and keep it out of the
  // next preview's default list (AC6), while staying reachable via the ignored
  // reveal (AC7).
  product(
    9000000002,
    "Decaf Swiss Water Blend",
    "decaf-swiss-water-blend",
    "The one the operator does not want in CoffeeOS.",
    [variant(90000000021, "12oz", "19.00", "DECAF-SW-12")]
  ),

  // ── NEW, and the reason Task 2 existed: 120 variants ───────────────────────
  //
  // VARIANTS_PAGE_SIZE is 100, so this product is the ONLY thing in the suite
  // that crosses the page boundary and exercises fetchRemainingProductVariants.
  // Before that fix, variants 11+ were deleted on every sync; a fixture capped
  // at 100 would prove nothing about the boundary itself.
  product(
    9000000003,
    "Single Origin Advent Calendar",
    "single-origin-advent-calendar",
    "One hundred and twenty little bags.",
    Array.from({ length: 120 }, (_, index) =>
      variant(
        90000000031 + index,
        `Day ${index + 1}`,
        (12 + (index % 7)).toFixed(2),
        `ADVENT-${String(index + 1).padStart(3, "0")}`
      )
    )
  ),
];

const here = dirname(fileURLToPath(import.meta.url));
await writeFile(
  join(here, "shopify-catalog.json"),
  `${JSON.stringify({ products }, null, 2)}\n`,
  "utf8"
);

const total = products.reduce((sum, p) => sum + p.variants.length, 0);
console.log(`wrote shopify-catalog.json — ${products.length} products, ${total} variants`);

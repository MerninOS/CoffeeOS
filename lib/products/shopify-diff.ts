/**
 * What a Shopify sync would actually change, decided before anything is written.
 *
 * The sync used to be all-or-nothing: fetch the catalogue, upsert every product,
 * done. There was no point at which a candidate list existed for anyone to say
 * no to, and the upsert clobbered CoffeeOS-side edits silently. This module is
 * that missing step — it classifies each incoming product as new, changed, or
 * unchanged, and for changed ones names exactly which fields moved.
 *
 * It is PURE ON PURPOSE. No Supabase, no fetch, no environment. Every
 * classification risk in the feature concentrates here, and a pure function is
 * the only version of it that can be exhaustively tested without a database.
 * Matching an incoming product to its stored row happens in the caller; by the
 * time we are called, that pairing is already decided.
 *
 * The comparison mirrors what syncShopifyProducts WRITES, not what Shopify
 * sends. Those differ: `sku` and `price` on a product row are taken from its
 * FIRST VARIANT, not from any product-level field. Comparing against the wrong
 * source would report drift that no sync could ever resolve — the product would
 * read as changed on every preview, forever.
 */

import { parseShopifyGid, type ShopifyProduct, type ShopifyVariant } from "@/lib/shopify";

export type SyncStatus = "new" | "changed" | "unchanged";

export interface FieldDiff {
  field: string;
  /** The CoffeeOS side. Null where the column is empty. */
  current: string | null;
  /** What this sync would write. */
  incoming: string | null;
}

export interface VariantDiff {
  shopifyVariantId: string;
  kind: "added" | "removed" | "changed";
  /** Empty for added and removed — the variant's whole existence is the change. */
  diffs: FieldDiff[];
}

/** The products columns this comparison reads. A subset of the table. */
export interface ExistingProduct {
  id: string;
  shopify_id: string | null;
  title: string | null;
  description: string | null;
  sku: string | null;
  price: number | string | null;
  image_url: string | null;
  shopify_handle: string | null;
}

/** The product_variants columns this comparison reads. */
export interface ExistingVariant {
  shopify_variant_id: string | null;
  title: string | null;
  sku: string | null;
  price: number | string | null;
}

export interface SyncCandidate {
  shopifyId: string;
  title: string;
  imageUrl: string | null;
  status: SyncStatus;
  diffs: FieldDiff[];
  variantDiffs: VariantDiff[];
  /** Previously declined. Presentation only — exclusion never changes status. */
  excluded: boolean;
}

export interface DiffInput {
  incoming: ShopifyProduct;
  /**
   * The COMPLETE variant set, including anything past the first page.
   *
   * Deliberately a separate parameter rather than read off
   * `incoming.variants.edges`. The catalogue query returns at most
   * VARIANTS_PAGE_SIZE variants per product, and the sync deletes stored
   * variants absent from the set it is handed — so silently diffing against a
   * truncated page is how variants 11+ came to be deleted on every run. Making
   * the caller pass the assembled set makes that omission visible at the call
   * site instead of invisible in here.
   */
  incomingVariants: ShopifyVariant[];
  existing: ExistingProduct | null;
  existingVariants: ExistingVariant[];
  excluded?: boolean;
}

/**
 * Which declined products get remembered (AC6a).
 *
 * ONLY the ones the server itself classified `new`. Declining an update to a
 * product already in the catalogue means "skip this change", not "never import
 * this product" — recording that would leave an in-use product sitting in
 * CoffeeOS, invisible to the sync that maintains it, reachable only through the
 * ignored reveal.
 *
 * Extracted from the action so the rule can be tested without a database. It is
 * one `filter`, and it is the single most load-bearing line in the feature: the
 * distinction it encodes is not recoverable once the wrong row is written.
 *
 * `statuses` MUST come from the server's own re-diff. A client-supplied status
 * here would let anyone banish any product by posting a status of "new".
 */
export function exclusionsToRecord(
  excludeIds: string[],
  statuses: Map<string, SyncStatus>
): string[] {
  return excludeIds.filter((shopifyId) => statuses.get(shopifyId) === "new");
}

/**
 * Money compared as a fixed 2-decimal string.
 *
 * Shopify sends `"19.0"`; Postgres DECIMAL(10,2) comes back as `19.00` or the
 * string `"19.00"` depending on the driver. Comparing any of those raw makes
 * every priced product differ from itself, which would mark the entire
 * catalogue changed on every preview — indistinguishable, to a reader, from
 * real drift.
 */
function normalizePrice(value: number | string | null | undefined): string | null {
  if (value === null || value === undefined || value === "") return null;
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric.toFixed(2) : null;
}

/**
 * Empty text is one concept with two spellings.
 *
 * The sync writes `description || null`, so a Shopify product with `""` becomes
 * NULL in the column. Treating those as different would permanently flag every
 * product with an empty description.
 */
function normalizeText(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function pushDiff(
  diffs: FieldDiff[],
  field: string,
  current: string | null,
  incoming: string | null
): void {
  if (current !== incoming) diffs.push({ field, current, incoming });
}

/**
 * The product-row values this sync would write, derived exactly as
 * syncShopifyProducts derives them.
 *
 * Keep this in lockstep with the upsert. If the sync's derivation changes and
 * this does not, the preview will promise one thing and the write will do
 * another — the worst failure this feature can have, because the operator
 * approved the diff on screen.
 */
function projectIncoming(incoming: ShopifyProduct, incomingVariants: ShopifyVariant[]) {
  const firstVariant = incomingVariants[0];
  const firstImage = incoming.images.edges[0]?.node;

  return {
    title: normalizeText(incoming.title),
    description: normalizeText(incoming.description),
    sku: normalizeText(firstVariant?.sku),
    price: normalizePrice(firstVariant?.price),
    image_url: normalizeText(firstImage?.url),
    shopify_handle: normalizeText(incoming.handle),
  };
}

function diffVariants(
  incomingVariants: ShopifyVariant[],
  existingVariants: ExistingVariant[]
): VariantDiff[] {
  const variantDiffs: VariantDiff[] = [];

  // Keyed by the FULL gid, unparsed. product_variants.shopify_variant_id stores
  // it that way — unlike products.shopify_id, which stores the numeric tail.
  // The asymmetry is real; parsing here would match nothing.
  const existingById = new Map(
    existingVariants
      .filter((variant) => variant.shopify_variant_id)
      .map((variant) => [variant.shopify_variant_id as string, variant])
  );

  const seen = new Set<string>();

  for (const incoming of incomingVariants) {
    seen.add(incoming.id);
    const existing = existingById.get(incoming.id);

    if (!existing) {
      variantDiffs.push({ shopifyVariantId: incoming.id, kind: "added", diffs: [] });
      continue;
    }

    // Every field the write touches must be compared here. The sync writes
    // title, sku and price for each variant row; omitting sku meant a re-SKU on
    // any variant but the first produced no diff at all — the product read
    // unchanged, sat in the collapsed group, and the corrected SKU never
    // arrived. Worse in the other direction: import that product for an
    // unrelated reason and the write silently changes a column the preview
    // never showed. The first variant escaped only because products.sku is
    // derived from it and that IS diffed.
    const diffs: FieldDiff[] = [];
    pushDiff(diffs, "title", normalizeText(existing.title), normalizeText(incoming.title));
    pushDiff(diffs, "sku", normalizeText(existing.sku), normalizeText(incoming.sku));
    pushDiff(diffs, "price", normalizePrice(existing.price), normalizePrice(incoming.price));

    if (diffs.length > 0) {
      variantDiffs.push({ shopifyVariantId: incoming.id, kind: "changed", diffs });
    }
  }

  for (const existing of existingVariants) {
    const id = existing.shopify_variant_id;
    // A stored variant with no Shopify id was created by hand in CoffeeOS. The
    // sync's reap only removes rows it can match, so it is not "removed" here.
    if (!id || seen.has(id)) continue;
    variantDiffs.push({ shopifyVariantId: id, kind: "removed", diffs: [] });
  }

  return variantDiffs;
}

/**
 * Classify one Shopify product against its stored counterpart.
 *
 * `existing: null` means new — the caller found no row for this shopify_id under
 * this owner. Note that a row matching on shopify_id under a DIFFERENT owner is
 * not a match and must never be passed in as one; product scoping is per owner.
 */
export function diffProduct(input: DiffInput): SyncCandidate {
  const { incoming, incomingVariants, existing, existingVariants, excluded = false } = input;

  // parseShopifyGid, not a local copy: this must produce byte-identical output
  // to what the sync stores in products.shopify_id, or the caller's lookup
  // matches nothing and every product classifies as new. One definition.
  const shopifyId = parseShopifyGid(incoming.id);
  const projected = projectIncoming(incoming, incomingVariants);
  const imageUrl = projected.image_url;

  if (!existing) {
    return {
      shopifyId,
      title: incoming.title,
      imageUrl,
      status: "new",
      diffs: [],
      variantDiffs: [],
      excluded,
    };
  }

  const diffs: FieldDiff[] = [];
  pushDiff(diffs, "title", normalizeText(existing.title), projected.title);
  pushDiff(diffs, "description", normalizeText(existing.description), projected.description);
  pushDiff(diffs, "sku", normalizeText(existing.sku), projected.sku);
  pushDiff(diffs, "price", normalizePrice(existing.price), projected.price);
  pushDiff(diffs, "image_url", normalizeText(existing.image_url), projected.image_url);
  pushDiff(
    diffs,
    "shopify_handle",
    normalizeText(existing.shopify_handle),
    projected.shopify_handle
  );

  const variantDiffs = diffVariants(incomingVariants, existingVariants);

  return {
    shopifyId,
    title: incoming.title,
    imageUrl,
    status: diffs.length > 0 || variantDiffs.length > 0 ? "changed" : "unchanged",
    diffs,
    variantDiffs,
    excluded,
  };
}

"use server";

import { createClient } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/team";
// From shopify-CLIENT, never from ./shopify directly. The live functions there
// share these names and identical signatures, so importing the wrong one
// compiles cleanly and then tries to reach a real store during e2e — surfacing
// as a 401 that points at the store instead of at this import.
import { fetchShopifyProducts, fetchRemainingProductVariants } from "@/lib/shopify-client";
import { parseShopifyGid, type ShopifyProduct, type ShopifyVariant } from "@/lib/shopify";
import {
  diffProduct,
  type ExistingProduct,
  type ExistingVariant,
  type SyncCandidate,
} from "@/lib/products/shopify-diff";
import { revalidatePath } from "next/cache";

/** Shopify products per catalogue page. */
const PAGE_SIZE = 50;

/**
 * Ids per PostgREST `.in()` call.
 *
 * 500 ids in one filter builds a URL around 8.5KB, right at the usual
 * request-line limit. Chunking sidesteps it and scales past 500. The failure
 * mode matters more than the size: a chunk that errors aborts the whole preview
 * (see loadExistingProducts), whereas an unbounded select would be SILENTLY
 * capped by max-rows — and a truncated read here misclassifies already-imported
 * products as new, which is the worst answer this feature can give.
 */
const ID_CHUNK_SIZE = 100;

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

type ShopifyCredentials = { storeDomain: string; adminAccessToken: string };

async function resolveShopifyCredentials(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ownerId: string
): Promise<{ credentials: ShopifyCredentials } | { error: string }> {
  const { data: settings, error } = await supabase
    .from("shopify_settings")
    .select("store_domain, admin_access_token")
    .eq("user_id", ownerId)
    .single();

  if (error || !settings) {
    return { error: "Shopify not connected. Please connect your store in Settings." };
  }
  if (!settings.admin_access_token) {
    return { error: "Shopify Admin API not configured. Please reconnect your store in Settings." };
  }

  return {
    credentials: {
      storeDomain: settings.store_domain,
      adminAccessToken: settings.admin_access_token,
    },
  };
}

/** A product with its COMPLETE variant set, including pages past the first. */
type CatalogEntry = { product: ShopifyProduct; variants: ShopifyVariant[] };

/**
 * The whole Shopify catalogue, with every variant assembled.
 *
 * The per-product variant page is capped, and the sync deletes stored variants
 * absent from the set it is handed — so anything that stops at the first page
 * deletes the remainder on every run. That is the bug this assembly exists to
 * prevent, not an optimisation.
 */
async function fetchCatalog({
  storeDomain,
  adminAccessToken,
}: ShopifyCredentials): Promise<CatalogEntry[]> {
  const entries: CatalogEntry[] = [];
  let cursor: string | undefined;
  let hasMore = true;

  while (hasMore) {
    const page = await fetchShopifyProducts(storeDomain, adminAccessToken, PAGE_SIZE, cursor);

    for (const edge of page.edges) {
      const product = edge.node;
      const variants = product.variants.edges.map((variantEdge) => variantEdge.node);

      if (product.variants.pageInfo.hasNextPage) {
        variants.push(
          ...(await fetchRemainingProductVariants(
            storeDomain,
            adminAccessToken,
            product.id,
            product.variants.pageInfo.endCursor
          ))
        );
      }

      entries.push({ product, variants });
    }

    hasMore = page.pageInfo.hasNextPage;
    cursor = page.pageInfo.endCursor;
  }

  return entries;
}

/**
 * Throws rather than returning partial data. A missing chunk would silently
 * misclassify every product it covered as new.
 */
async function loadExistingProducts(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ownerId: string,
  shopifyIds: string[]
): Promise<{ products: ExistingProduct[]; variantsByProductId: Map<string, ExistingVariant[]> }> {
  const products: ExistingProduct[] = [];

  for (const ids of chunk(shopifyIds, ID_CHUNK_SIZE)) {
    const { data, error } = await supabase
      .from("products")
      .select("id, shopify_id, title, description, sku, price, image_url, shopify_handle")
      .eq("user_id", ownerId)
      .in("shopify_id", ids);

    if (error) throw new Error(`Could not read existing products: ${error.message}`);
    products.push(...((data || []) as ExistingProduct[]));
  }

  const variantsByProductId = new Map<string, ExistingVariant[]>();

  for (const ids of chunk(products.map((product) => product.id), ID_CHUNK_SIZE)) {
    const { data, error } = await supabase
      .from("product_variants")
      .select("product_id, shopify_variant_id, title, sku, price")
      .in("product_id", ids);

    if (error) throw new Error(`Could not read existing variants: ${error.message}`);

    for (const row of data || []) {
      const list = variantsByProductId.get(row.product_id) || [];
      list.push(row as ExistingVariant);
      variantsByProductId.set(row.product_id, list);
    }
  }

  return { products, variantsByProductId };
}

async function loadExclusions(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ownerId: string
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("shopify_product_exclusions")
    .select("shopify_id")
    .eq("user_id", ownerId);

  if (error) throw new Error(`Could not read exclusions: ${error.message}`);
  return new Set((data || []).map((row) => row.shopify_id as string));
}

/**
 * Classify the whole catalogue. Reads only.
 *
 * Excluded products are diffed like any other — exclusion decides which group a
 * product renders in, never what it is. Filtering them out here would satisfy
 * AC6 and quietly break AC7: the ignored reveal would have nothing to show and
 * nothing to re-import.
 */
async function buildCandidates(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ownerId: string,
  catalog: CatalogEntry[]
): Promise<SyncCandidate[]> {
  const shopifyIds = catalog.map((entry) => parseShopifyGid(entry.product.id));

  const [{ products, variantsByProductId }, excluded] = await Promise.all([
    loadExistingProducts(supabase, ownerId, shopifyIds),
    loadExclusions(supabase, ownerId),
  ]);

  const byShopifyId = new Map(
    products
      .filter((product) => product.shopify_id)
      .map((product) => [product.shopify_id as string, product])
  );

  return catalog.map((entry) => {
    const shopifyId = parseShopifyGid(entry.product.id);
    const existing = byShopifyId.get(shopifyId) ?? null;

    return diffProduct({
      incoming: entry.product,
      incomingVariants: entry.variants,
      existing,
      existingVariants: existing ? variantsByProductId.get(existing.id) ?? [] : [],
      excluded: excluded.has(shopifyId),
    });
  });
}

/**
 * What a sync WOULD do, decided before anything is written.
 *
 * Writes nothing — not to products, not to product_variants, not to
 * shopify_product_exclusions. That is the whole contract: the operator sees the
 * consequences first and chooses. Any write added here breaks AC1 and, worse,
 * silently reintroduces the blanket sync this feature exists to replace.
 */
export async function previewShopifyProducts(): Promise<
  { candidates: SyncCandidate[]; excludedCount: number } | { error: string }
> {
  const supabase = await createClient();

  const { ownerId, error: ownerError } = await getEffectiveOwnerId();
  if (ownerError || !ownerId) {
    return { error: ownerError || "Unauthorized" };
  }

  const resolved = await resolveShopifyCredentials(supabase, ownerId);
  if ("error" in resolved) return { error: resolved.error };

  try {
    const catalog = await fetchCatalog(resolved.credentials);
    const candidates = await buildCandidates(supabase, ownerId, catalog);

    return {
      candidates,
      excludedCount: candidates.filter((candidate) => candidate.excluded).length,
    };
  } catch (error) {
    // Deliberately all-or-nothing. A partial catalogue would render as a
    // confident list in which the missing products silently read as "new".
    console.error("Shopify preview error:", error);
    return {
      error: error instanceof Error ? error.message : "Failed to read the Shopify catalogue",
    };
  }
}

type UpsertFailure = { shopifyId: string; reason: string };

/** Writes one product and reconciles its variants. Returns a reason on failure. */
async function upsertProduct(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ownerId: string,
  { product, variants }: CatalogEntry
): Promise<{ error?: string }> {
  const shopifyId = parseShopifyGid(product.id);
  const firstVariant = variants[0];
  const firstImage = product.images.edges[0]?.node;

  const { data: upserted, error: upsertError } = await supabase
    .from("products")
    .upsert(
      {
        shopify_id: shopifyId,
        user_id: ownerId,
        title: product.title,
        description: product.description || null,
        sku: firstVariant?.sku || null,
        price: firstVariant ? parseFloat(firstVariant.price) : null,
        image_url: firstImage?.url || null,
        shopify_handle: product.handle,
        variant_id: firstVariant?.id || null,
        variant_title: firstVariant?.title || null,
        synced_at: new Date().toISOString(),
      },
      { onConflict: "shopify_id,user_id" }
    )
    .select("id")
    .single();

  if (upsertError || !upserted) {
    return { error: upsertError?.message || "upsert returned no row" };
  }

  const variantRows = variants.map((variant) => ({
    product_id: upserted.id,
    user_id: ownerId,
    shopify_variant_id: variant.id,
    title: variant.title,
    sku: variant.sku || null,
    price: parseFloat(variant.price),
  }));

  if (variantRows.length > 0) {
    const { error } = await supabase
      .from("product_variants")
      .upsert(variantRows, { onConflict: "product_id,shopify_variant_id" });
    if (error) return { error: `variants: ${error.message}` };
  }

  // Reap variants Shopify no longer returns. Safe only because `variants` is the
  // COMPLETE set — assembled across pages in fetchCatalog. Against a truncated
  // first page this deletes everything past the page boundary on every run.
  const { data: stored, error: storedError } = await supabase
    .from("product_variants")
    .select("id, shopify_variant_id")
    .eq("product_id", upserted.id);

  if (storedError) return { error: `variant reconcile: ${storedError.message}` };

  const incomingIds = new Set(variantRows.map((row) => row.shopify_variant_id));
  const staleIds = (stored || [])
    .filter((row) => row.shopify_variant_id && !incomingIds.has(row.shopify_variant_id))
    .map((row) => row.id);

  if (staleIds.length > 0) {
    const { error } = await supabase.from("product_variants").delete().in("id", staleIds);
    if (error) return { error: `variant cleanup: ${error.message}` };
  }

  return {};
}

/**
 * Import the selected products, and remember the declined ones.
 *
 * Takes ID LISTS ONLY. A server action is a public HTTP endpoint: if this
 * accepted the candidate objects the client rendered, anyone could post
 * arbitrary titles and prices straight into products. So it re-fetches from
 * Shopify and re-runs the diff server-side, and trusts nothing but the ids.
 *
 * That re-diff is also what makes AC6a enforceable — the server decides for
 * itself which declined products were NEW, rather than believing a
 * client-supplied status.
 */
export async function syncShopifyProducts(selection: {
  importIds: string[];
  excludeIds: string[];
}): Promise<
  | { success: true; count: number; requested: number; failures: UpsertFailure[] }
  | { error: string }
> {
  const supabase = await createClient();

  const { ownerId, error: ownerError } = await getEffectiveOwnerId();
  if (ownerError || !ownerId) {
    return { error: ownerError || "Unauthorized" };
  }

  const resolved = await resolveShopifyCredentials(supabase, ownerId);
  if ("error" in resolved) return { error: resolved.error };

  try {
    const catalog = await fetchCatalog(resolved.credentials);
    const candidates = await buildCandidates(supabase, ownerId, catalog);

    const statusById = new Map(
      candidates.map((candidate) => [candidate.shopifyId, candidate.status])
    );
    const catalogById = new Map(
      catalog.map((entry) => [parseShopifyGid(entry.product.id), entry])
    );

    const failures: UpsertFailure[] = [];
    let imported = 0;

    for (const shopifyId of selection.importIds) {
      const entry = catalogById.get(shopifyId);

      if (!entry) {
        // Deleted in Shopify between the preview and now. Skip it, report it,
        // keep going — one vanished product must not abandon the rest.
        failures.push({ shopifyId, reason: "no longer in Shopify" });
        continue;
      }

      const { error } = await upsertProduct(supabase, ownerId, entry);
      if (error) failures.push({ shopifyId, reason: error });
      else imported++;
    }

    // Exclusions are for declined NEW products only.
    //
    // Declining an update to a product already in the catalogue means "skip this
    // change", not "never import this product". Writing an exclusion for it
    // would banish an in-use product from every future preview — it would still
    // be sitting in the catalogue, now invisible to the sync that maintains it.
    const newlyExcluded = selection.excludeIds.filter(
      (shopifyId) => statusById.get(shopifyId) === "new"
    );

    if (newlyExcluded.length > 0) {
      const { error } = await supabase.from("shopify_product_exclusions").upsert(
        newlyExcluded.map((shopify_id) => ({ user_id: ownerId, shopify_id })),
        { onConflict: "user_id,shopify_id" }
      );
      if (error) throw new Error(`Could not record declined products: ${error.message}`);
    }

    // Importing a product un-ignores it — this is the un-ignore path (AC7).
    for (const ids of chunk(selection.importIds, ID_CHUNK_SIZE)) {
      const { error } = await supabase
        .from("shopify_product_exclusions")
        .delete()
        .eq("user_id", ownerId)
        .in("shopify_id", ids);
      if (error) throw new Error(`Could not clear declined products: ${error.message}`);
    }

    revalidatePath("/products");

    // `count` is what was actually WRITTEN, not what was asked for. The previous
    // implementation incremented past failed upserts and logged them to the
    // console, so the success message could claim fourteen products when it had
    // written twelve.
    return {
      success: true,
      count: imported,
      requested: selection.importIds.length,
      failures,
    };
  } catch (error) {
    console.error("Shopify sync error:", error);
    return {
      error: error instanceof Error ? error.message : "Failed to sync products",
    };
  }
}

export async function createProduct(data: {
  title: string;
  description?: string;
  sku?: string;
  price: number;
  image_url?: string;
}) {
  const supabase = await createClient();

  const { ownerId, error: ownerError } = await getEffectiveOwnerId();

  if (ownerError || !ownerId) {
    return { error: ownerError || "Unauthorized" };
  }

  const { data: product, error } = await supabase
    .from("products")
    .insert({
      user_id: ownerId,
      title: data.title,
      description: data.description || null,
      sku: data.sku || null,
      price: data.price,
      image_url: data.image_url || null,
    })
    .select()
    .single();

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/products");
  return { success: true, product };
}

export async function deleteProduct(productId: string) {
  const supabase = await createClient();

  const { ownerId, error: ownerError } = await getEffectiveOwnerId();

  if (ownerError || !ownerId) {
    return { error: ownerError || "Unauthorized" };
  }

  const { error } = await supabase
    .from("products")
    .delete()
    .eq("id", productId)
    .eq("user_id", ownerId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/products");
  return { success: true };
}

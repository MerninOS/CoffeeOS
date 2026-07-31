/**
 * Load the owner's ProductLookup — the two queries, the tenancy scope, and the
 * fail-loudly behaviour, in one testable place.
 *
 * This exists because the `.eq("user_id", ownerId)` below is load-bearing in a
 * way nothing else catches. Three owners share this database. Without that
 * filter the lookup is built from every tenant's catalogue, another owner's
 * product can resolve this owner's line item, and the page still renders, still
 * shows a plausible cost, and still typechecks. CoffeeOS#75 is that mistake
 * already paid for once, and until this extraction it was guarded by a comment.
 *
 * Inline in a server component there is nothing to call, so there was nothing to
 * test. That is the whole reason this is a module.
 */

import { buildProductLookup } from "@/lib/products/costing";
import type { ProductLookup } from "@/lib/orders/cogs";

/** What either query hands back, narrowed to the two fields this reads. */
type QueryResult = PromiseLike<{ data: unknown; error: { message: string } | null }>;

/**
 * The slice of the Supabase client this needs.
 *
 * Deliberately structural rather than importing `SupabaseClient`: the fake in
 * `tests/unit/load-lookup.spec.ts` records the filters applied, which is the
 * only way to assert the tenancy scope from a test. A nominal client type would
 * force the fake to reimplement the entire surface to check one `.eq()`.
 *
 * The real client is passed through `asLookupClient` below rather than being
 * assigned directly — see the note there.
 */
export interface LookupQueryClient {
  from(table: string): {
    select(columns: string): {
      eq(column: string, value: unknown): QueryResult;
      in(column: string, values: unknown[]): QueryResult;
    };
  };
}

/**
 * Adapt the real Supabase client to the slice above.
 *
 * Supabase's `from()` carries generics deep enough that checking it structurally
 * against `LookupQueryClient` exceeds TypeScript's instantiation depth
 * (TS2589) — the error is about the *checker*, not about the shapes actually
 * disagreeing at runtime. Confining the assertion to this one named function
 * keeps it out of the call site and makes it searchable, rather than scattering
 * `as unknown as` casts through page components.
 *
 * The runtime contract is still pinned: the fake in the unit test implements
 * `LookupQueryClient` nominally, so any change to the shape this function relies
 * on breaks that test.
 */
export function asLookupClient(client: unknown): LookupQueryClient {
  return client as LookupQueryClient;
}

/**
 * Build the owner's product lookup.
 *
 * Covers EVERY product the owner has, never just the ones a given order
 * references. `classifyOrder` tells "line item points at a product that no
 * longer exists" (unlinked) from "product exists but has no recipe" (uncosted)
 * purely by absence from this map — so a lookup narrowed to one order collapses
 * those two cases while still producing correct COGS for a costed order. Wrong
 * quietly, in the direction that matters.
 *
 * Throws rather than degrading. An empty lookup classifies every order
 * `unlinked` and makes the UI state, as fact, that the product was deleted — a
 * confident, specific, wrong diagnosis of a transient database error.
 */
export async function loadProductLookup(
  supabase: LookupQueryClient,
  ownerId: string,
): Promise<ProductLookup> {
  const { data: productsWithCogs, error: productsError } = await supabase
    .from("products")
    .select(`
      id,
      title,
      product_components (
        quantity,
        components (
          cost_per_unit
        )
      )
    `)
    // On THIS query, never inherited from a parent scope. See the note above.
    .eq("user_id", ownerId);

  if (productsError) {
    throw new Error(`Could not load product costs: ${productsError.message}`);
  }

  const products = (productsWithCogs || []) as Array<{ id: string }>;

  // A recipe can live at PRODUCT level or at VARIANT level, and this page read
  // only the first — the defect CoffeeOS#85 fixed for the list and CoffeeOS#100
  // fixes here. `order_line_items.shopify_variant_id` is null for 432 of 436
  // rows, so a line item cannot be matched to the variant that actually sold;
  // the cost is only KNOWABLE when it does not depend on that choice. The
  // agreement rule itself lives in buildProductLookup.
  //
  // Scoped by the product ids above, which are already owner-filtered — so this
  // query inherits the tenancy scope rather than restating it.
  const { data: variantRows, error: variantsError } = await supabase
    .from("product_variants")
    .select(`
      id,
      product_id,
      product_variant_components (
        quantity,
        components ( cost_per_unit )
      )
    `)
    .in("product_id", products.map((p) => p.id));

  if (variantsError) {
    throw new Error(`Could not load variant costs: ${variantsError.message}`);
  }

  return buildProductLookup(
    productsWithCogs as Parameters<typeof buildProductLookup>[0],
    variantRows as Parameters<typeof buildProductLookup>[1],
  );
}

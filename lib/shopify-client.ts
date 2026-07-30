/**
 * Shopify catalogue access, with an e2e fixture path.
 *
 * The sync runs inside a Next server action, so Playwright's page.route() cannot
 * intercept the Shopify call — the request never leaves the server. This module
 * is the seam: in fixture mode it serves a committed catalogue instead, letting
 * the e2e suite drive the real action against the real database.
 *
 * Every caller in app/ must import from HERE, not from ./shopify, or it silently
 * bypasses the fixture and tries to reach a live store during tests.
 */

import {
  fetchShopifyProducts as fetchShopifyProductsLive,
  fetchRemainingProductVariants as fetchRemainingProductVariantsLive,
  VARIANTS_PAGE_SIZE,
  type ShopifyConnection,
  type ShopifyProduct,
  type ShopifyVariant,
} from "./shopify";

/**
 * Two guards, deliberately.
 *
 * SHOPIFY_FIXTURE_MODE alone would be one stray environment variable away from
 * serving fake products to a real store's dashboard. The NODE_ENV check makes
 * that unreachable in a production build regardless of how the env is set.
 */
function usingFixtures(): boolean {
  const requested = process.env.SHOPIFY_FIXTURE_MODE === "1";

  // Fail loudly rather than quietly ignoring it. Silently serving real Shopify
  // data to something that asked for fixtures is confusing; silently serving
  // fixtures to a production dashboard is dangerous. Neither happens: the flag
  // being set in production is a configuration error and says so.
  if (requested && process.env.NODE_ENV === "production") {
    throw new Error(
      "SHOPIFY_FIXTURE_MODE is set in a production build. This would serve fixture " +
        "products in place of the real catalogue. Remove it from the environment."
    );
  }

  return requested;
}

/** The on-disk fixture shape. Variants are a flat array; this module paginates them. */
type FixtureProduct = {
  id: string;
  title: string;
  handle: string;
  description: string;
  vendor: string;
  productType: string;
  imageUrl: string | null;
  variants: ShopifyVariant[];
};

type FixtureCatalog = { products: FixtureProduct[] };

let fixtureCache: FixtureCatalog | null = null;

/**
 * Read via fs rather than `import`, so the fixture never becomes an import edge
 * from lib/ into tests/ and never lands in the production bundle.
 */
async function loadFixture(): Promise<FixtureCatalog> {
  if (fixtureCache) return fixtureCache;

  const { readFile } = await import("node:fs/promises");
  const { join } = await import("node:path");

  const path = join(process.cwd(), "tests", "fixtures", "shopify-catalog.json");
  fixtureCache = JSON.parse(await readFile(path, "utf8")) as FixtureCatalog;
  return fixtureCache;
}

/**
 * Cursors are array indices. Real Shopify cursors are opaque, and nothing may
 * depend on their contents — treating them as indices here is safe precisely
 * because callers only ever pass back what they were handed.
 */
function decodeCursor(cursor: string | undefined): number {
  if (!cursor) return 0;
  const index = Number(cursor);
  return Number.isFinite(index) && index >= 0 ? index : 0;
}

function toShopifyProduct(fixture: FixtureProduct): ShopifyProduct {
  const firstPage = fixture.variants.slice(0, VARIANTS_PAGE_SIZE);

  return {
    id: fixture.id,
    title: fixture.title,
    handle: fixture.handle,
    description: fixture.description,
    vendor: fixture.vendor,
    productType: fixture.productType,
    images: fixture.imageUrl
      ? { edges: [{ node: { url: fixture.imageUrl, altText: null } }] }
      : { edges: [] },
    variants: {
      edges: firstPage.map((node) => ({ node })),
      // Mirrors the live query's page size, so a fixture product with more than
      // VARIANTS_PAGE_SIZE variants exercises the same pagination branch that
      // production takes — which is the whole point of the 120-variant case.
      pageInfo: {
        hasNextPage: fixture.variants.length > VARIANTS_PAGE_SIZE,
        endCursor: String(Math.min(VARIANTS_PAGE_SIZE, fixture.variants.length)),
      },
    },
  };
}

export async function fetchShopifyProducts(
  storeDomain: string,
  accessToken: string,
  first = 50,
  after?: string
): Promise<ShopifyConnection<ShopifyProduct>> {
  if (!usingFixtures()) {
    return fetchShopifyProductsLive(storeDomain, accessToken, first, after);
  }

  const { products } = await loadFixture();
  const start = decodeCursor(after);
  const end = Math.min(start + first, products.length);
  const page = products.slice(start, end);

  return {
    edges: page.map((product, offset) => ({
      node: toShopifyProduct(product),
      cursor: String(start + offset + 1),
    })),
    pageInfo: {
      hasNextPage: end < products.length,
      hasPreviousPage: start > 0,
      startCursor: String(start),
      endCursor: String(end),
    },
  };
}

export async function fetchRemainingProductVariants(
  storeDomain: string,
  accessToken: string,
  productGid: string,
  after: string
): Promise<ShopifyVariant[]> {
  if (!usingFixtures()) {
    return fetchRemainingProductVariantsLive(storeDomain, accessToken, productGid, after);
  }

  const { products } = await loadFixture();
  const product = products.find((candidate) => candidate.id === productGid);

  // Matches the live path: a product that vanished mid-sync yields no variants
  // rather than throwing.
  if (!product) return [];

  return product.variants.slice(decodeCursor(after));
}

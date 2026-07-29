export interface ShopifyVariant {
  id: string;
  title: string;
  price: string;
  sku: string;
  inventoryQuantity: number;
}

export interface ShopifyProduct {
  id: string;
  title: string;
  handle: string;
  description: string;
  vendor: string;
  productType: string;
  updatedAt: string;
  images: {
    edges: Array<{
      node: {
        url: string;
        altText: string | null;
      };
    }>;
  };
  variants: {
    edges: Array<{
      node: ShopifyVariant;
    }>;
    // Callers MUST honour this. The sync deletes any stored variant absent from
    // the set it was handed, so treating a truncated first page as the whole
    // truth silently destroys the remainder. See fetchRemainingProductVariants.
    pageInfo: {
      hasNextPage: boolean;
      endCursor: string;
    };
  };
}

export interface ShopifyConnection<T> {
  edges: Array<{
    node: T;
    cursor: string;
  }>;
  pageInfo: {
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    startCursor: string;
    endCursor: string;
  };
}

// Shopify caps a nested connection at 250; 100 keeps the per-product cost of the
// catalogue query sane while covering all but a handful of products in one page.
// Anything past this is fetched by fetchRemainingProductVariants.
export const VARIANTS_PAGE_SIZE = 100;

const PRODUCTS_QUERY = `
  query getProducts($first: Int!, $after: String, $variantsFirst: Int!) {
    products(first: $first, after: $after) {
      edges {
        node {
          id
          title
          handle
          description
          vendor
          productType
          updatedAt
          images(first: 1) {
            edges {
              node {
                url
                altText
              }
            }
          }
          variants(first: $variantsFirst) {
            edges {
              node {
                id
                title
                price
                sku
                inventoryQuantity
              }
            }
            pageInfo {
              hasNextPage
              endCursor
            }
          }
        }
        cursor
      }
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
    }
  }
`;

const PRODUCT_VARIANTS_QUERY = `
  query getProductVariants($id: ID!, $first: Int!, $after: String) {
    product(id: $id) {
      variants(first: $first, after: $after) {
        edges {
          node {
            id
            title
            price
            sku
            inventoryQuantity
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  }
`;

export async function fetchShopifyProducts(
  storeDomain: string,
  accessToken: string,
  first = 50,
  after?: string
): Promise<ShopifyConnection<ShopifyProduct>> {
  // Use Admin API endpoint (OAuth tokens are admin tokens)
  const endpoint = `https://${storeDomain}/admin/api/2024-10/graphql.json`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": accessToken,
    },
    body: JSON.stringify({
      query: PRODUCTS_QUERY,
      variables: { first, after, variantsFirst: VARIANTS_PAGE_SIZE },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Shopify Admin API error: ${response.status} - ${text}`);
  }

  const data = await response.json();

  if (data.errors) {
    throw new Error(`Shopify GraphQL error: ${data.errors[0]?.message || "Unknown error"}`);
  }

  return data.data.products;
}

type ProductVariantsPage = {
  product: {
    variants: {
      edges: Array<{ node: ShopifyVariant }>;
      pageInfo: { hasNextPage: boolean; endCursor: string };
    };
  } | null;
};

/**
 * Fetch the variants past the first page for one product.
 *
 * The catalogue query returns only the first VARIANTS_PAGE_SIZE variants per
 * product. The sync treats the variant set it is given as authoritative and
 * deletes anything stored but absent from it, so a caller that ignores the
 * remainder will delete every variant past the page boundary on each run — then
 * recreate them on the next, which also makes the product read as "changed"
 * forever. Call this whenever product.variants.pageInfo.hasNextPage is true.
 */
export async function fetchRemainingProductVariants(
  storeDomain: string,
  accessToken: string,
  productGid: string,
  after: string
): Promise<ShopifyVariant[]> {
  const variants: ShopifyVariant[] = [];
  let cursor: string | undefined = after;
  let hasMore = true;

  while (hasMore) {
    const data: ProductVariantsPage = await shopifyAdminGraphql<ProductVariantsPage>(
      storeDomain,
      accessToken,
      PRODUCT_VARIANTS_QUERY,
      {
        id: productGid,
        first: VARIANTS_PAGE_SIZE,
        after: cursor,
      }
    );

    // The product was deleted between the catalogue page and this call. Return
    // what we have rather than throwing — the caller's upsert will simply skip it.
    if (!data.product) break;

    variants.push(...data.product.variants.edges.map((edge) => edge.node));
    hasMore = data.product.variants.pageInfo.hasNextPage;
    cursor = data.product.variants.pageInfo.endCursor;
  }

  return variants;
}

export function parseShopifyGid(gid: string): string {
  // Extract the numeric ID from Shopify's GID format
  // e.g., "gid://shopify/Product/123456789" -> "123456789"
  const match = gid.match(/\/(\d+)$/);
  return match ? match[1] : gid;
}

// Admin API types and functions for Orders
export interface ShopifyOrder {
  id: string;
  name: string;
  createdAt: string;
  displayFinancialStatus: string;
  displayFulfillmentStatus: string;
  totalPriceSet: {
    shopMoney: {
      amount: string;
      currencyCode: string;
    };
  };
  subtotalPriceSet: {
    shopMoney: {
      amount: string;
      currencyCode: string;
    };
  };
  totalShippingPriceSet: {
    shopMoney: {
      amount: string;
      currencyCode: string;
    };
  };
  totalTaxSet: {
    shopMoney: {
      amount: string;
      currencyCode: string;
    };
  };
  lineItems: {
    edges: Array<{
      node: {
        id: string;
        title: string;
        quantity: number;
        sku: string | null;
        product: {
          id: string;
        } | null;
        originalUnitPriceSet: {
          shopMoney: {
            amount: string;
            currencyCode: string;
          };
        };
        discountedUnitPriceSet: {
          shopMoney: {
            amount: string;
            currencyCode: string;
          };
        };
      };
    }>;
  };
}

const ORDERS_QUERY = `
  query getOrders($first: Int!, $after: String) {
    orders(first: $first, after: $after, sortKey: CREATED_AT, reverse: true) {
      edges {
        node {
          id
          name
          createdAt
          displayFinancialStatus
          displayFulfillmentStatus
          totalPriceSet {
            shopMoney {
              amount
              currencyCode
            }
          }
          subtotalPriceSet {
            shopMoney {
              amount
              currencyCode
            }
          }
          totalShippingPriceSet {
            shopMoney {
              amount
              currencyCode
            }
          }
          totalTaxSet {
            shopMoney {
              amount
              currencyCode
            }
          }
          lineItems(first: 50) {
            edges {
              node {
                id
                title
                quantity
                sku
                product {
                  id
                }
                originalUnitPriceSet {
                  shopMoney {
                    amount
                    currencyCode
                  }
                }
                discountedUnitPriceSet {
                  shopMoney {
                    amount
                    currencyCode
                  }
                }
              }
            }
          }
        }
        cursor
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

export async function fetchShopifyOrders(
  storeDomain: string,
  adminAccessToken: string,
  first = 50,
  after?: string
): Promise<{ orders: ShopifyOrder[]; pageInfo: { hasNextPage: boolean; endCursor: string } }> {
  // Admin API endpoint
  const endpoint = `https://${storeDomain}/admin/api/2024-10/graphql.json`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": adminAccessToken,
    },
    body: JSON.stringify({
      query: ORDERS_QUERY,
      variables: { first, after },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Shopify Admin API error: ${response.status} - ${text}`);
  }

  const data = await response.json();

  if (data.errors) {
    throw new Error(`Shopify GraphQL error: ${data.errors[0]?.message || "Unknown error"}`);
  }

  const orders = data.data.orders.edges.map((edge: { node: ShopifyOrder }) => edge.node);
  const pageInfo = data.data.orders.pageInfo;

  return { orders, pageInfo };
}

type ShopifyBillingStatus = "ACTIVE" | "FROZEN" | "PENDING" | "DECLINED" | "EXPIRED" | "CANCELLED";

export interface ShopifyAppSubscription {
  id: string;
  name: string;
  status: ShopifyBillingStatus;
  test: boolean;
  currentPeriodEnd: string | null;
}

const ACTIVE_SUBSCRIPTIONS_QUERY = `
  query getActiveSubscriptions {
    currentAppInstallation {
      activeSubscriptions {
        id
        name
        status
        test
        currentPeriodEnd
      }
    }
  }
`;

async function shopifyAdminGraphql<T>(
  storeDomain: string,
  adminAccessToken: string,
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const endpoint = `https://${storeDomain}/admin/api/2024-10/graphql.json`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": adminAccessToken,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Shopify Admin API error: ${response.status} - ${text}`);
  }

  const payload = await response.json();
  if (payload.errors?.length) {
    throw new Error(`Shopify GraphQL error: ${payload.errors[0]?.message || "Unknown error"}`);
  }

  return payload.data as T;
}

export async function getShopifyActiveSubscription(
  storeDomain: string,
  adminAccessToken: string
): Promise<ShopifyAppSubscription | null> {
  const data = await shopifyAdminGraphql<{
    currentAppInstallation: { activeSubscriptions: ShopifyAppSubscription[] | null } | null;
  }>(storeDomain, adminAccessToken, ACTIVE_SUBSCRIPTIONS_QUERY);

  const subscriptions = data.currentAppInstallation?.activeSubscriptions || [];
  if (!subscriptions.length) return null;

  const active = subscriptions.find((subscription) => subscription.status === "ACTIVE");
  return active || subscriptions[0] || null;
}

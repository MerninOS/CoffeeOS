export interface ShopifyProduct {
  id: string;
  title: string;
  handle: string;
  description: string;
  vendor: string;
  productType: string;
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
      node: {
        id: string;
        title: string;
        price: {
          amount: string;
          currencyCode: string;
        };
        sku: string;
        availableForSale: boolean;
      };
    }>;
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

const PRODUCTS_QUERY = `
  query getProducts($first: Int!, $after: String) {
    products(first: $first, after: $after) {
      edges {
        node {
          id
          title
          handle
          description
          vendor
          productType
          images(first: 1) {
            edges {
              node {
                url
                altText
              }
            }
          }
          variants(first: 10) {
            edges {
              node {
                id
                title
                price {
                  amount
                  currencyCode
                }
                sku
                availableForSale
              }
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

  return data.data.products;
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

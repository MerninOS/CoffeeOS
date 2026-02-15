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
        price: string;
        sku: string;
        inventoryQuantity: number;
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
                price
                sku
                inventoryQuantity
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

const CREATE_SUBSCRIPTION_MUTATION = `
  mutation createSubscription(
    $name: String!
    $returnUrl: URL!
    $lineItems: [AppSubscriptionLineItemInput!]!
    $test: Boolean
    $trialDays: Int
  ) {
    appSubscriptionCreate(
      name: $name
      returnUrl: $returnUrl
      lineItems: $lineItems
      test: $test
      trialDays: $trialDays
    ) {
      confirmationUrl
      appSubscription {
        id
        name
        status
        test
        currentPeriodEnd
      }
      userErrors {
        field
        message
      }
    }
  }
`;

export interface BillingPlanConfig {
  name: string;
  amount: number;
  currencyCode: string;
  interval: "EVERY_30_DAYS" | "ANNUAL";
  test: boolean;
  trialDays?: number;
}

export interface EnsureBillingResult {
  active: boolean;
  subscription?: ShopifyAppSubscription | null;
  confirmationUrl?: string | null;
}

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

export async function ensureShopifyBilling(
  storeDomain: string,
  adminAccessToken: string,
  returnUrl: string,
  plan: BillingPlanConfig
): Promise<EnsureBillingResult> {
  const existing = await getShopifyActiveSubscription(storeDomain, adminAccessToken);
  if (existing?.status === "ACTIVE") {
    return { active: true, subscription: existing };
  }

  const data = await shopifyAdminGraphql<{
    appSubscriptionCreate: {
      confirmationUrl: string | null;
      appSubscription: ShopifyAppSubscription | null;
      userErrors: Array<{ field: string[] | null; message: string }>;
    };
  }>(storeDomain, adminAccessToken, CREATE_SUBSCRIPTION_MUTATION, {
    name: plan.name,
    returnUrl,
    lineItems: [
      {
        plan: {
          appRecurringPricingDetails: {
            interval: plan.interval,
            price: {
              amount: plan.amount,
              currencyCode: plan.currencyCode,
            },
          },
        },
      },
    ],
    test: plan.test,
    trialDays: plan.trialDays,
  });

  const result = data.appSubscriptionCreate;
  if (result.userErrors?.length) {
    throw new Error(result.userErrors.map((error) => error.message).join("; "));
  }

  return {
    active: result.appSubscription?.status === "ACTIVE",
    subscription: result.appSubscription,
    confirmationUrl: result.confirmationUrl,
  };
}

import { redirect } from "next/navigation";

export default async function ShopifyAppEntryPage({
  searchParams,
}: {
  searchParams: Promise<{ shop?: string; host?: string }>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();

  if (params.shop) {
    query.set("shop", params.shop);
  }

  if (params.host) {
    query.set("host", params.host);
  }

  const destination = query.toString()
    ? `/api/shopify/install?${query.toString()}`
    : "/api/shopify/install";

  redirect(destination);
}


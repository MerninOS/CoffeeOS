import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Package, Layers, DollarSign, TrendingUp } from "lucide-react";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Fetch stats
  const [productsResult, componentsResult, productComponentsResult] = await Promise.all([
    supabase.from("products").select("id, price", { count: "exact" }),
    supabase.from("components").select("id", { count: "exact" }),
    supabase.from("product_components").select(`
      product_id,
      quantity,
      components (cost_per_unit)
    `),
  ]);

  const totalProducts = productsResult.count || 0;
  const totalComponents = componentsResult.count || 0;

  // Calculate COGS per product from product_components
  const productCogs: Record<string, number> = {};
  for (const pc of productComponentsResult.data || []) {
    const cost = (pc.quantity || 0) * ((pc.components as { cost_per_unit: number } | null)?.cost_per_unit || 0);
    productCogs[pc.product_id] = (productCogs[pc.product_id] || 0) + cost;
  }

  // Calculate average margin
  const products = productsResult.data || [];
  let avgMargin = 0;
  let totalRevenue = 0;

  if (products.length > 0) {
    const margins = products
      .filter((p) => p.price && productCogs[p.id] !== undefined)
      .map((p) => {
        const cogs = productCogs[p.id] || 0;
        const margin = ((p.price - cogs) / p.price) * 100;
        totalRevenue += p.price;
        return margin;
      });

    if (margins.length > 0) {
      avgMargin = margins.reduce((a, b) => a + b, 0) / margins.length;
    } else {
      // If no products have COGS assigned, just sum up prices
      totalRevenue = products.reduce((sum, p) => sum + (p.price || 0), 0);
    }
  }

  const stats = [
    {
      name: "Total Products",
      value: totalProducts.toString(),
      icon: Package,
      description: "Products imported from Shopify",
    },
    {
      name: "Total Components",
      value: totalComponents.toString(),
      icon: Layers,
      description: "Cost components defined",
    },
    {
      name: "Avg. Profit Margin",
      value: `${avgMargin.toFixed(1)}%`,
      icon: TrendingUp,
      description: "Across all products",
    },
    {
      name: "Total Catalog Value",
      value: `$${totalRevenue.toFixed(2)}`,
      icon: DollarSign,
      description: "Sum of selling prices",
    },
  ];

  const firstName = user?.user_metadata?.first_name || "there";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Welcome back, {firstName}
        </h1>
        <p className="text-muted-foreground">
          Here&apos;s an overview of your coffee product costs
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card className="shadow-md border-primary-foreground" key={stat.name}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.name}</CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground">{stat.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-0 border-primary-foreground shadow">
          <CardHeader>
            <CardTitle>Getting Started</CardTitle>
            <CardDescription>
              Follow these steps to set up your COGS tracking
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
                  1
                </div>
                <div>
                  <p className="font-medium">Connect your Shopify store</p>
                  <p className="text-sm text-muted-foreground">
                    Go to Settings to add your Shopify store domain and access
                    token
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
                  2
                </div>
                <div>
                  <p className="font-medium">Define your cost components</p>
                  <p className="text-sm text-muted-foreground">
                    Add components like packaging, labels, and raw materials
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
                  3
                </div>
                <div>
                  <p className="font-medium">Import and configure products</p>
                  <p className="text-sm text-muted-foreground">
                    Sync products from Shopify and assign cost components
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-primary-foreground shadow">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common tasks to manage your costs</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <a
                href="/products"
                className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-accent"
              >
                <Package className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">View Products</p>
                  <p className="text-sm text-muted-foreground">
                    Browse and manage your product catalog
                  </p>
                </div>
              </a>
              <a
                href="/components"
                className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-accent"
              >
                <Layers className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Manage Components</p>
                  <p className="text-sm text-muted-foreground">
                    Add or edit cost components
                  </p>
                </div>
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

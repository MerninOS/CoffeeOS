import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Package, Layers, DollarSign, TrendingUp, Warehouse, Flame, ShoppingCart, AlertTriangle } from "lucide-react";
import Link from "next/link";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Fetch stats
  const [productsResult, componentsResult, productComponentsResult, inventoryResult, ordersResult, batchesResult] = await Promise.all([
    supabase.from("products").select("id, price", { count: "exact" }).eq("user_id", user?.id),
    supabase.from("components").select("id", { count: "exact" }).eq("user_id", user?.id),
    supabase.from("product_components").select(`
      product_id,
      quantity,
      components (cost_per_unit)
    `),
    supabase.from("green_coffee_inventory").select("id, name, quantity_lbs, cost_per_lb").eq("user_id", user?.id),
    supabase.from("orders").select("id, total_price, status, created_at", { count: "exact" }).eq("user_id", user?.id),
    supabase.from("roasting_batches").select("id, sellable_g, created_at").eq("user_id", user?.id),
  ]);

  const totalProducts = productsResult.count || 0;
  const totalComponents = componentsResult.count || 0;
  const totalOrders = ordersResult.count || 0;

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

  // Calculate inventory stats
  const inventory = inventoryResult.data || [];
  const totalInventoryLbs = inventory.reduce((sum, c) => sum + c.quantity_lbs, 0);
  const totalInventoryValue = inventory.reduce((sum, c) => sum + (c.quantity_lbs * c.cost_per_lb), 0);
  const lowStockCoffees = inventory.filter((c) => c.quantity_lbs < 5);

  // Calculate roasting stats
  const batches = batchesResult.data || [];
  const totalRoastedG = batches.reduce((sum, b) => sum + (b.sellable_g || 0), 0);

  // Calculate order revenue
  const orders = ordersResult.data || [];
  const totalOrderRevenue = orders.reduce((sum, o) => sum + (o.total_price || 0), 0);
  const pendingOrders = orders.filter((o) => o.status === "pending" || o.status === "processing");

  const stats = [
    {
      name: "Green Coffee Inventory",
      value: `${totalInventoryLbs.toFixed(1)} lbs`,
      icon: Warehouse,
      description: `$${totalInventoryValue.toFixed(2)} total value`,
      href: "/inventory",
    },
    {
      name: "Total Roasted",
      value: `${(totalRoastedG / 1000).toFixed(1)} kg`,
      icon: Flame,
      description: `${batches.length} batches completed`,
      href: "/roasting",
    },
    {
      name: "Total Products",
      value: totalProducts.toString(),
      icon: Package,
      description: `${totalComponents} components defined`,
      href: "/products",
    },
    {
      name: "Order Revenue",
      value: `$${totalOrderRevenue.toFixed(2)}`,
      icon: ShoppingCart,
      description: `${totalOrders} total orders`,
      href: "/orders",
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
          <Link href={stat.href} key={stat.name}>
            <Card className="shadow-md border-primary-foreground hover:bg-accent/50 transition-colors cursor-pointer h-full">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.name}</CardTitle>
                <stat.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground">{stat.description}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Low Stock Warning */}
      {lowStockCoffees.length > 0 && (
        <Card className="border-amber-500/50 bg-amber-500/5">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
              Low Stock Alert
            </CardTitle>
            <CardDescription>
              The following coffees are running low (less than 5 lbs remaining)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {lowStockCoffees.map((coffee) => (
                <Link
                  key={coffee.id}
                  href="/inventory"
                  className="flex items-center justify-between rounded-lg border border-amber-500/30 bg-background p-3 transition-colors hover:bg-accent"
                >
                  <span className="font-medium">{coffee.name}</span>
                  <span className="text-sm text-amber-600 font-medium">
                    {coffee.quantity_lbs.toFixed(1)} lbs remaining
                  </span>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

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

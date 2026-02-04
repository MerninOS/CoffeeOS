"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SessionsClient, type Session } from "./sessions-client";
import { RoastRequestsClient } from "./roast-requests-client";
import { Flame, ClipboardList, Coffee, Package } from "lucide-react";

interface CoffeeInventory {
  id: string;
  name: string;
  origin: string;
  current_green_quantity_g: number;
}

interface RoastedCoffeeStock {
  id: string;
  name: string;
  origin: string;
  roasted_stock_g: number;
}

interface RoastRequest {
  id: string;
  coffee_inventory_id: string;
  requested_quantity_g: number;
  fulfilled_quantity_g: number;
  priority: "low" | "normal" | "high" | "urgent";
  status: "pending" | "in_progress" | "completed" | "cancelled";
  due_date: string | null;
  order_id: string | null;
  notes: string | null;
  created_at: string;
  green_coffee_inventory?: {
    name: string;
    origin: string;
  };
}

interface RoastingPageClientProps {
  initialSessions: Session[];
  roastRequests: RoastRequest[];
  coffeeInventory: CoffeeInventory[];
  roastedCoffeeStock: RoastedCoffeeStock[];
}

export function RoastingPageClient({
  initialSessions,
  roastRequests,
  coffeeInventory,
  roastedCoffeeStock,
}: RoastingPageClientProps) {
  const pendingRequestCount = roastRequests.filter(
    (r) => r.status === "pending" || r.status === "in_progress"
  ).length;

  const totalRoastedStock = roastedCoffeeStock.reduce(
    (sum, c) => sum + c.roasted_stock_g,
    0
  );

  const LBS_TO_GRAMS = 453.592;
  const gramsToLbs = (g: number) => (g / LBS_TO_GRAMS).toFixed(2);

  return (
    <div className="space-y-4 p-4 sm:space-y-6 sm:p-6">
      {/* Header - Condensed on mobile */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Roasting</h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          Manage sessions and roast requests
        </p>
      </div>

      {/* Roasted Coffee Stock */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Coffee className="h-5 w-5 text-amber-600" />
              <CardTitle className="text-lg">Roasted Coffee Stock</CardTitle>
            </div>
            <Badge variant="secondary" className="text-sm">
              {gramsToLbs(totalRoastedStock)} lbs total
            </Badge>
          </div>
          <CardDescription>
            Available roasted coffee ready for orders
          </CardDescription>
        </CardHeader>
        <CardContent>
          {roastedCoffeeStock.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <Package className="mb-2 h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No roasted coffee in stock. Complete roasting batches to build inventory.
              </p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {roastedCoffeeStock.map((coffee) => (
                <div
                  key={coffee.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{coffee.name}</p>
                    {coffee.origin && (
                      <p className="text-xs text-muted-foreground truncate">
                        {coffee.origin}
                      </p>
                    )}
                  </div>
                  <div className="ml-3 text-right shrink-0">
                    <p className="font-semibold text-amber-600">
                      {gramsToLbs(coffee.roasted_stock_g)} lbs
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {coffee.roasted_stock_g.toLocaleString()}g
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabs - Full width on mobile for better touch targets */}
      <Tabs defaultValue="sessions" className="space-y-4 sm:space-y-6">
        <TabsList className="w-full grid grid-cols-2 sm:w-fit sm:inline-flex">
          <TabsTrigger value="sessions" className="gap-2 flex-1 sm:flex-none">
            <Flame className="h-4 w-4" />
            <span>Sessions</span>
          </TabsTrigger>
          <TabsTrigger value="requests" className="gap-2 flex-1 sm:flex-none">
            <ClipboardList className="h-4 w-4" />
            <span>Requests</span>
            {pendingRequestCount > 0 && (
              <span className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                {pendingRequestCount}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sessions" className="mt-4 sm:mt-6">
          <SessionsClient initialSessions={initialSessions} hideHeader />
        </TabsContent>

        <TabsContent value="requests" className="mt-4 sm:mt-6">
          <RoastRequestsClient
            requests={roastRequests}
            coffeeInventory={coffeeInventory}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

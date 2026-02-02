"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SessionsClient, type Session } from "./sessions-client";
import { RoastRequestsClient } from "./roast-requests-client";
import { Flame, ClipboardList } from "lucide-react";

interface CoffeeInventory {
  id: string;
  name: string;
  origin: string;
  current_green_quantity_g: number;
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
}

export function RoastingPageClient({
  initialSessions,
  roastRequests,
  coffeeInventory,
}: RoastingPageClientProps) {
  const pendingRequestCount = roastRequests.filter(
    (r) => r.status === "pending" || r.status === "in_progress"
  ).length;

  return (
    <div className="space-y-4 p-4 sm:space-y-6 sm:p-6">
      {/* Header - Condensed on mobile */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Roasting</h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          Manage sessions and roast requests
        </p>
      </div>

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

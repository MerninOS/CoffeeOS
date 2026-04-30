"use client";

import { useSearchParams } from "next/navigation";
import { SessionsClient, type Session } from "./sessions-client";
import { RoastRequestsClient } from "./roast-requests-client";
import { Coffee, Package } from "lucide-react";

const LBS_TO_GRAMS = 453.592;
const gramsToLbs = (g: number) => (g / LBS_TO_GRAMS).toFixed(2);

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
  green_coffee_inventory?: { name: string; origin: string };
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
  const searchParams = useSearchParams();
  const activeTab = searchParams.get("tab") === "requests" ? "requests" : "sessions";

  const totalRoastedStock = roastedCoffeeStock.reduce(
    (sum, c) => sum + c.roasted_stock_g,
    0
  );

  return (
    <div className="p-6 space-y-6">
      {/* Roasted Coffee Stock */}
      <div className="bg-chalk border-[3px] border-espresso rounded-[16px] shadow-flat-md overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b-2 border-espresso bg-cream">
          <div className="flex items-center gap-2">
            <Coffee size={16} strokeWidth={2.2} className="text-honey" />
            <div className="font-extrabold text-sm uppercase tracking-[.08em] text-espresso">
              Roasted Coffee Stock
            </div>
          </div>
          <span className="inline-flex items-center px-2.5 py-1 rounded-full border-[2px] border-espresso bg-fog/50 text-[11px] font-extrabold text-espresso">
            {gramsToLbs(totalRoastedStock)} lbs total
          </span>
        </div>
        <div className="p-5">
          {roastedCoffeeStock.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <Package size={24} strokeWidth={1.5} className="text-espresso/30 mb-2" />
              <p className="text-[13px] text-espresso/50 font-medium">
                No roasted coffee in stock. Complete roasting batches to build inventory.
              </p>
            </div>
          ) : (
            <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {roastedCoffeeStock.map((coffee) => (
                <div
                  key={coffee.id}
                  className="flex items-center justify-between rounded-[10px] border-[2px] border-fog bg-cream px-4 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-bold text-espresso truncate">{coffee.name}</p>
                    {coffee.origin && (
                      <p className="text-[11px] text-espresso/50 font-medium truncate">{coffee.origin}</p>
                    )}
                  </div>
                  <div className="ml-3 text-right shrink-0">
                    <p className="text-[13px] font-extrabold text-honey">
                      {gramsToLbs(coffee.roasted_stock_g)} lbs
                    </p>
                    <p className="text-[10px] text-espresso/40 font-medium">
                      {coffee.roasted_stock_g.toLocaleString()}g
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {activeTab === "sessions" && (
        <SessionsClient initialSessions={initialSessions} hideHeader />
      )}
      {activeTab === "requests" && (
        <RoastRequestsClient requests={roastRequests} coffeeInventory={coffeeInventory} />
      )}
    </div>
  );
}

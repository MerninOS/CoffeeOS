/** Mirrors the `roast_requests` row shape inserted by
 *  scripts/seed-demo-account.mjs. Previously declared twice, incompatibly —
 *  roasting-page-client.tsx carried a stale copy naming columns that do not
 *  exist (coffee_inventory_id, requested_quantity_g), which tsc flagged as
 *  TS2719 and ignoreBuildErrors hid. */
export type RoastPriority = "low" | "normal" | "high" | "urgent";
export type RoastStatus = "pending" | "in_progress" | "fulfilled" | "cancelled";

export interface RoastRequest {
  id: string;
  green_coffee_id: string;
  coffee_name: string;
  requested_roasted_g: number;
  fulfilled_roasted_g: number;
  priority: RoastPriority;
  status: RoastStatus;
  due_date: string | null;
  order_id: string | null;
  notes: string | null;
  created_at: string;
  green_coffee_inventory?: { name: string; origin: string };
}

export interface CoffeeInventory {
  id: string;
  name: string;
  origin: string;
  current_green_quantity_g: number;
}

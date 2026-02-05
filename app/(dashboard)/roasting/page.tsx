import { createClient } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/team";
import { RoastingPageClient } from "./roasting-page-client";

export default async function RoastingSessionsPage() {
  const supabase = await createClient();
  const { ownerId } = await getEffectiveOwnerId();

  if (!ownerId) {
    return null;
  }

  // Fetch sessions with batch counts
  const { data: sessions } = await supabase
    .from("roasting_sessions")
    .select(`
      *,
      roasting_batches (
        id,
        green_weight_g,
        roasted_weight_g
      )
    `)
    .eq("user_id", ownerId)
    .order("session_date", { ascending: false });

  // Fetch roast requests with coffee info
  const { data: roastRequests } = await supabase
    .from("roast_requests")
    .select(`
      *,
      green_coffee_inventory (
        name,
        origin
      )
    `)
    .eq("user_id", ownerId)
    .order("created_at", { ascending: false });

  // Fetch coffee inventory for creating requests
  const { data: coffeeInventory } = await supabase
    .from("green_coffee_inventory")
    .select("id, name, origin, current_green_quantity_g, roasted_stock_g")
    .eq("user_id", ownerId)
    .order("name");

  // Fetch roasted coffee stock (coffee with roasted stock > 0)
  const roastedCoffeeStock = (coffeeInventory || [])
    .filter((c) => (c.roasted_stock_g || 0) > 0)
    .map((c) => ({
      id: c.id,
      name: c.name,
      origin: c.origin,
      roasted_stock_g: c.roasted_stock_g || 0,
    }));

  // Get only coffees with green stock for creating requests
  const coffeeWithGreenStock = (coffeeInventory || [])
    .filter((c) => c.current_green_quantity_g > 0);

  // Transform data to include batch stats
  const sessionsWithStats = (sessions || []).map((session) => {
    const batches = session.roasting_batches || [];
    const totalGreenWeightG = batches.reduce(
      (sum: number, b: { green_weight_g: number | null }) => sum + (b.green_weight_g || 0),
      0
    );
    const totalRoastedWeightG = batches.reduce(
      (sum: number, b: { roasted_weight_g: number | null }) => sum + (b.roasted_weight_g || 0),
      0
    );

    return {
      id: session.id,
      session_date: session.session_date,
      vendor_name: session.vendor_name,
      rate_per_hour: session.rate_per_hour,
      setup_minutes: session.setup_minutes,
      cleanup_minutes: session.cleanup_minutes,
      billing_granularity_minutes: session.billing_granularity_minutes,
      allocation_mode: session.allocation_mode,
      billable_minutes: session.billable_minutes,
      session_toll_cost: session.session_toll_cost,
      notes: session.notes,
      created_at: session.created_at,
      batch_count: batches.length,
      total_green_weight_g: totalGreenWeightG,
      total_roasted_weight_g: totalRoastedWeightG,
    };
  });

  return (
    <RoastingPageClient
      initialSessions={sessionsWithStats}
      roastRequests={roastRequests || []}
      coffeeInventory={coffeeWithGreenStock}
      roastedCoffeeStock={roastedCoffeeStock}
    />
  );
}

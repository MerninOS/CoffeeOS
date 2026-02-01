import { createClient } from "@/lib/supabase/server";
import { RoastingPageClient } from "./roasting-page-client";

export default async function RoastingSessionsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

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
    .eq("user_id", user?.id)
    .order("created_at", { ascending: false });

  // Fetch coffee inventory for creating requests
  const { data: coffeeInventory } = await supabase
    .from("green_coffee_inventory")
    .select("id, name, origin, current_green_quantity_g")
    .eq("user_id", user?.id)
    .gt("current_green_quantity_g", 0)
    .order("name");

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
      coffeeInventory={coffeeInventory || []}
    />
  );
}

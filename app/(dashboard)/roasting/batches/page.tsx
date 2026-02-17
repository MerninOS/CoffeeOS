import { createClient } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/team";
import { BatchesClient } from "./batches-client";

export default async function BatchesPage() {
  const supabase = await createClient();
  const { ownerId } = await getEffectiveOwnerId();

  // Fetch all batches with session info
  const { data: batches } = await supabase
    .from("roasting_batches")
    .select(`
      *,
      roasting_sessions (
        id,
        session_date,
        vendor_name,
        rate_per_hour,
        cost_mode,
        machine_energy_kwh_per_hour,
        kwh_rate,
        setup_minutes,
        cleanup_minutes,
        billing_granularity_minutes,
        session_toll_cost
      ),
      components (
        id,
        name
      )
    `)
    .eq("user_id", ownerId!)
    .order("batch_date", { ascending: false });

  // Fetch existing ingredient components for adding to
  const { data: existingComponents } = await supabase
    .from("components")
    .select("id, name, cost_per_unit, unit, type")
    .eq("user_id", ownerId!)
    .eq("type", "ingredient")
    .eq("unit", "g")
    .order("name");

  return (
    <BatchesClient
      initialBatches={batches || []}
      existingComponents={existingComponents || []}
    />
  );
}

import { createClient } from "@/lib/supabase/server";
import { BatchesClient } from "./batches-client";

export default async function BatchesPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Fetch all batches with session info
  const { data: batches } = await supabase
    .from("roasting_batches")
    .select(`
      *,
      roasting_sessions (
        id,
        session_date,
        vendor_name
      ),
      components (
        id,
        name
      )
    `)
    .order("batch_date", { ascending: false });

  // Fetch existing ingredient components for adding to
  const { data: existingComponents } = await supabase
    .from("components")
    .select("id, name, cost_per_unit, unit, type")
    .eq("user_id", user?.id)
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

import { createClient } from "@/lib/supabase/server";
import { BatchesClient } from "./batches-client";

export default async function BatchesPage() {
  const supabase = await createClient();

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

  return <BatchesClient initialBatches={batches || []} />;
}

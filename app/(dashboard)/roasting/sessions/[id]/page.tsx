import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { SessionDetailClient } from "./session-detail-client";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function SessionDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    notFound();
  }

  // Fetch session with batches
  const { data: session } = await supabase
    .from("roasting_sessions")
    .select(`
      *,
      roasting_batches (
        *,
        components (id, name)
      )
    `)
    .eq("id", id)
    .single();

  if (!session) {
    notFound();
  }

  // Fetch green coffee inventory for selection (only show coffees with stock)
  const { data: coffeeInventory } = await supabase
    .from("green_coffee_inventory")
    .select("id, name, origin, lot_code, supplier, price_per_lb, current_green_quantity_g")
    .eq("user_id", user.id)
    .gt("current_green_quantity_g", 0)
    .order("name");

  // Fetch pending roast requests to allow fulfilling them
  const { data: pendingRequests } = await supabase
    .from("roast_requests")
    .select(`
      *,
      green_coffee_inventory (
        name,
        origin
      )
    `)
    .eq("user_id", user.id)
    .in("status", ["pending", "in_progress"])
    .order("priority", { ascending: true })
    .order("due_date", { ascending: true });

  return (
    <SessionDetailClient
      session={session}
      batches={session.roasting_batches || []}
      coffeeInventory={coffeeInventory || []}
      pendingRequests={pendingRequests || []}
    />
  );
}

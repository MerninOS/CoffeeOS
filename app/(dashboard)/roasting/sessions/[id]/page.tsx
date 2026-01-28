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

  // Fetch green coffee inventory for selection
  const { data: coffeeInventory } = await supabase
    .from("green_coffee_inventory")
    .select("*")
    .eq("user_id", user.id)
    .gt("quantity_lbs", 0)
    .order("name");

  return (
    <SessionDetailClient
      session={session}
      batches={session.roasting_batches || []}
      coffeeInventory={coffeeInventory || []}
    />
  );
}

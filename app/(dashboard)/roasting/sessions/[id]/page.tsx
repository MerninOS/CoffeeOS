import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { SessionDetailClient } from "./session-detail-client";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function SessionDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

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

  return (
    <SessionDetailClient
      session={session}
      batches={session.roasting_batches || []}
    />
  );
}

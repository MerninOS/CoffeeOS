import { createClient } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/team";
import { ComponentsClient } from "./components-client";

export default async function ComponentsPage() {
  const supabase = await createClient();
  const { ownerId } = await getEffectiveOwnerId();

  const { data: components } = await supabase
    .from("components")
    .select("*")
    .eq("user_id", ownerId!)
    .order("type")
    .order("name");

  return <ComponentsClient initialComponents={components || []} />;
}

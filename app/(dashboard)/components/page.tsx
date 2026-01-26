import { createClient } from "@/lib/supabase/server";
import { ComponentsClient } from "./components-client";

export default async function ComponentsPage() {
  const supabase = await createClient();

  const { data: components } = await supabase
    .from("components")
    .select("*")
    .order("type")
    .order("name");

  return <ComponentsClient initialComponents={components || []} />;
}

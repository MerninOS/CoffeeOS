import { createClient } from "@/lib/supabase/server";
import { InventoryClient } from "./inventory-client";

export default async function InventoryPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: inventory } = await supabase
    .from("green_coffee_inventory")
    .select("*")
    .eq("user_id", user.id)
    .order("name");

  return <InventoryClient initialInventory={inventory || []} />;
}

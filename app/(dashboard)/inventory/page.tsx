import { createClient } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/team";
import { InventoryClient } from "./inventory-client";

export default async function InventoryPage() {
  const supabase = await createClient();
  const { ownerId } = await getEffectiveOwnerId();

  if (!ownerId) {
    return null;
  }

  const { data: inventory } = await supabase
    .from("green_coffee_inventory")
    .select("*")
    .eq("user_id", ownerId)
    .order("name");

  return <InventoryClient initialInventory={inventory || []} />;
}

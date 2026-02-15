import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/team";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { ownerId, role } = await getEffectiveOwnerId();
  const canSeeOnboarding = role === "owner" || role === "admin";

  if (!ownerId || !canSeeOnboarding) {
    return NextResponse.json({ status: null });
  }

  const [
    shopifySettingsResult,
    inventoryCountResult,
    roastingCountResult,
    componentsCountResult,
    roastedComponentCountResult,
    productComponentsCountResult,
  ] = await Promise.all([
    supabase
      .from("shopify_settings")
      .select("connected_via_oauth, admin_access_token")
      .eq("user_id", ownerId)
      .maybeSingle(),
    supabase
      .from("green_coffee_inventory")
      .select("id", { count: "exact", head: true })
      .eq("user_id", ownerId),
    supabase
      .from("roasting_batches")
      .select("id", { count: "exact", head: true })
      .eq("user_id", ownerId),
    supabase
      .from("components")
      .select("id", { count: "exact", head: true })
      .eq("user_id", ownerId),
    supabase
      .from("components")
      .select("id", { count: "exact", head: true })
      .eq("user_id", ownerId)
      .eq("type", "ingredient")
      .or("name.ilike.%roasted coffee%,name.ilike.%roasted%,notes.ilike.%roasted%"),
    supabase.from("product_components").select("id", { count: "exact", head: true }),
  ]);

  return NextResponse.json({
    status: {
      hasShopifyConnection: !!(
        shopifySettingsResult.data?.connected_via_oauth &&
        shopifySettingsResult.data?.admin_access_token
      ),
      hasGreenCoffeeInventory: (inventoryCountResult.count || 0) > 0,
      hasRoastingActivity: (roastingCountResult.count || 0) > 0,
      hasComponents: (componentsCountResult.count || 0) > 0,
      hasRoastedCoffeeComponent: (roastedComponentCountResult.count || 0) > 0,
      hasProductCogs: (productComponentsCountResult.count || 0) > 0,
    },
  });
}

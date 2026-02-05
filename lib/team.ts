import { createClient } from "@/lib/supabase/server";

/**
 * Resolves the effective owner ID for data access.
 * - If the user is an owner, returns their own ID.
 * - If the user is a team member (admin/roaster), returns their owner_id.
 * This is used to scope all data queries to the correct workspace.
 */
export async function getEffectiveOwnerId(): Promise<{
  ownerId: string | null;
  userId: string | null;
  role: string | null;
  error?: string;
}> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ownerId: null, userId: null, role: null, error: "Unauthorized" };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, owner_id")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return { ownerId: user.id, userId: user.id, role: "owner" };
  }

  const role = profile.role || "owner";
  const ownerId = role === "owner" ? user.id : profile.owner_id;

  return {
    ownerId: ownerId || user.id,
    userId: user.id,
    role,
  };
}

/**
 * Checks if a user role has access to a specific feature.
 */
export function hasAccess(role: string, feature: "dashboard" | "products" | "orders" | "roasting" | "inventory" | "components" | "settings" | "team"): boolean {
  const roasterFeatures = ["roasting", "inventory", "settings"];
  const adminFeatures = ["dashboard", "products", "orders", "roasting", "inventory", "components", "settings", "team"];

  switch (role) {
    case "owner":
      return true;
    case "admin":
      return adminFeatures.includes(feature);
    case "roaster":
      return roasterFeatures.includes(feature);
    default:
      return false;
  }
}

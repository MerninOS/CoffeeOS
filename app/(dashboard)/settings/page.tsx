import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SettingsClient } from "./settings-client";
import { TeamManagement } from "./team-management";
import { InvitationBanner } from "./invitation-banner";

export default async function SettingsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  // Get profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const userRole = profile?.role || "owner";
  const isOwner = userRole === "owner";
  const isAdmin = userRole === "admin";
  const canManageTeam = isOwner || isAdmin;

  // Resolve owner_id for data access
  const ownerId = isOwner ? user.id : profile?.owner_id;

  // Get Shopify settings if owner or admin
  let shopifySettings = null;
  if ((isOwner || isAdmin) && ownerId) {
    const { data } = await supabase
      .from("shopify_settings")
      .select("store_domain, shop_name, access_token, admin_access_token, connected_via_oauth, oauth_scope, billing_status, billing_plan_name, billing_current_period_end, billing_test")
      .eq("user_id", ownerId)
      .single();
    shopifySettings = data ? {
      store_domain: data.store_domain,
      shop_name: data.shop_name,
      connected_via_oauth: data.connected_via_oauth,
      oauth_scope: data.oauth_scope,
      has_storefront_token: !!data.access_token,
      has_admin_credentials: !!data.admin_access_token,
      billing_status: data.billing_status,
      billing_plan_name: data.billing_plan_name,
      billing_current_period_end: data.billing_current_period_end,
      billing_test: data.billing_test,
    } : null;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account and integrations
        </p>
      </div>

      {/* Pending invitation banner for invited users */}
      <InvitationBanner />

      <SettingsClient
        user={{
          email: user.email || "",
          firstName: profile?.first_name || user.user_metadata?.first_name || "",
          lastName: profile?.last_name || user.user_metadata?.last_name || "",
        }}
        userRole={userRole}
        isOwner={isOwner}
        shopifySettings={shopifySettings}
      />

      {/* Team Management - visible to owners and admins */}
      {canManageTeam && (
        <TeamManagement currentUserId={user.id} isOwner={isOwner} />
      )}
    </div>
  );
}

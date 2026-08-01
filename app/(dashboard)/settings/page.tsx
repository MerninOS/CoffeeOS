import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { toShopifySettings } from "@/lib/settings/status";
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
      .select("*")
      .eq("user_id", ownerId)
      .maybeSingle();
    shopifySettings = toShopifySettings(data);
  }

  /* Team counts for the workspace hero, resolved on the SERVER.
     TeamManagement fetches the same lists client-side on mount, but the hero
     must not wait for that — a strip that renders "Members —" and then jumps is
     worse than one that renders once, and the counts are cheap. */
  let memberCount = 0;
  let invitedCount = 0;
  if (canManageTeam && ownerId) {
    const [members, invitations] = await Promise.all([
      supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .or(`id.eq.${ownerId},owner_id.eq.${ownerId}`),
      supabase
        .from("team_invitations")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", ownerId)
        .is("accepted_at", null)
        .gt("expires_at", new Date().toISOString()),
    ]);
    memberCount = members.count ?? 0;
    invitedCount = invitations.count ?? 0;
  }

  return (
    /* pb-28 clears the onboarding tour widget, which is `fixed bottom-4 right-4
       z-50` on every dashboard route and keeps that corner even when dismissed —
       dismissing collapses it to a "Show Onboarding" pill in the same place. The
       converted page is short enough that its last row lands there, and the
       widget then intercepts the pointer events for whatever sits underneath.
       The general fix belongs in the dashboard layout; this keeps THIS page's
       actions clickable. */
    <div data-settings-page className="flex flex-col min-h-full pb-28">
      <div className="px-6 pt-6 space-y-4">
        <div>
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontVariationSettings: "var(--display-settings)",
              fontWeight: "var(--display-weight)" as unknown as number,
              letterSpacing: "var(--display-tracking)",
              fontSize: "var(--fs-display)",
              lineHeight: "var(--lh-tight)",
              textTransform: "uppercase",
              color: "var(--ink)",
            }}
          >
            Settings
          </h1>
          <p
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "var(--fs-body)",
              color: "var(--ink-muted)",
              marginTop: 4,
            }}
          >
            Manage your account and integrations
          </p>
        </div>
      </div>

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
        memberCount={memberCount}
        invitedCount={invitedCount}
      />

      {canManageTeam && (
        <div className="px-6 pb-6">
          <TeamManagement currentUserId={user.id} isOwner={isOwner} />
        </div>
      )}
    </div>
  );
}

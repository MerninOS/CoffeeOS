"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import crypto from "crypto";

export async function getTeamMembers() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Unauthorized" };
  }

  // Get current user's profile to determine owner context
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, owner_id")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return { error: "Profile not found" };
  }

  // Only owners and admins can view team
  if (!["owner", "admin"].includes(profile.role)) {
    return { error: "Insufficient permissions" };
  }

  const ownerId = profile.role === "owner" ? user.id : profile.owner_id;

  if (!ownerId) {
    return { error: "No team context found" };
  }

  // Fetch all team members (profiles linked to this owner + the owner)
  const { data: members, error } = await supabase
    .from("profiles")
    .select("id, email, first_name, last_name, role, created_at")
    .or(`id.eq.${ownerId},owner_id.eq.${ownerId}`)
    .order("created_at", { ascending: true });

  if (error) {
    return { error: error.message };
  }

  return { members: members || [] };
}

export async function getPendingInvitations() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Unauthorized" };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, owner_id")
    .eq("id", user.id)
    .single();

  if (!profile || !["owner", "admin"].includes(profile.role)) {
    return { error: "Insufficient permissions" };
  }

  const ownerId = profile.role === "owner" ? user.id : profile.owner_id;

  // Pending = accepted_at is null and not expired
  const { data: invitations, error } = await supabase
    .from("team_invitations")
    .select("*")
    .eq("owner_id", ownerId)
    .is("accepted_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });

  if (error) {
    return { error: error.message };
  }

  return { invitations: invitations || [] };
}

export async function inviteTeamMember(email: string, role: "admin" | "roaster") {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Unauthorized" };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, owner_id")
    .eq("id", user.id)
    .single();

  if (!profile || !["owner", "admin"].includes(profile.role)) {
    return { error: "Only owners and admins can invite team members" };
  }

  const ownerId = profile.role === "owner" ? user.id : profile.owner_id;

  if (!ownerId) {
    return { error: "No team context found" };
  }

  // Check if there's already a pending invitation for this email
  const { data: existingInvite } = await supabase
    .from("team_invitations")
    .select("id")
    .eq("email", email.toLowerCase())
    .eq("owner_id", ownerId)
    .is("accepted_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (existingInvite) {
    return { error: "An invitation is already pending for this email" };
  }

  // Generate a unique token
  const token = crypto.randomBytes(32).toString("hex");

  // Create the invitation using the actual table schema
  const { error } = await supabase.from("team_invitations").upsert(
    {
      owner_id: ownerId,
      email: email.toLowerCase(),
      role,
      token,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    },
    { onConflict: "owner_id,email" }
  );

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/settings");

  return {
    success: true,
    message: `Invitation created for ${email}. They will need to sign up and accept the invitation from their Settings page.`,
  };
}

export async function cancelInvitation(invitationId: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Unauthorized" };
  }

  // Delete the invitation (owner_id check handled by RLS)
  const { error } = await supabase
    .from("team_invitations")
    .delete()
    .eq("id", invitationId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/settings");

  return { success: true };
}

export async function updateTeamMemberRole(memberId: string, newRole: "admin" | "roaster") {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Unauthorized" };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  // Only owners can change roles
  if (profile?.role !== "owner") {
    return { error: "Only the owner can change team member roles" };
  }

  // Can't change own role
  if (memberId === user.id) {
    return { error: "You cannot change your own role" };
  }

  // Verify the member belongs to this owner
  const { data: member } = await supabase
    .from("profiles")
    .select("owner_id")
    .eq("id", memberId)
    .single();

  if (!member || member.owner_id !== user.id) {
    return { error: "Member not found in your team" };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ role: newRole })
    .eq("id", memberId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/settings");

  return { success: true };
}

export async function removeTeamMember(memberId: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Unauthorized" };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!["owner", "admin"].includes(profile?.role || "")) {
    return { error: "Insufficient permissions" };
  }

  // Can't remove self
  if (memberId === user.id) {
    return { error: "You cannot remove yourself" };
  }

  // For admins, they can only remove roasters
  if (profile?.role === "admin") {
    const { data: target } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", memberId)
      .single();

    if (target?.role !== "roaster") {
      return { error: "Admins can only remove roasters" };
    }
  }

  // Unlink the member (set owner_id to null, role back to owner so they can use the app independently)
  const { error } = await supabase
    .from("profiles")
    .update({ owner_id: null, role: "owner" })
    .eq("id", memberId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/settings");

  return { success: true };
}

export async function acceptInvitation(invitationId: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Unauthorized" };
  }

  // Get the invitation - pending means accepted_at is null
  const { data: invitation } = await supabase
    .from("team_invitations")
    .select("*")
    .eq("id", invitationId)
    .eq("email", user.email?.toLowerCase())
    .is("accepted_at", null)
    .single();

  if (!invitation) {
    return { error: "Invitation not found or already used" };
  }

  // Check if expired
  if (new Date(invitation.expires_at) < new Date()) {
    return { error: "This invitation has expired" };
  }

  // Update the user's profile to link to the owner
  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      role: invitation.role,
      owner_id: invitation.owner_id,
    })
    .eq("id", user.id);

  if (profileError) {
    return { error: profileError.message };
  }

  // Mark invitation as accepted
  const { error: inviteError } = await supabase
    .from("team_invitations")
    .update({
      accepted_at: new Date().toISOString(),
    })
    .eq("id", invitationId);

  if (inviteError) {
    return { error: inviteError.message };
  }

  revalidatePath("/settings");
  revalidatePath("/dashboard");

  return { success: true };
}

export async function getMyPendingInvitations() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Unauthorized" };
  }

  // Pending = accepted_at is null and not expired
  const { data: invitations, error } = await supabase
    .from("team_invitations")
    .select("*")
    .eq("email", user.email?.toLowerCase())
    .is("accepted_at", null)
    .gt("expires_at", new Date().toISOString());

  if (error) {
    return { error: error.message };
  }

  // Look up inviter (owner) names separately from profiles
  const ownerIds = [...new Set((invitations || []).map((i) => i.owner_id))];
  const inviterMap: Record<string, { first_name: string; last_name: string }> = {};

  if (ownerIds.length > 0) {
    const { data: inviters } = await supabase
      .from("profiles")
      .select("id, first_name, last_name")
      .in("id", ownerIds);

    if (inviters) {
      for (const inviter of inviters) {
        inviterMap[inviter.id] = {
          first_name: inviter.first_name,
          last_name: inviter.last_name,
        };
      }
    }
  }

  const invitationsWithNames = (invitations || []).map((inv) => ({
    ...inv,
    inviter_name: inviterMap[inv.owner_id]
      ? `${inviterMap[inv.owner_id].first_name || ""} ${inviterMap[inv.owner_id].last_name || ""}`.trim() || "Team Owner"
      : "Team Owner",
  }));

  return { invitations: invitationsWithNames };
}

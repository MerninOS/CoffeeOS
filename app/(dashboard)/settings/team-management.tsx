"use client";

import React, { useState, useEffect } from "react";
import {
  inviteTeamMember,
  getTeamMembers,
  getPendingInvitations,
  updateTeamMemberRole,
  removeTeamMember,
  cancelInvitation,
} from "./team-actions";
import { InlineBanner } from "@merninos/ui/instrument";
import { InviteRow } from "./components/InviteRow";
import { Section } from "./components/Section";
import { TeamWorksheetTable } from "./components/TeamWorksheetTable";

interface TeamMember {
  id: string;
  first_name: string;
  last_name: string;
  role: string;
  email: string;
  created_at: string;
}

interface Invitation {
  id: string;
  email: string;
  role: string;
  status: string;
  created_at: string;
  expires_at: string;
}

interface TeamManagementProps {
  currentUserId: string;
  isOwner: boolean;
}

// ── Main component ───────────────────────────────────────────────────────────

export function TeamManagement({ currentUserId, isOwner }: TeamManagementProps) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "roaster">("roaster");
  const [isInviting, setIsInviting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadTeamData = async () => {
    setIsLoading(true);
    const [membersResult, invitationsResult] = await Promise.all([
      getTeamMembers(),
      getPendingInvitations(),
    ]);
    if (membersResult.members) setMembers(membersResult.members);
    if (invitationsResult.invitations) setInvitations(invitationsResult.invitations);
    setIsLoading(false);
  };

  useEffect(() => { loadTeamData(); }, []);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setIsInviting(true);
    setMessage(null);
    const result = await inviteTeamMember(inviteEmail.trim(), inviteRole);
    if (result.error) {
      setMessage({ type: "error", text: result.error });
    } else {
      setMessage({ type: "success", text: result.message || "Invitation sent" });
      setInviteEmail("");
      loadTeamData();
    }
    setIsInviting(false);
  };

  const handleRoleChange = async (memberId: string, newRole: "admin" | "roaster") => {
    setMessage(null);
    const result = await updateTeamMemberRole(memberId, newRole);
    if (result.error) {
      setMessage({ type: "error", text: result.error });
    } else {
      setMessage({ type: "success", text: "Role updated successfully" });
      loadTeamData();
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    setMessage(null);
    const result = await removeTeamMember(memberId);
    if (result.error) {
      setMessage({ type: "error", text: result.error });
    } else {
      setMessage({ type: "success", text: "Team member removed" });
      loadTeamData();
    }
  };

  const handleCancelInvitation = async (invitationId: string) => {
    setMessage(null);
    const result = await cancelInvitation(invitationId);
    if (result.error) {
      setMessage({ type: "error", text: result.error });
    } else {
      setMessage({ type: "success", text: "Invitation cancelled" });
      loadTeamData();
    }
  };


  return (
    <Section title="Team" meta={`${members.length} members · ${invitations.length} invited`}>
      {message && (
        <InlineBanner
          tone={message.type === "error" ? "danger" : "success"}
          style={{ marginTop: 14 }}
        >
          {message.text}
        </InlineBanner>
      )}

      <TeamWorksheetTable
        members={members}
        invitations={invitations}
        currentUserId={currentUserId}
        isOwner={isOwner}
        isLoading={isLoading}
        onRoleChange={handleRoleChange}
        onRemoveMember={handleRemoveMember}
        onCancelInvitation={handleCancelInvitation}
      />

      <InviteRow
        inviteEmail={inviteEmail}
        setInviteEmail={setInviteEmail}
        inviteRole={inviteRole}
        setInviteRole={setInviteRole}
        isInviting={isInviting}
        onSubmit={handleInvite}
      />
    </Section>
  );
}

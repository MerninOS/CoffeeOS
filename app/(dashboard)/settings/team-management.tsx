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
import { InviteRow } from "./components/InviteRow";
import { RolePill } from "./components/RolePill";
import { TeamWorksheetTable } from "./components/TeamWorksheetTable";
import { AlertCircle, CheckCircle2, Users } from "lucide-react";

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

  const getRoleDescription = (role: string) => {
    switch (role) {
      case "owner": return "Full access to everything";
      case "admin": return "Full access to all features";
      case "roaster": return "Roasting & Inventory only";
      default: return "";
    }
  };

  return (
    <div className="bg-chalk border-[3px] border-espresso rounded-[20px] shadow-[5px_5px_0_#1C0F05] overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-5 py-4 border-b-[2.5px] border-dashed border-fog">
        <Users className="h-5 w-5 text-espresso/60" />
        <div>
          <h2 className="font-body font-extrabold text-sm uppercase tracking-widest text-espresso leading-none">
            Team Members
          </h2>
          <p className="mt-0.5 text-xs text-espresso/50 font-body">
            Manage who has access to your CoffeeOS workspace
          </p>
        </div>
      </div>

      <div className="px-5 py-5 space-y-6">
        {/* Message */}
        {message && (
          <div
            className={`flex items-center gap-2 rounded-xl border-[2.5px] p-3 text-sm font-body font-bold ${
              message.type === "error"
                ? "bg-tomato/10 border-tomato text-tomato"
                : "bg-matcha/10 border-matcha text-matcha"
            }`}
          >
            {message.type === "error" ? (
              <AlertCircle className="h-4 w-4 shrink-0" />
            ) : (
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            )}
            {message.text}
          </div>
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
        {/* Role Legend */}
        <div className="bg-fog/20 border-[2px] border-fog rounded-[14px] px-4 py-3 space-y-2">
          <p className="text-[0.65rem] font-extrabold uppercase tracking-widest text-espresso/50 font-body">
            Role Permissions
          </p>
          <div className="space-y-1.5">
            {[
              { role: "admin", desc: "Full access to all features" },
              { role: "roaster", desc: "Roasting & Inventory only" },
            ].map(({ role, desc }) => (
              <div key={role} className="flex items-center gap-3">
                <RolePill role={role} />
                <span className="text-xs text-espresso/50 font-body">{desc}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <InviteRow
        inviteEmail={inviteEmail}
        setInviteEmail={setInviteEmail}
        inviteRole={inviteRole}
        setInviteRole={setInviteRole}
        isInviting={isInviting}
        onSubmit={handleInvite}
      />
    </div>
  );
}

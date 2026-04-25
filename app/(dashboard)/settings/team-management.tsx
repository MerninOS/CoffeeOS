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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  AlertCircle,
  CheckCircle2,
  Crown,
  Loader2,
  Mail,
  Shield,
  Flame,
  Trash2,
  UserPlus,
  Users,
  Clock,
  X,
} from "lucide-react";

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

// ── Mernin' primitives ───────────────────────────────────────────────────────

function Btn({
  children,
  variant = "primary",
  size = "md",
  disabled,
  onClick,
  type = "button",
  className = "",
}: {
  children: React.ReactNode;
  variant?: "primary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md";
  disabled?: boolean;
  onClick?: () => void;
  type?: "button" | "submit";
  className?: string;
}) {
  const base =
    "inline-flex items-center justify-center font-body font-extrabold uppercase tracking-widest transition-all duration-100 cursor-pointer disabled:opacity-50 disabled:pointer-events-none";
  const sizes = { sm: "text-[0.65rem] px-3 py-1.5 gap-1", md: "text-[0.7rem] px-4 py-2 gap-1.5" };
  const variants = {
    primary:
      "bg-tomato text-cream border-[2.5px] border-espresso rounded-full shadow-[3px_3px_0_#1C0F05] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_#1C0F05] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none",
    outline:
      "bg-transparent text-espresso border-[2.5px] border-espresso rounded-full shadow-[3px_3px_0_#1C0F05] hover:bg-espresso hover:text-cream active:translate-x-0.5 active:translate-y-0.5 active:shadow-none",
    ghost:
      "bg-transparent text-espresso border-[2px] border-transparent rounded-lg hover:bg-fog/40 active:bg-fog/60",
    danger:
      "bg-transparent text-tomato border-[2px] border-transparent rounded-lg hover:bg-tomato/10 active:bg-tomato/20",
  };
  return (
    <button type={type} disabled={disabled} onClick={onClick} className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}>
      {children}
    </button>
  );
}

function FieldLabel({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <label
      htmlFor={htmlFor}
      className="block text-[0.65rem] font-extrabold uppercase tracking-widest text-espresso font-body mb-1"
    >
      {children}
    </label>
  );
}

function MerninInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full bg-chalk border-[2.5px] border-espresso rounded-xl px-3 py-2 font-body text-sm text-espresso placeholder:text-espresso/30 shadow-[3px_3px_0_#1C0F05] focus:outline-none focus:-translate-x-0.5 focus:-translate-y-0.5 focus:shadow-[4px_4px_0_#E8442A] focus:border-tomato transition-all ${props.className ?? ""}`}
    />
  );
}

const ROLE_COLORS: Record<string, string> = {
  owner: "bg-sun/30 text-espresso border-sun",
  admin: "bg-sky/20 text-espresso border-sky",
  roaster: "bg-fog/60 text-espresso border-fog",
};

function RolePill({ role }: { role: string }) {
  const colors = ROLE_COLORS[role] ?? "bg-fog/60 text-espresso border-fog";
  const icon =
    role === "owner" ? <Crown className="h-3 w-3" /> :
    role === "admin" ? <Shield className="h-3 w-3" /> :
    role === "roaster" ? <Flame className="h-3 w-3" /> : null;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[0.6rem] font-extrabold uppercase tracking-widest border-[2px] font-body ${colors}`}>
      {icon}
      {role}
    </span>
  );
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

        {/* Current Members */}
        <div className="space-y-2">
          <p className="text-[0.65rem] font-extrabold uppercase tracking-widest text-espresso/50 font-body">
            Current Members
          </p>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-espresso/40" />
            </div>
          ) : members.length === 0 ? (
            <p className="py-6 text-center text-sm text-espresso/40 font-body">
              No team members yet
            </p>
          ) : (
            <div className="space-y-2">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between bg-cream border-[2.5px] border-espresso rounded-[14px] shadow-[2px_2px_0_#1C0F05] px-3 py-3 gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-fog/60 border-[2px] border-espresso text-xs font-extrabold font-body text-espresso">
                      {(member.first_name?.[0] || "").toUpperCase()}
                      {(member.last_name?.[0] || "").toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-extrabold font-body text-espresso">
                        {member.first_name} {member.last_name}
                        {member.id === currentUserId && (
                          <span className="ml-1.5 text-xs font-body font-bold text-espresso/40">(you)</span>
                        )}
                      </p>
                      {member.email && (
                        <p className="truncate text-xs text-espresso/50 font-body">{member.email}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {member.role === "owner" || member.id === currentUserId ? (
                      <RolePill role={member.role} />
                    ) : (
                      <>
                        {isOwner ? (
                          <Select
                            value={member.role}
                            onValueChange={(v) => handleRoleChange(member.id, v as "admin" | "roaster")}
                          >
                            <SelectTrigger className="h-8 w-28 border-[2px] border-espresso rounded-lg bg-chalk text-xs font-body font-bold">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">
                                <span className="flex items-center gap-1.5">
                                  <Shield className="h-3 w-3" /> Admin
                                </span>
                              </SelectItem>
                              <SelectItem value="roaster">
                                <span className="flex items-center gap-1.5">
                                  <Flame className="h-3 w-3" /> Roaster
                                </span>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <RolePill role={member.role} />
                        )}

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <button className="inline-flex items-center justify-center h-8 w-8 rounded-lg text-espresso/40 hover:text-tomato hover:bg-tomato/10 transition-colors cursor-pointer">
                              <Trash2 className="h-4 w-4" />
                              <span className="sr-only">Remove member</span>
                            </button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="max-w-sm p-0 gap-0 border-[3px] border-espresso rounded-[16px] overflow-hidden bg-chalk shadow-[8px_8px_0_#1C0F05]">
                            <div className="bg-cream border-b-[3px] border-espresso px-6 py-4">
                              <AlertDialogHeader>
                                <AlertDialogTitle className="font-body font-extrabold uppercase tracking-widest text-espresso text-sm">
                                  Remove Team Member?
                                </AlertDialogTitle>
                                <AlertDialogDescription className="font-body text-sm text-espresso/60 mt-1">
                                  This will remove {member.first_name} {member.last_name} from your team. They will no longer have access to your workspace data.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                            </div>
                            <AlertDialogFooter className="px-6 py-4 flex justify-end gap-2">
                              <AlertDialogCancel className="inline-flex items-center justify-center font-body font-extrabold uppercase tracking-widest text-[0.7rem] px-4 py-2 bg-transparent text-espresso border-[2.5px] border-espresso rounded-full shadow-[3px_3px_0_#1C0F05] hover:bg-espresso hover:text-cream transition-all cursor-pointer">
                                Cancel
                              </AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleRemoveMember(member.id)}
                                className="inline-flex items-center justify-center font-body font-extrabold uppercase tracking-widest text-[0.7rem] px-4 py-2 bg-tomato text-cream border-[2.5px] border-espresso rounded-full shadow-[3px_3px_0_#1C0F05] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_#1C0F05] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer"
                              >
                                Remove
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pending Invitations */}
        {invitations.length > 0 && (
          <div className="space-y-2">
            <p className="text-[0.65rem] font-extrabold uppercase tracking-widest text-espresso/50 font-body">
              Pending Invitations
            </p>
            <div className="space-y-2">
              {invitations.map((invitation) => (
                <div
                  key={invitation.id}
                  className="flex items-center justify-between bg-cream border-[2px] border-dashed border-espresso/40 rounded-[14px] px-3 py-3 gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-fog/30 border-[2px] border-dashed border-espresso/40">
                      <Mail className="h-4 w-4 text-espresso/40" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-extrabold font-body text-espresso">
                        {invitation.email}
                      </p>
                      <div className="flex items-center gap-1.5 text-xs text-espresso/50 font-body">
                        <Clock className="h-3 w-3" />
                        Expires {new Date(invitation.expires_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <RolePill role={invitation.role} />
                    <Btn
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCancelInvitation(invitation.id)}
                      className="text-espresso/40 hover:text-tomato"
                    >
                      <X className="h-4 w-4" />
                    </Btn>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

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

      {/* Invite form footer */}
      <div className="bg-cream border-t-[2.5px] border-dashed border-fog px-5 py-4">
        <form onSubmit={handleInvite} className="flex flex-col gap-3 sm:flex-row">
          <div className="flex-1">
            <FieldLabel htmlFor="inviteEmail">
              <span className="sr-only">Email address</span>
            </FieldLabel>
            <MerninInput
              id="inviteEmail"
              type="email"
              placeholder="team@example.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              required
            />
          </div>
          <Select
            value={inviteRole}
            onValueChange={(v) => setInviteRole(v as "admin" | "roaster")}
          >
            <SelectTrigger className="w-full sm:w-32 border-[2.5px] border-espresso rounded-xl bg-chalk shadow-[3px_3px_0_#1C0F05] font-body text-sm font-bold">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="roaster">Roaster</SelectItem>
            </SelectContent>
          </Select>
          <Btn type="submit" disabled={isInviting || !inviteEmail.trim()}>
            {isInviting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <UserPlus className="h-3.5 w-3.5" />
            )}
            Invite
          </Btn>
        </form>
      </div>
    </div>
  );
}

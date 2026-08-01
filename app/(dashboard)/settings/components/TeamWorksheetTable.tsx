"use client";

import React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Clock, Flame, Loader2, Mail, Shield, X } from "lucide-react";
import { Btn } from "./LoudPrimitives";
import { RemoveMemberDialog } from "./SettingsDialogs";
import { RolePill } from "./RolePill";
import type { Invitation, TeamMember } from "./types";

/**
 * Members and pending invitations. Moved out of team-management.tsx verbatim
 * (CoffeeOS#74 Stage A) — two separately chromed lists, exactly as they were.
 *
 * They become ONE list in Stage B. Keeping them apart here is the point: Stage
 * A's claim is only that it moved code, and merging them is a design change the
 * baselines would (correctly) fail.
 *
 * The member-row / invitation-row / member-role / cancel-invitation testids are
 * a contract, not decoration — tests/e2e/settings-capabilities.spec.ts selects
 * through them, so the Stage B rewrite has to carry them across.
 */
export function TeamWorksheetTable({
  members,
  invitations,
  currentUserId,
  isOwner,
  isLoading,
  onRoleChange,
  onRemoveMember,
  onCancelInvitation,
}: {
  members: TeamMember[];
  invitations: Invitation[];
  currentUserId: string;
  isOwner: boolean;
  isLoading: boolean;
  onRoleChange: (memberId: string, role: "admin" | "roaster") => void;
  onRemoveMember: (memberId: string) => void;
  onCancelInvitation: (invitationId: string) => void;
}) {
  return (
    <>
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
                data-testid="member-row"
                data-member-email={member.email}
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
                          onValueChange={(v) => onRoleChange(member.id, v as "admin" | "roaster")}
                        >
                          <SelectTrigger data-testid="member-role" className="h-8 w-28 border-[2px] border-espresso rounded-lg bg-chalk text-xs font-body font-bold">
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

                      <RemoveMemberDialog member={member} onRemoveMember={onRemoveMember} />
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
                data-testid="invitation-row"
                data-invitation-email={invitation.email}
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
                    data-testid="cancel-invitation"
                    aria-label="Cancel invitation"
                    onClick={() => onCancelInvitation(invitation.id)}
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
    </>
  );
}

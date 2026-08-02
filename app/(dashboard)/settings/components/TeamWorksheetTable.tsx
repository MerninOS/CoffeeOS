"use client";

import React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState, IconButton } from "@merninos/ui/instrument";
import { Loader2, Users, X } from "lucide-react";
import {
  SELECT_CONTENT,
  SELECT_ITEM,
  SELECT_TRIGGER,
} from "@/app/(dashboard)/products/[id]/components/selectStyles";
import { RemoveMemberDialog } from "./SettingsDialogs";
import { RoleBadge } from "./RoleBadge";
import { mono, overline, sans } from "./tokens";
import type { Invitation, TeamMember } from "./types";

/**
 * Members and pending invitations as ONE list.
 *
 * The loud page rendered two: a members list of bordered cards, then a
 * separately chromed "Pending Invitations" list, then a static role legend
 * repeating what the role pills already said. The legend and its unused
 * getRoleDescription() are gone — Access says the same thing per row, where it
 * is about someone in particular.
 *
 * WHY THIS IS HAND-ROLLED RATHER THAN instrument's `DataTable`
 *
 * DataTable has no responsive mode. It wraps itself in `overflow-x: auto`, so
 * below its natural width the columns are reachable only by horizontal
 * scrolling. /orders declined it for that reason and /products had to back it
 * out after shipping it — "desktop-only baselines are how a completely broken
 * mobile layout shipped". It is exported from the kit and imported nowhere in
 * this app, which is not an oversight.
 *
 * So this follows ProductsWorksheetTable: ONE DOM, two layouts. Below 900px a
 * row is a stack of labelled values; above it the same nodes flatten into grid
 * tracks. No `md:hidden` twin — which is also what keeps each testid single.
 *
 * The Role control stays RADIX rather than instrument's Select, which is a
 * native `<select>`: the capability test clicks through the listbox, and
 * swapping the control would change what both the keyboard and the test reach.
 * Its content is retokenized and carries `data-surface="app"`, because Radix
 * portals to <body>, outside the scope the token layer is anchored to.
 */

const GRID = "min-[900px]:grid-cols-[minmax(0,1fr)_150px_minmax(0,1fr)_140px_40px]";
const ROW = `flex flex-col min-[900px]:grid ${GRID} min-[900px]:items-center gap-y-1 min-[900px]:gap-y-0`;
const CELL = "flex items-center gap-2 px-3 py-1 min-[900px]:py-0 min-[900px]:h-14";

const ACCESS: Record<string, string> = {
  owner: "Everything, including billing",
  admin: "Everything except billing",
  roaster: "Roasting and inventory only",
};

const initials = (a: string, b: string) =>
  `${(a?.[0] ?? "").toUpperCase()}${(b?.[0] ?? "").toUpperCase()}`;

const caption: React.CSSProperties = {
  fontFamily: "var(--font-sans)",
  fontSize: "var(--fs-caption)",
  color: "var(--ink-muted)",
};

/** A value that carries its own label, shown only while the row is stacked. */
function Cell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={CELL}>
      <span style={overline} className="min-[900px]:hidden">
        {label}
      </span>
      {children}
    </div>
  );
}

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
  if (isLoading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: "40px 0" }}>
        <Loader2
          className="animate-spin"
          width={20}
          height={20}
          style={{ color: "var(--ink-subtle)" }}
        />
      </div>
    );
  }

  if (members.length === 0 && invitations.length === 0) {
    return (
      <EmptyState
        compact
        icon={<Users />}
        title="No one else yet"
        description="Invite a roaster or an admin to share this workspace."
      />
    );
  }

  return (
    <div>
      {/* The header only means anything once the row is a grid. */}
      <div
        className={`${ROW} hidden min-[900px]:grid`}
        style={{
          background: "var(--surface-sunken)",
          borderBottom: "1px solid var(--hairline-strong)",
        }}
      >
        {["Member", "Role", "Access", "Status"].map((h) => (
          <div key={h} className="flex items-center px-3" style={{ height: 34 }}>
            <span style={overline}>{h}</span>
          </div>
        ))}
        <div />
      </div>

      {members.map((member) => {
        const editable = isOwner && member.role !== "owner" && member.id !== currentUserId;
        return (
          <div
            key={member.id}
            data-testid="member-row"
            data-member-email={member.email}
            className={ROW}
            style={{ borderBottom: "1px solid var(--hairline)" }}
          >
            <div className={CELL}>
              <span
                style={{
                  ...mono,
                  fontSize: "var(--fs-caption)",
                  width: 30,
                  height: 30,
                  flex: "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: "var(--r-sm)",
                  background: "var(--surface-sunken)",
                  color: "var(--ink-muted)",
                }}
              >
                {initials(member.first_name, member.last_name)}
              </span>
              <span style={{ minWidth: 0 }}>
                <span style={{ ...sans, fontWeight: "var(--fw-medium)", display: "block" }}>
                  {member.first_name} {member.last_name}
                  {member.id === currentUserId && (
                    <span style={{ color: "var(--ink-subtle)", fontWeight: "var(--fw-regular)" }}>
                      {" "}
                      · you
                    </span>
                  )}
                </span>
                <span style={{ ...caption, color: "var(--ink-subtle)", overflowWrap: "anywhere" }}>
                  {member.email}
                </span>
              </span>
            </div>

            <Cell label="Role">
              {editable ? (
                <Select
                  value={member.role}
                  onValueChange={(v) => onRoleChange(member.id, v as "admin" | "roaster")}
                >
                  <SelectTrigger data-testid="member-role" style={SELECT_TRIGGER}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent data-surface="app" style={SELECT_CONTENT}>
                    <SelectItem value="admin" style={SELECT_ITEM}>
                      Admin
                    </SelectItem>
                    <SelectItem value="roaster" style={SELECT_ITEM}>
                      Roaster
                    </SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                /* Badge drops unknown props, so the testid goes on a wrapper —
                   the same trap that already cost this branch one broken seam
                   when LoudPrimitives' Btn swallowed it silently. */
                <span data-testid="member-role">
                  <RoleBadge role={member.role} />
                </span>
              )}
            </Cell>

            <Cell label="Access">
              <span style={caption}>{ACCESS[member.role] ?? ""}</span>
            </Cell>

            <Cell label="Status">
              <span style={{ ...caption, color: "var(--ink-subtle)" }}>
                Since {new Date(member.created_at).toLocaleDateString()}
              </span>
            </Cell>

            <div className={`${CELL} min-[900px]:justify-end`}>
              {editable && <RemoveMemberDialog member={member} onRemoveMember={onRemoveMember} />}
            </div>
          </div>
        );
      })}

      {invitations.map((invitation) => (
        <div
          key={invitation.id}
          data-testid="invitation-row"
          data-invitation-email={invitation.email}
          className={ROW}
          style={{ borderBottom: "1px solid var(--hairline)" }}
        >
          <div className={CELL}>
            <span style={{ minWidth: 0 }}>
              <span
                style={{
                  ...sans,
                  color: "var(--ink-muted)",
                  display: "block",
                  overflowWrap: "anywhere",
                }}
              >
                {invitation.email}
              </span>
              <span style={{ ...caption, color: "var(--ink-subtle)" }}>
                Expires {new Date(invitation.expires_at).toLocaleDateString()}
              </span>
            </span>
          </div>

          <Cell label="Role">
            <RoleBadge role={invitation.role} />
          </Cell>

          <Cell label="Access">
            <span style={caption}>{ACCESS[invitation.role] ?? ""}</span>
          </Cell>

          <Cell label="Status">
            {/* Brand red, and the only thing besides the hero on this page that
                earns it: an invitation is outstanding work addressed to someone. */}
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontFamily: "var(--font-sans)",
                fontSize: "var(--fs-caption)",
                color: "var(--brand-hover)",
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "var(--brand)",
                  flex: "none",
                }}
              />
              Invited
            </span>
          </Cell>

          <div className={`${CELL} min-[900px]:justify-end`}>
            <IconButton
              size="sm"
              aria-label="Cancel invitation"
              data-testid="cancel-invitation"
              icon={<X />}
              onClick={() => onCancelInvitation(invitation.id)}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

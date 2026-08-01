"use client";

import React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button, Field, Input } from "@merninos/ui/instrument";
import { Loader2, Mail, UserPlus } from "lucide-react";
import {
  SELECT_CONTENT,
  SELECT_ITEM,
  SELECT_TRIGGER,
} from "@/app/(dashboard)/products/[id]/components/selectStyles";

/**
 * The invite form, below the list it adds to.
 *
 * Radix rather than instrument's Select for the role, matching the role control
 * in the row above it: a native <select> beside a listbox on the same screen
 * would be two different controls for the same choice. Content is retokenized
 * and carries data-surface="app" — Radix portals outside the token scope.
 */
export function InviteRow({
  inviteEmail,
  setInviteEmail,
  inviteRole,
  setInviteRole,
  isInviting,
  onSubmit,
}: {
  inviteEmail: string;
  setInviteEmail: (v: string) => void;
  inviteRole: "admin" | "roaster";
  setInviteRole: (v: "admin" | "roaster") => void;
  isInviting: boolean;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <form
      onSubmit={onSubmit}
      style={{
        display: "flex",
        gap: 12,
        flexWrap: "wrap",
        alignItems: "flex-end",
        paddingTop: 20,
      }}
    >
      <Field label="Invite by email" style={{ flex: "1 1 240px", minWidth: 0 }}>
        <Input
          id="inviteEmail"
          type="email"
          required
          placeholder="team@example.com"
          value={inviteEmail}
          leading={<Mail />}
          onChange={(e) => setInviteEmail(e.target.value)}
        />
      </Field>

      <Field label="Role" style={{ flex: "0 1 150px" }}>
        <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as "admin" | "roaster")}>
          <SelectTrigger style={{ ...SELECT_TRIGGER, height: 38 }}>
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
      </Field>

      <Button
        type="submit"
        iconLeft={isInviting ? <Loader2 /> : <UserPlus />}
        disabled={isInviting || !inviteEmail.trim()}
      >
        Invite
      </Button>
    </form>
  );
}

"use client";

import React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, UserPlus } from "lucide-react";
import { Btn, FieldLabel, MerninInput } from "./LoudPrimitives";

/**
 * The invite form. Moved out of team-management.tsx verbatim (CoffeeOS#74 Stage
 * A); the parent still owns every piece of its state.
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
    <div className="bg-cream border-t-[2.5px] border-dashed border-fog px-5 py-4">
      <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row">
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
  );
}

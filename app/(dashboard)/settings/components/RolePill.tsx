"use client";

import React from "react";
import { Crown, Flame, Shield } from "lucide-react";

/**
 * A member's role as a pill. Moved out of team-management.tsx verbatim
 * (CoffeeOS#74 Stage A).
 *
 * invitation-banner.tsx carries its own near-duplicate of this — same shape,
 * two tones instead of three. They are NOT merged here: that is a behaviour
 * change the baselines would fail, and Stage B replaces both with one RoleBadge
 * built on the kit's Badge.
 */
const ROLE_COLORS: Record<string, string> = {
  owner: "bg-sun/30 text-espresso border-sun",
  admin: "bg-sky/20 text-espresso border-sky",
  roaster: "bg-fog/60 text-espresso border-fog",
};

export function RolePill({ role }: { role: string }) {
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

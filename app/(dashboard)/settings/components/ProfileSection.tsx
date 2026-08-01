"use client";

import React from "react";
import { Loader2, Save, User } from "lucide-react";
import { Btn, FieldLabel, MerninInput, PanelHeader, SectionPanel } from "./LoudPrimitives";
import type { SettingsUser } from "./types";

/**
 * Name and email. Moved out of settings-client.tsx verbatim (CoffeeOS#74 Stage
 * A) — the markup below is byte-identical to what it replaced, because Stage A's
 * only claim is that it moved code without changing behaviour.
 *
 * State stays with the parent. The form is controlled from settings-client.tsx's
 * `profileData`, so this component owns nothing; lifting the state down here
 * would be a behaviour change wearing an extraction's clothes.
 */
export function ProfileSection({
  user,
  profileData,
  setProfileData,
  isSaving,
  onSubmit,
}: {
  user: SettingsUser;
  profileData: { firstName: string; lastName: string };
  setProfileData: (next: { firstName: string; lastName: string }) => void;
  isSaving: boolean;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <SectionPanel>
      <PanelHeader
        icon={<User className="h-5 w-5" />}
        title="Profile"
        subtitle="Update your personal information"
      />
      <form onSubmit={onSubmit}>
        <div className="px-5 py-5 space-y-4">
          <div>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <MerninInput id="email" value={user.email} disabled />
            <p className="mt-1 text-xs text-espresso/40 font-body">Email cannot be changed</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <FieldLabel htmlFor="firstName">First Name</FieldLabel>
              <MerninInput
                id="firstName"
                value={profileData.firstName}
                onChange={(e) => setProfileData({ ...profileData, firstName: e.target.value })}
                required
              />
            </div>
            <div>
              <FieldLabel htmlFor="lastName">Last Name</FieldLabel>
              <MerninInput
                id="lastName"
                value={profileData.lastName}
                onChange={(e) => setProfileData({ ...profileData, lastName: e.target.value })}
                required
              />
            </div>
          </div>
        </div>
        <div className="bg-cream border-t-2 border-espresso px-5 py-4 flex justify-end">
          <Btn type="submit" disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            Save Changes
          </Btn>
        </div>
      </form>
    </SectionPanel>
  );
}

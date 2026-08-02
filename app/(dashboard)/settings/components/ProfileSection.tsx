"use client";

import React from "react";
import { Button, Input } from "@merninos/ui/instrument";
import { Loader2, Save } from "lucide-react";
import { Row } from "./Row";
import { Section } from "./Section";
import { mono } from "./tokens";
import type { SettingsUser } from "./types";

/**
 * Name and email, as two ruled rows.
 *
 * The loud version was a full bordered panel with its own footer action bar for
 * two fields — the same visual weight as the Shopify connection and the team.
 * Sizing chrome to importance rather than to line count is most of what the
 * conversion is doing.
 *
 * Email is read-only text rather than a disabled input: a disabled field invites
 * the operator to try, and the reason it cannot change is not a form-state
 * problem. State stays with the parent, as it did through the extraction.
 */
export function ProfileSection({
  user,
  role,
  profileData,
  setProfileData,
  isSaving,
  onSubmit,
}: {
  user: SettingsUser;
  role: string;
  profileData: { firstName: string; lastName: string };
  setProfileData: (next: { firstName: string; lastName: string }) => void;
  isSaving: boolean;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <Section title="Profile" meta={role}>
      <Row label="Email" help="Your email is your sign-in and can't be changed here.">
        <span style={{ ...mono, fontSize: "var(--fs-data)", color: "var(--ink-muted)", overflowWrap: "anywhere" }}>
          {user.email}
        </span>
      </Row>

      <Row label="Name">
        <form
          onSubmit={onSubmit}
          style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", maxWidth: 560 }}
        >
          <Input
            id="firstName"
            aria-label="First name"
            required
            value={profileData.firstName}
            onChange={(e) => setProfileData({ ...profileData, firstName: e.target.value })}
            style={{ flex: "1 1 150px" }}
          />
          <Input
            id="lastName"
            aria-label="Last name"
            required
            value={profileData.lastName}
            onChange={(e) => setProfileData({ ...profileData, lastName: e.target.value })}
            style={{ flex: "1 1 150px" }}
          />
          <Button type="submit" iconLeft={isSaving ? <Loader2 /> : <Save />} disabled={isSaving}>
            Save changes
          </Button>
        </form>
      </Row>
    </Section>
  );
}

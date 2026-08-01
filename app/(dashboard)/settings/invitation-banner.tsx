"use client";

import { useState, useEffect } from "react";
import { getMyPendingInvitations, acceptInvitation } from "./team-actions";
import { Button, InlineBanner } from "@merninos/ui/instrument";
import { Check, Loader2 } from "lucide-react";
import { RoleBadge } from "./components/RoleBadge";

interface PendingInvitation {
  id: string;
  email: string;
  role: string;
  invited_by: string;
  expires_at: string;
  profiles?: { first_name: string; last_name: string };
}

/**
 * You have been invited to someone else's workspace.
 *
 * The one banner this page is allowed to open with, because it is the only
 * thing here that is both addressed to you and actionable. The loud version was
 * a sky-tinted card with its own third copy of RolePill; that pill is now the
 * shared RoleBadge.
 */
export function InvitationBanner() {
  const [invitations, setInvitations] = useState<PendingInvitation[]>([]);
  const [accepting, setAccepting] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    async function load() {
      const result = await getMyPendingInvitations();
      if (result.invitations) setInvitations(result.invitations);
    }
    load();
  }, []);

  const handleAccept = async (invitationId: string) => {
    setAccepting(invitationId);
    setMessage(null);
    const result = await acceptInvitation(invitationId);
    if (result.error) {
      setMessage({ type: "error", text: result.error });
    } else {
      setMessage({ type: "success", text: "Invitation accepted. Reloading…" });
      setTimeout(() => window.location.reload(), 1000);
    }
    setAccepting(null);
  };

  if (invitations.length === 0) return null;

  return (
    <div className="px-6 pt-6" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {message && (
        <InlineBanner tone={message.type === "error" ? "danger" : "success"}>
          {message.text}
        </InlineBanner>
      )}
      {invitations.map((invitation) => (
        <InlineBanner
          key={invitation.id}
          tone="info"
          title="You have been invited to join a workspace"
          action={
            <Button
              size="sm"
              iconLeft={accepting === invitation.id ? <Loader2 /> : <Check />}
              disabled={accepting === invitation.id}
              onClick={() => handleAccept(invitation.id)}
            >
              Accept invitation
            </Button>
          }
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <RoleBadge role={invitation.role} />
            <span>
              Expires {new Date(invitation.expires_at).toLocaleDateString()}. Accepting moves your
              account into that workspace&apos;s data.
            </span>
          </span>
        </InlineBanner>
      ))}
    </div>
  );
}

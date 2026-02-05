"use client";

import { useState, useEffect } from "react";
import { getMyPendingInvitations, acceptInvitation } from "./team-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, UserPlus, Shield, Flame } from "lucide-react";

interface PendingInvitation {
  id: string;
  email: string;
  role: string;
  invited_by: string;
  expires_at: string;
  profiles?: {
    first_name: string;
    last_name: string;
  };
}

export function InvitationBanner() {
  const [invitations, setInvitations] = useState<PendingInvitation[]>([]);
  const [accepting, setAccepting] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    async function load() {
      const result = await getMyPendingInvitations();
      if (result.invitations) {
        setInvitations(result.invitations);
      }
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
      setMessage({ type: "success", text: "Invitation accepted! Reloading..." });
      // Reload to reflect new role
      setTimeout(() => window.location.reload(), 1000);
    }

    setAccepting(null);
  };

  if (invitations.length === 0) return null;

  return (
    <div className="space-y-3">
      {message && (
        <div
          className={`rounded-md p-3 text-sm ${
            message.type === "error"
              ? "bg-destructive/10 text-destructive"
              : "bg-green-500/10 text-green-600"
          }`}
        >
          {message.text}
        </div>
      )}
      {invitations.map((invitation) => (
        <Card key={invitation.id} className="border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/50">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900">
                <UserPlus className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm font-medium">
                  You have been invited to join a team
                </p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>Role:</span>
                  <Badge variant="outline" className="gap-1 capitalize">
                    {invitation.role === "admin" ? (
                      <Shield className="h-3 w-3" />
                    ) : (
                      <Flame className="h-3 w-3" />
                    )}
                    {invitation.role}
                  </Badge>
                </div>
              </div>
            </div>
            <Button
              size="sm"
              onClick={() => handleAccept(invitation.id)}
              disabled={accepting === invitation.id}
            >
              {accepting === invitation.id ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <UserPlus className="mr-2 h-4 w-4" />
              )}
              Accept Invitation
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

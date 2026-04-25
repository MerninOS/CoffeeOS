"use client";

import { useState, useEffect } from "react";
import { getMyPendingInvitations, acceptInvitation } from "./team-actions";
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

function RolePill({ role }: { role: string }) {
  const colors =
    role === "admin"
      ? "bg-sky/20 text-espresso border-sky"
      : "bg-fog/60 text-espresso border-fog";
  const icon =
    role === "admin" ? <Shield className="h-3 w-3" /> : <Flame className="h-3 w-3" />;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[0.6rem] font-extrabold uppercase tracking-widest border-[2px] font-body ${colors}`}
    >
      {icon}
      {role}
    </span>
  );
}

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
      setMessage({ type: "success", text: "Invitation accepted! Reloading..." });
      setTimeout(() => window.location.reload(), 1000);
    }
    setAccepting(null);
  };

  if (invitations.length === 0) return null;

  return (
    <div className="p-6 space-y-3">
      {message && (
        <div
          className={`rounded-xl border-[2.5px] p-3 text-sm font-body font-bold ${
            message.type === "error"
              ? "bg-tomato/10 border-tomato text-tomato"
              : "bg-matcha/10 border-matcha text-matcha"
          }`}
        >
          {message.text}
        </div>
      )}
      {invitations.map((invitation) => (
        <div
          key={invitation.id}
          className="bg-sky/10 border-[2.5px] border-sky rounded-[16px] shadow-[3px_3px_0_#5BC8D5] px-4 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky/20 border-[2px] border-sky">
              <UserPlus className="h-5 w-5 text-espresso/60" />
            </div>
            <div>
              <p className="text-sm font-extrabold font-body text-espresso">
                You have been invited to join a team
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-espresso/50 font-body">Role:</span>
                <RolePill role={invitation.role} />
              </div>
            </div>
          </div>
          <button
            onClick={() => handleAccept(invitation.id)}
            disabled={accepting === invitation.id}
            className="inline-flex items-center justify-center gap-1.5 font-body font-extrabold uppercase tracking-widest text-[0.7rem] px-4 py-2 bg-tomato text-cream border-[2.5px] border-espresso rounded-full shadow-[3px_3px_0_#1C0F05] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_#1C0F05] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
          >
            {accepting === invitation.id ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <UserPlus className="h-3.5 w-3.5" />
            )}
            Accept Invitation
          </button>
        </div>
      ))}
    </div>
  );
}

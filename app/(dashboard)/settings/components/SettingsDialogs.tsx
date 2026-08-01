"use client";

import React from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button, IconButton } from "@merninos/ui/instrument";
import { Power, Trash2 } from "lucide-react";
import { sans } from "./tokens";
import type { TeamMember } from "./types";

/**
 * The two destructive confirmations.
 *
 * RADIX, NOT instrument's `Modal`. Modal renders no `role="dialog"`, so
 * Playwright cannot drive it, and it is imported nowhere in this app for exactly
 * that reason. Retokenized in place instead.
 *
 * `data-surface="app"` ON EACH CONTENT ROOT IS LOAD-BEARING, not defensive.
 * Radix portals content to <body>, outside the AppShell subtree the instrument
 * token layer is scoped to — without it every var(--token) below resolves to
 * nothing and the dialog renders unstyled. Same as
 * app/(dashboard)/products/components/ProductDialogs.tsx.
 *
 * The filled danger button appears here and nowhere else on the page: a
 * confirmation dialog is the one place the design system allows it.
 */

const PANEL: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--hairline)",
  borderRadius: "var(--r-lg)",
  boxShadow: "var(--shadow-modal)",
  padding: 0,
  overflow: "hidden",
  gap: 0,
  maxWidth: 460,
};

const HEAD: React.CSSProperties = { padding: "20px 24px 0" };
const TITLE: React.CSSProperties = {
  fontFamily: "var(--font-sans)",
  fontSize: "var(--fs-title)",
  fontWeight: "var(--fw-semibold)" as unknown as number,
  color: "var(--ink)",
};
const BODY: React.CSSProperties = {
  ...sans,
  color: "var(--ink-muted)",
  lineHeight: "var(--lh-body)",
  marginTop: 6,
};
const FOOT: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 10,
  padding: "20px 24px",
};

export function DisconnectStoreDialog({
  isDisconnecting,
  onDisconnect,
}: {
  isDisconnecting: boolean;
  onDisconnect: () => void;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        {/* Tertiary, in danger ink — never a brand fill. Red on this page means
            "the workspace needs you", and a red button here would compete with
            the hero for that meaning. */}
        <Button size="sm" variant="tertiary" iconLeft={<Power />} style={{ color: "var(--danger)" }}>
          Disconnect
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent data-surface="app" style={PANEL}>
        <AlertDialogHeader style={HEAD}>
          <AlertDialogTitle style={TITLE}>Disconnect this Shopify store?</AlertDialogTitle>
          <AlertDialogDescription style={BODY}>
            Products and orders stop syncing immediately. Data already in CoffeeOS is kept, and you
            can reconnect the same store later.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter style={FOOT}>
          <AlertDialogCancel asChild>
            <Button variant="secondary">Keep connected</Button>
          </AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button variant="destructive" disabled={isDisconnecting} onClick={onDisconnect}>
              Disconnect store
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function RemoveMemberDialog({
  member,
  onRemoveMember,
}: {
  member: TeamMember;
  onRemoveMember: (memberId: string) => void;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <IconButton size="sm" aria-label="Remove member" icon={<Trash2 />} />
      </AlertDialogTrigger>
      <AlertDialogContent data-surface="app" style={PANEL}>
        <AlertDialogHeader style={HEAD}>
          <AlertDialogTitle style={TITLE}>
            Remove {member.first_name} {member.last_name}?
          </AlertDialogTitle>
          <AlertDialogDescription style={BODY}>
            They lose access to this workspace&apos;s orders, roasting and inventory right away.
            Their own account is not deleted.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter style={FOOT}>
          <AlertDialogCancel asChild>
            <Button variant="secondary">Cancel</Button>
          </AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button variant="destructive" onClick={() => onRemoveMember(member.id)}>
              Remove member
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

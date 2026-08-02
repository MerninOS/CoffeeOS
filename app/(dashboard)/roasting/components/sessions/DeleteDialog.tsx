"use client";

import type { CSSProperties } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@merninos/ui/instrument";
import { sans } from "@/lib/instrument/tokens";

/**
 * Retokenized onto instrument (CoffeeOS#71), matching the
 * ProductDialogs.tsx `DeleteProductDialog` precedent.
 *
 * `data-surface="app"` on AlertDialogContent is load-bearing, not defensive:
 * Radix portals it to <body>, outside the AppShell subtree the instrument
 * token layer is scoped to.
 *
 * Destructive fill is `--danger`, NOT `--brand` — brand red is the live
 * register on this system and never fills a control; `--danger` is a
 * deliberately different red so the two do not read as the same signal. This
 * is the one place in the sessions tab a destructive Button belongs.
 */

const PANEL: CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--hairline)",
  borderRadius: "var(--r-lg)",
  boxShadow: "var(--shadow-modal)",
  padding: 0,
  overflow: "hidden",
  gap: 0,
  maxWidth: 400,
};

const HEAD: CSSProperties = {
  padding: "var(--space-5) var(--space-6)",
  borderBottom: "1px solid var(--hairline)",
  background: "var(--surface-sunken)",
};

const BODY: CSSProperties = {
  padding: "var(--space-5) var(--space-6)",
};

const FOOT: CSSProperties = {
  padding: "var(--space-4) var(--space-6)",
  borderTop: "1px solid var(--hairline)",
  background: "var(--surface-sunken)",
  display: "flex",
  gap: 8,
  justifyContent: "flex-end",
};

const TITLE: CSSProperties = {
  fontFamily: "var(--font-display)",
  fontVariationSettings: "var(--display-settings)",
  fontWeight: "var(--display-weight)" as unknown as number,
  letterSpacing: "var(--display-tracking)",
  fontSize: "var(--fs-title)",
  textTransform: "uppercase",
  color: "var(--ink)",
};

interface DeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function DeleteDialog({ open, onOpenChange, onConfirm }: DeleteDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent data-surface="app" data-testid="delete-dialog" style={PANEL}>
        <div style={HEAD}>
          <AlertDialogHeader>
            <AlertDialogTitle style={TITLE}>Delete Session?</AlertDialogTitle>
          </AlertDialogHeader>
        </div>
        <div style={BODY}>
          <AlertDialogDescription style={{ ...sans, fontSize: "var(--fs-caption)", color: "var(--ink-muted)" }}>
            This will permanently delete this roasting session and all its batches. This action cannot be undone.
          </AlertDialogDescription>
        </div>
        <div style={FOOT}>
          <AlertDialogCancel asChild>
            <Button variant="secondary" size="sm">
              Cancel
            </Button>
          </AlertDialogCancel>
          <AlertDialogAction asChild onClick={onConfirm}>
            <Button data-testid="delete-confirm" variant="destructive" size="sm">
              Delete
            </Button>
          </AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}

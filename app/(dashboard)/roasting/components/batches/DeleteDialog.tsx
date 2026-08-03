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

/**
 * Retokenized onto instrument (CoffeeOS#71) — same shape as
 * DeleteComponentDialog/InventoryDialogs' delete confirm: `--danger` fills the
 * confirm button, never `--brand` (the live register never fills a control).
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
  deleteId: string | null;
  onOpenChange: () => void;
  onConfirm: () => void;
}

export function DeleteDialog({ deleteId, onOpenChange, onConfirm }: DeleteDialogProps) {
  return (
    <AlertDialog open={!!deleteId} onOpenChange={onOpenChange}>
      <AlertDialogContent data-surface="app" data-testid="delete-dialog" style={PANEL}>
        <div style={HEAD}>
          <AlertDialogHeader>
            <AlertDialogTitle style={TITLE}>Delete Batch?</AlertDialogTitle>
          </AlertDialogHeader>
        </div>
        <div style={BODY}>
          <AlertDialogDescription style={{ fontFamily: "var(--font-sans)", fontSize: "var(--fs-body)", color: "var(--ink-muted)" }}>
            This will permanently delete this batch. This action cannot be undone.
          </AlertDialogDescription>
        </div>
        <AlertDialogFooter style={FOOT}>
          <AlertDialogCancel asChild>
            <Button variant="secondary" size="sm">Cancel</Button>
          </AlertDialogCancel>
          <AlertDialogAction asChild onClick={onConfirm}>
            <Button data-testid="delete-confirm" variant="destructive" size="sm">Delete</Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

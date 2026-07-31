"use client";

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

/**
 * The three destructive confirmations. Moved byte-for-byte (Stage A).
 *
 * These stay Radix through Stage B: Instrument's Modal renders no
 * role="dialog", so anything that must be driveable keeps Radix and gets
 * retokenized instead. Stage B must also set data-surface="app" on each
 * content element — they portal to <body>, outside the token scope, where
 * every var(--token) resolves to nothing.
 */
export function DeleteDialogs({
  deleteAssignmentId,
  setDeleteAssignmentId,
  handleRemoveCoffeeAssignment,
  deleteCostId,
  setDeleteCostId,
  handleRemoveCustomCost,
  deleteComponentId,
  setDeleteComponentId,
  handleRemoveComponent,
  isPending,
}: {
  deleteAssignmentId: string | null;
  setDeleteAssignmentId: (id: string | null) => void;
  handleRemoveCoffeeAssignment: (id: string) => void;
  deleteCostId: string | null;
  setDeleteCostId: (id: string | null) => void;
  handleRemoveCustomCost: (id: string) => void;
  deleteComponentId: string | null;
  setDeleteComponentId: (id: string | null) => void;
  handleRemoveComponent: (id: string) => void;
  isPending: boolean;
}) {
  return (
    <>
  <AlertDialog open={!!deleteAssignmentId} onOpenChange={() => setDeleteAssignmentId(null)}>
    <AlertDialogContent
          data-surface="app"
          style={{
            border: "1px solid var(--hairline-strong)",
            borderRadius: "var(--r-lg)",
            background: "var(--surface)",
            boxShadow: "var(--shadow-modal)",
          }}
        >
      <AlertDialogHeader>
        <AlertDialogTitle style={{ fontFamily: "var(--font-display)", fontVariationSettings: "var(--display-settings)", fontSize: "var(--fs-title)", color: "var(--ink)" }}>Remove Coffee Assignment?</AlertDialogTitle>
        <AlertDialogDescription style={{ fontFamily: "var(--font-sans)", fontSize: "var(--fs-body)", color: "var(--ink-muted)" }}>
          This will return the coffee to your roasted stock.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel style={{ fontFamily: "var(--font-sans)", fontSize: "var(--fs-body)", border: "1px solid var(--hairline-strong)", borderRadius: "var(--r-md)", background: "var(--surface-sunken)", color: "var(--ink)" }}>Cancel</AlertDialogCancel>
        <AlertDialogAction
              disabled={isPending}
          onClick={() => deleteAssignmentId && handleRemoveCoffeeAssignment(deleteAssignmentId)}
          style={{ fontFamily: "var(--font-sans)", fontSize: "var(--fs-body)", background: "var(--danger)", color: "var(--on-danger, #fff)", border: "1px solid var(--danger)", borderRadius: "var(--r-md)" }}
        >
          Remove
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>

  <AlertDialog open={!!deleteCostId} onOpenChange={() => setDeleteCostId(null)}>
    <AlertDialogContent
          data-surface="app"
          style={{
            border: "1px solid var(--hairline-strong)",
            borderRadius: "var(--r-lg)",
            background: "var(--surface)",
            boxShadow: "var(--shadow-modal)",
          }}
        >
      <AlertDialogHeader>
        <AlertDialogTitle style={{ fontFamily: "var(--font-display)", fontVariationSettings: "var(--display-settings)", fontSize: "var(--fs-title)", color: "var(--ink)" }}>Delete Custom Cost?</AlertDialogTitle>
        <AlertDialogDescription style={{ fontFamily: "var(--font-sans)", fontSize: "var(--fs-body)", color: "var(--ink-muted)" }}>This action cannot be undone.</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel style={{ fontFamily: "var(--font-sans)", fontSize: "var(--fs-body)", border: "1px solid var(--hairline-strong)", borderRadius: "var(--r-md)", background: "var(--surface-sunken)", color: "var(--ink)" }}>Cancel</AlertDialogCancel>
        <AlertDialogAction
              disabled={isPending}
          onClick={() => deleteCostId && handleRemoveCustomCost(deleteCostId)}
          style={{ fontFamily: "var(--font-sans)", fontSize: "var(--fs-body)", background: "var(--danger)", color: "var(--on-danger, #fff)", border: "1px solid var(--danger)", borderRadius: "var(--r-md)" }}
        >
          Delete
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>

  <AlertDialog open={!!deleteComponentId} onOpenChange={() => setDeleteComponentId(null)}>
    <AlertDialogContent
          data-surface="app"
          style={{
            border: "1px solid var(--hairline-strong)",
            borderRadius: "var(--r-lg)",
            background: "var(--surface)",
            boxShadow: "var(--shadow-modal)",
          }}
        >
      <AlertDialogHeader>
        <AlertDialogTitle style={{ fontFamily: "var(--font-display)", fontVariationSettings: "var(--display-settings)", fontSize: "var(--fs-title)", color: "var(--ink)" }}>Remove Component?</AlertDialogTitle>
        <AlertDialogDescription style={{ fontFamily: "var(--font-sans)", fontSize: "var(--fs-body)", color: "var(--ink-muted)" }}>This action cannot be undone.</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel style={{ fontFamily: "var(--font-sans)", fontSize: "var(--fs-body)", border: "1px solid var(--hairline-strong)", borderRadius: "var(--r-md)", background: "var(--surface-sunken)", color: "var(--ink)" }}>Cancel</AlertDialogCancel>
        <AlertDialogAction
              disabled={isPending}
          onClick={() => deleteComponentId && handleRemoveComponent(deleteComponentId)}
          style={{ fontFamily: "var(--font-sans)", fontSize: "var(--fs-body)", background: "var(--danger)", color: "var(--on-danger, #fff)", border: "1px solid var(--danger)", borderRadius: "var(--r-md)" }}
        >
          Remove
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
    </>
  );
}

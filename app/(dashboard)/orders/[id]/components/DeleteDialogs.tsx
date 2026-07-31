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
}) {
  return (
    <>
  <AlertDialog open={!!deleteAssignmentId} onOpenChange={() => setDeleteAssignmentId(null)}>
    <AlertDialogContent className="border-[3px] border-espresso rounded-[16px] bg-chalk shadow-flat-lg">
      <AlertDialogHeader>
        <AlertDialogTitle className="font-extrabold text-[15px] uppercase tracking-[.06em] text-espresso">Remove Coffee Assignment?</AlertDialogTitle>
        <AlertDialogDescription className="text-[13px] text-espresso/60">
          This will return the coffee to your roasted stock.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel className="font-extrabold text-[11px] uppercase tracking-[.08em] border-[2px] border-espresso rounded-[8px]">Cancel</AlertDialogCancel>
        <AlertDialogAction
          onClick={() => deleteAssignmentId && handleRemoveCoffeeAssignment(deleteAssignmentId)}
          className="bg-tomato text-cream font-extrabold text-[11px] uppercase tracking-[.08em] border-[2px] border-espresso rounded-[8px] shadow-[3px_3px_0_#1C0F05]"
        >
          Remove
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>

  <AlertDialog open={!!deleteCostId} onOpenChange={() => setDeleteCostId(null)}>
    <AlertDialogContent className="border-[3px] border-espresso rounded-[16px] bg-chalk shadow-flat-lg">
      <AlertDialogHeader>
        <AlertDialogTitle className="font-extrabold text-[15px] uppercase tracking-[.06em] text-espresso">Delete Custom Cost?</AlertDialogTitle>
        <AlertDialogDescription className="text-[13px] text-espresso/60">This action cannot be undone.</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel className="font-extrabold text-[11px] uppercase tracking-[.08em] border-[2px] border-espresso rounded-[8px]">Cancel</AlertDialogCancel>
        <AlertDialogAction
          onClick={() => deleteCostId && handleRemoveCustomCost(deleteCostId)}
          className="bg-tomato text-cream font-extrabold text-[11px] uppercase tracking-[.08em] border-[2px] border-espresso rounded-[8px] shadow-[3px_3px_0_#1C0F05]"
        >
          Delete
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>

  <AlertDialog open={!!deleteComponentId} onOpenChange={() => setDeleteComponentId(null)}>
    <AlertDialogContent className="border-[3px] border-espresso rounded-[16px] bg-chalk shadow-flat-lg">
      <AlertDialogHeader>
        <AlertDialogTitle className="font-extrabold text-[15px] uppercase tracking-[.06em] text-espresso">Remove Component?</AlertDialogTitle>
        <AlertDialogDescription className="text-[13px] text-espresso/60">This action cannot be undone.</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel className="font-extrabold text-[11px] uppercase tracking-[.08em] border-[2px] border-espresso rounded-[8px]">Cancel</AlertDialogCancel>
        <AlertDialogAction
          onClick={() => deleteComponentId && handleRemoveComponent(deleteComponentId)}
          className="bg-tomato text-cream font-extrabold text-[11px] uppercase tracking-[.08em] border-[2px] border-espresso rounded-[8px] shadow-[3px_3px_0_#1C0F05]"
        >
          Remove
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
    </>
  );
}

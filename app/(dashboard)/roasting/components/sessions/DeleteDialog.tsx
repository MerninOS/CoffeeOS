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

interface DeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function DeleteDialog({ open, onOpenChange, onConfirm }: DeleteDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent data-testid="delete-dialog" className="p-0 gap-0 border-[3px] border-espresso rounded-[16px] overflow-hidden bg-chalk shadow-flat-lg max-w-sm">
        <div className="bg-cream border-b-[3px] border-espresso px-6 py-4">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-extrabold text-[15px] uppercase tracking-[.06em] text-espresso">
              Delete Session?
            </AlertDialogTitle>
          </AlertDialogHeader>
        </div>
        <div className="px-6 py-5">
          <AlertDialogDescription className="text-[13px] text-espresso/70 font-medium">
            This will permanently delete this roasting session and all its batches. This action cannot be undone.
          </AlertDialogDescription>
        </div>
        <div className="bg-cream border-t-[3px] border-espresso px-6 py-4 flex justify-end gap-2">
          <AlertDialogCancel className="inline-flex items-center px-3 py-1.5 rounded-[8px] border-[2.5px] border-espresso bg-transparent text-espresso font-extrabold text-[11px] uppercase tracking-[.08em] hover:bg-fog/40 transition-all">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            data-testid="delete-confirm"
            onClick={onConfirm}
            className="inline-flex items-center px-3 py-1.5 rounded-[8px] border-[2.5px] border-espresso bg-tomato text-cream font-extrabold text-[11px] uppercase tracking-[.08em] shadow-[3px_3px_0_#1C0F05] hover:-translate-x-px hover:-translate-y-px hover:shadow-[4px_4px_0_#1C0F05] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"
          >
            Delete
          </AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}

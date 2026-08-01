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
import { Loader2, Trash2, Unplug } from "lucide-react";
import type { TeamMember } from "./types";

/**
 * The two destructive confirmations, moved here verbatim (CoffeeOS#74 Stage A),
 * trigger buttons included — the trigger is part of the dialog's contract with
 * Radix (`asChild`), so splitting it out would be a rewrite rather than a move.
 *
 * These stay Radix through Stage B and are NOT swapped for the instrument
 * `Modal`. Two reasons, both load-bearing: the kit's Modal renders no
 * `role="dialog"`, so Playwright cannot drive it, and it is imported nowhere in
 * this app for exactly that reason. Stage B retokenizes them in place and adds
 * `data-surface="app"` to each content root — Radix portals to <body>, outside
 * the token scope, so without it every var(--token) inside resolves to nothing.
 * app/(dashboard)/products/components/ProductDialogs.tsx already does this.
 */

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
                    <button className="inline-flex items-center justify-center gap-1.5 font-body font-extrabold uppercase tracking-widest text-[0.7rem] px-4 py-2 bg-transparent text-tomato border-[2.5px] border-tomato rounded-full shadow-[3px_3px_0_#E8442A] hover:bg-tomato hover:text-cream transition-all cursor-pointer">
                      <Unplug className="h-3.5 w-3.5" />
                      Disconnect Store
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="max-w-sm p-0 gap-0 border-[3px] border-espresso rounded-[16px] overflow-hidden bg-chalk shadow-[8px_8px_0_#1C0F05]">
                    <div className="bg-cream border-b-[3px] border-espresso px-6 py-4">
                      <AlertDialogHeader>
                        <AlertDialogTitle className="font-body font-extrabold uppercase tracking-widest text-espresso text-sm">
                          Disconnect Shopify Store?
                        </AlertDialogTitle>
                        <AlertDialogDescription className="font-body text-sm text-espresso/60 mt-1">
                          This will remove the connection to your Shopify store. You won&apos;t be able to sync products or orders until you reconnect. Your existing data will be preserved.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                    </div>
                    <AlertDialogFooter className="px-6 py-4 flex justify-end gap-2">
                      <AlertDialogCancel className="inline-flex items-center justify-center font-body font-extrabold uppercase tracking-widest text-[0.7rem] px-4 py-2 bg-transparent text-espresso border-[2.5px] border-espresso rounded-full shadow-[3px_3px_0_#1C0F05] hover:bg-espresso hover:text-cream transition-all cursor-pointer">
                        Cancel
                      </AlertDialogCancel>
                      <AlertDialogAction
                        onClick={onDisconnect}
                        disabled={isDisconnecting}
                        className="inline-flex items-center justify-center gap-1.5 font-body font-extrabold uppercase tracking-widest text-[0.7rem] px-4 py-2 bg-tomato text-cream border-[2.5px] border-espresso rounded-full shadow-[3px_3px_0_#1C0F05] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_#1C0F05] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer"
                      >
                        {isDisconnecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Unplug className="h-3.5 w-3.5" />}
                        Disconnect
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
                              <button className="inline-flex items-center justify-center h-8 w-8 rounded-lg text-espresso/40 hover:text-tomato hover:bg-tomato/10 transition-colors cursor-pointer">
                                <Trash2 className="h-4 w-4" />
                                <span className="sr-only">Remove member</span>
                              </button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="max-w-sm p-0 gap-0 border-[3px] border-espresso rounded-[16px] overflow-hidden bg-chalk shadow-[8px_8px_0_#1C0F05]">
                              <div className="bg-cream border-b-[3px] border-espresso px-6 py-4">
                                <AlertDialogHeader>
                                  <AlertDialogTitle className="font-body font-extrabold uppercase tracking-widest text-espresso text-sm">
                                    Remove Team Member?
                                  </AlertDialogTitle>
                                  <AlertDialogDescription className="font-body text-sm text-espresso/60 mt-1">
                                    This will remove {member.first_name} {member.last_name} from your team. They will no longer have access to your workspace data.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                              </div>
                              <AlertDialogFooter className="px-6 py-4 flex justify-end gap-2">
                                <AlertDialogCancel className="inline-flex items-center justify-center font-body font-extrabold uppercase tracking-widest text-[0.7rem] px-4 py-2 bg-transparent text-espresso border-[2.5px] border-espresso rounded-full shadow-[3px_3px_0_#1C0F05] hover:bg-espresso hover:text-cream transition-all cursor-pointer">
                                  Cancel
                                </AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => onRemoveMember(member.id)}
                                  className="inline-flex items-center justify-center font-body font-extrabold uppercase tracking-widest text-[0.7rem] px-4 py-2 bg-tomato text-cream border-[2.5px] border-espresso rounded-full shadow-[3px_3px_0_#1C0F05] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_#1C0F05] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer"
                                >
                                  Remove
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
  );
}

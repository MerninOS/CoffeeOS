"use client";

import { Coffee, Plus, Trash2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Btn, FieldLabel, MerninInput, Panel } from "./primitives";
import type { AssignedCoffee, CoffeeStock } from "./types";

/**
 * Roasted coffee pulled for this order.
 *
 * Moved byte-for-byte (CoffeeOS#70 Stage A). The prop list is long because the
 * current design keeps dialog visibility, form fields and the pending
 * transition in the same component as the markup — that tangle is a finding,
 * not just plumbing, and Stage B dissolves most of it by replacing the dialog
 * with an inline worksheet row.
 *
 * This block draws down roasted stock and contributes NOTHING to COGS, despite
 * wearing the same panel chrome as the three cost panels. A capability test
 * asserts exactly that (`assigning roasted coffee does not change COGS`),
 * because the chrome is how an extraction could wire it into the wrong total.
 *
 * `coffee-assignment` is a test contract — the row and the "Total Assigned"
 * line carry the same gram figure, so text alone cannot address one of them.
 */
export function RoastedCoffeePanel({
  isAddCoffeeOpen,
  setIsAddCoffeeOpen,
  coffeeStock,
  selectedCoffeeId,
  setSelectedCoffeeId,
  coffeeAmount,
  setCoffeeAmount,
  handleAssignCoffee,
  isPending,
  assignedCoffeeList,
  totalAssignedCoffeeG,
  gramsToLbs,
  setDeleteAssignmentId,
}: {
  isAddCoffeeOpen: boolean;
  setIsAddCoffeeOpen: (v: boolean) => void;
  coffeeStock: CoffeeStock[];
  selectedCoffeeId: string;
  setSelectedCoffeeId: (v: string) => void;
  coffeeAmount: string;
  setCoffeeAmount: (v: string) => void;
  handleAssignCoffee: () => void;
  isPending: boolean;
  assignedCoffeeList: AssignedCoffee[];
  totalAssignedCoffeeG: number;
  gramsToLbs: (g: number) => string;
  setDeleteAssignmentId: (id: string | null) => void;
}) {
  return (
  <Panel
    title="Assigned Roasted Coffee"
    action={
      <Dialog open={isAddCoffeeOpen} onOpenChange={setIsAddCoffeeOpen}>
        <DialogTrigger asChild>
          <Btn size="sm" variant="outline">
            <Plus size={12} strokeWidth={2.5} className="mr-1" />
            Assign Coffee
          </Btn>
        </DialogTrigger>
        <DialogContent className="max-w-md p-0 gap-0 border-[3px] border-espresso rounded-[16px] overflow-hidden bg-chalk shadow-flat-lg">
          <div className="bg-cream border-b-[3px] border-espresso px-6 py-4">
            <DialogHeader>
              <DialogTitle className="font-extrabold text-[15px] uppercase tracking-[.08em] text-espresso">
                Assign Roasted Coffee
              </DialogTitle>
              <DialogDescription className="text-[12px] text-espresso/60 mt-1">
                Deducts from your roasted stock.
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="px-6 py-5 space-y-4">
            <div>
              <FieldLabel>Coffee</FieldLabel>
              <Select value={selectedCoffeeId} onValueChange={setSelectedCoffeeId}>
                <SelectTrigger className="border-[2.5px] border-espresso bg-cream rounded-[10px] shadow-[3px_3px_0_#1C0F05] focus:ring-0 focus:border-tomato">
                  <SelectValue placeholder="Select coffee..." />
                </SelectTrigger>
                <SelectContent>
                  {coffeeStock.map((coffee) => (
                    <SelectItem key={coffee.id} value={coffee.id}>
                      {coffee.name} ({coffee.roasted_stock_g}g available)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <FieldLabel>Amount (grams)</FieldLabel>
              <MerninInput
                type="number"
                value={coffeeAmount}
                onChange={(e) => setCoffeeAmount(e.target.value)}
                placeholder="Enter amount in grams"
              />
            </div>
          </div>
          <div className="bg-cream border-t-[3px] border-espresso px-6 py-4 flex justify-end gap-2">
            <Btn variant="outline" onClick={() => setIsAddCoffeeOpen(false)}>Cancel</Btn>
            <Btn onClick={handleAssignCoffee} disabled={isPending}>Assign Coffee</Btn>
          </div>
        </DialogContent>
      </Dialog>
    }
  >
    {assignedCoffeeList.length === 0 ? (
      <div className="py-6 text-center">
        <Coffee size={28} strokeWidth={1.5} className="mx-auto mb-2 text-espresso/30" />
        <p className="text-[13px] font-medium text-espresso/50">No roasted coffee assigned yet.</p>
        {coffeeStock.length > 0 && (
          <p className="text-[11px] text-espresso/40 mt-1">Click &quot;Assign Coffee&quot; to add from your stock.</p>
        )}
      </div>
    ) : (
      <div className="space-y-2">
        {assignedCoffeeList.map((assignment) => (
          <div
            key={assignment.id}
            /* Test contract — see the note on `detail-cogs`. A coffee
               assignment row and the "Total Assigned" line both render the
               same gram figure, so text alone cannot address one of them. */
            data-testid="coffee-assignment"
            className="flex items-center justify-between rounded-[10px] border-[2px] border-fog bg-cream px-4 py-2.5"
          >
            <div>
              <span className="font-bold text-[13px] text-espresso">{assignment.coffeeName}</span>
              <div className="text-[11px] text-espresso/50 font-medium">
                {assignment.amountG.toLocaleString()}g ({gramsToLbs(assignment.amountG)} lbs)
              </div>
            </div>
            <button
              onClick={() => setDeleteAssignmentId(assignment.id)}
              className="p-1.5 rounded-[8px] text-espresso/40 hover:text-tomato hover:bg-tomato/10 transition-colors"
            >
              <Trash2 size={14} strokeWidth={2.2} />
            </button>
          </div>
        ))}
        <div className="flex justify-between rounded-[10px] border-[2px] border-espresso bg-cream px-4 py-2.5 mt-2">
          <span className="font-extrabold text-[12px] uppercase tracking-[.06em] text-espresso">Total Assigned</span>
          <span className="font-extrabold text-[13px] text-honey">
            {totalAssignedCoffeeG.toLocaleString()}g ({gramsToLbs(totalAssignedCoffeeG)} lbs)
          </span>
        </div>
      </div>
    )}
  </Panel>

  );
}

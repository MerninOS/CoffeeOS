"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { RoastRequest, CoffeeInventory, RoastPriority } from "./types";
import { Btn, FieldLabel, MerninInput, MerninTextarea } from "./primitives";

interface RequestDialogFormData {
  greenCoffeeId: string;
  quantityG: string;
  priority: RoastPriority;
  dueDate: string;
  notes: string;
}

interface RequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingRequest: RoastRequest | null;
  coffeeInventory: CoffeeInventory[];
  formData: RequestDialogFormData;
  setFormData: (next: RequestDialogFormData) => void;
  isSubmitting: boolean;
  onSubmit: () => void;
}

export function RequestDialog({
  open,
  onOpenChange,
  editingRequest,
  coffeeInventory,
  formData,
  setFormData,
  isSubmitting,
  onSubmit,
}: RequestDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 gap-0 border-[3px] border-espresso rounded-[16px] overflow-hidden bg-chalk shadow-flat-lg">
        <div className="bg-cream border-b-[3px] border-espresso px-6 py-4">
          <DialogHeader>
            <DialogTitle className="font-extrabold text-[15px] uppercase tracking-[.08em] text-espresso">
              {editingRequest ? "Edit Roast Request" : "New Roast Request"}
            </DialogTitle>
          </DialogHeader>
        </div>
        <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
          <div>
            <FieldLabel>Coffee</FieldLabel>
            <Select
              value={formData.greenCoffeeId}
              onValueChange={(value) => setFormData({ ...formData, greenCoffeeId: value })}
              disabled={!!editingRequest}
            >
              <SelectTrigger className="border-[2.5px] border-espresso bg-cream text-espresso font-medium text-[13px] rounded-[8px] shadow-[2px_2px_0_#1C0F05]">
                <SelectValue placeholder="Select coffee" />
              </SelectTrigger>
              <SelectContent>
                {coffeeInventory.map((coffee) => (
                  <SelectItem key={coffee.id} value={coffee.id}>
                    <div className="flex items-center justify-between gap-4">
                      <span>{coffee.name}</span>
                      <span className="text-muted-foreground text-xs">
                        {coffee.current_green_quantity_g.toLocaleString()}g available
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <FieldLabel>Quantity (grams)</FieldLabel>
            <MerninInput
              type="number"
              step="1"
              value={formData.quantityG}
              onChange={(e) => setFormData({ ...formData, quantityG: e.target.value })}
              placeholder="Enter quantity in grams"
            />
          </div>

          <div>
            <FieldLabel>Priority</FieldLabel>
            <Select
              value={formData.priority}
              onValueChange={(value: "low" | "normal" | "high" | "urgent") =>
                setFormData({ ...formData, priority: value })
              }
            >
              <SelectTrigger className="border-[2.5px] border-espresso bg-cream text-espresso font-medium text-[13px] rounded-[8px] shadow-[2px_2px_0_#1C0F05]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <FieldLabel>Due Date (optional)</FieldLabel>
            <MerninInput
              type="date"
              value={formData.dueDate}
              onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
            />
          </div>

          <div>
            <FieldLabel>Notes (optional)</FieldLabel>
            <MerninTextarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Add any notes..."
              rows={3}
            />
          </div>
        </div>
        <div className="bg-cream border-t-[3px] border-espresso px-6 py-4 flex justify-end gap-2">
          <Btn variant="outline" onClick={() => onOpenChange(false)}>Cancel</Btn>
          <Btn
            onClick={onSubmit}
            disabled={isSubmitting || !formData.greenCoffeeId || !formData.quantityG}
          >
            {isSubmitting ? "Saving..." : editingRequest ? "Update" : "Create"}
          </Btn>
        </div>
      </DialogContent>
    </Dialog>
  );
}

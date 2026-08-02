"use client";

import { useState } from "react";
import { Plus, Coffee } from "lucide-react";
import {
  createRoastRequest,
  updateRoastRequest,
  deleteRoastRequest,
} from "./actions";
import { overline, sans } from "@/lib/instrument/tokens";
import type { RoastRequest, CoffeeInventory } from "./components/requests/types";
import { Btn } from "./components/requests/primitives";
import { RequestsTable } from "./components/requests/RequestsTable";
import { RequestCard } from "./components/requests/RequestCard";
import { RequestDialog } from "./components/requests/RequestDialog";

interface RoastRequestsClientProps {
  requests: RoastRequest[];
  coffeeInventory: CoffeeInventory[];
}

const LBS_TO_GRAMS = 453.592;
const gramsToLbs = (g: number) => (g / LBS_TO_GRAMS).toFixed(2);

export function RoastRequestsClient({ requests, coffeeInventory }: RoastRequestsClientProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRequest, setEditingRequest] = useState<RoastRequest | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    greenCoffeeId: "",
    quantityG: "",
    priority: "normal" as "low" | "normal" | "high" | "urgent",
    dueDate: "",
    notes: "",
  });

  const resetForm = () => {
    setFormData({ greenCoffeeId: "", quantityG: "", priority: "normal", dueDate: "", notes: "" });
    setEditingRequest(null);
  };

  const openCreateDialog = () => { resetForm(); setIsDialogOpen(true); };

  const openEditDialog = (request: RoastRequest) => {
    setEditingRequest(request);
    setFormData({
      greenCoffeeId: request.green_coffee_id,
      quantityG: request.requested_roasted_g.toString(),
      priority: request.priority,
      dueDate: request.due_date || "",
      notes: request.notes || "",
    });
    setIsDialogOpen(true);
  };

  const selectedCoffee = coffeeInventory.find((c) => c.id === formData.greenCoffeeId);

  const handleSubmit = async () => {
    if (!formData.greenCoffeeId || !formData.quantityG) return;
    setIsSubmitting(true);
    try {
      const quantityG = parseFloat(formData.quantityG);
      if (editingRequest) {
        const result = await updateRoastRequest(editingRequest.id, {
          requestedRoastedG: quantityG,
          priority: formData.priority,
          dueDate: formData.dueDate || undefined,
          notes: formData.notes || undefined,
        });
        if (result.error) { alert(result.error); return; }
      } else {
        if (!selectedCoffee) return;
        const result = await createRoastRequest({
          greenCoffeeId: formData.greenCoffeeId,
          coffeeName: selectedCoffee.name,
          requestedRoastedG: quantityG,
          priority: formData.priority,
          dueDate: formData.dueDate || undefined,
          notes: formData.notes || undefined,
        });
        if (result.error) { alert(result.error); return; }
        if (result.merged) {
          alert(`Added ${quantityG}g to existing roast request for ${selectedCoffee.name}.`);
        }
      }
      setIsDialogOpen(false);
      resetForm();
      window.location.reload();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this roast request?")) return;
    const result = await deleteRoastRequest(id);
    if (result.error) { alert(result.error); return; }
    window.location.reload();
  };

  const handleStatusChange = async (
    id: string,
    status: "pending" | "in_progress" | "fulfilled" | "cancelled"
  ) => {
    const result = await updateRoastRequest(id, { status });
    if (result.error) { alert(result.error); return; }
    window.location.reload();
  };

  const sortedRequests = [...requests].sort((a, b) => {
    const priorityOrder = { urgent: 0, high: 1, normal: 2, low: 3 };
    if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }
    if (a.due_date && b.due_date) return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
    if (a.due_date) return -1;
    if (b.due_date) return 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const pendingRequests = sortedRequests.filter((r) => r.status === "pending" || r.status === "in_progress");
  const completedRequests = sortedRequests.filter((r) => r.status === "fulfilled" || r.status === "cancelled");

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 style={{ fontFamily: "var(--font-sans)", fontSize: "var(--fs-title-sm)", fontWeight: "var(--fw-semibold)" as unknown as number, color: "var(--ink)" }}>
            Roast Requests
          </h2>
          <p style={{ ...sans, fontSize: "var(--fs-caption)", color: "var(--ink-muted)", marginTop: 2 }}>
            Track and manage roasting requests from orders
          </p>
        </div>
        <Btn data-testid="new-request" onClick={openCreateDialog}>
          <Plus size={12} strokeWidth={2.5} />
          New Request
        </Btn>
      </div>

      {/* Active Requests — worksheet, not a card: hairline border on --surface, no offset shadow. */}
      {pendingRequests.length > 0 && (
        <div
          data-testid="requests-active"
          style={{ border: "1px solid var(--hairline)", borderRadius: "var(--r-md)", overflow: "hidden", background: "var(--surface)" }}
        >
          {/* Desktop table */}
          <RequestsTable
            requests={pendingRequests}
            variant="active"
            onEdit={openEditDialog}
            onDelete={handleDelete}
            onStatusChange={handleStatusChange}
          />

          {/* Mobile cards */}
          <div className="md:hidden">
            {pendingRequests.map((request, i) => (
              <div key={request.id} style={i > 0 ? { borderTop: "1px solid var(--hairline)" } : undefined}>
                <RequestCard
                  request={request}
                  variant="active"
                  onEdit={openEditDialog}
                  onDelete={handleDelete}
                  onStatusChange={handleStatusChange}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {pendingRequests.length === 0 && (
        <div
          className="flex flex-col items-center justify-center py-12 text-center px-6"
          style={{ border: "1px solid var(--hairline)", borderRadius: "var(--r-md)", background: "var(--surface)" }}
        >
          <Coffee size={32} strokeWidth={1.5} style={{ color: "var(--ink-subtle)", marginBottom: 12 }} />
          <h3 style={{ fontFamily: "var(--font-sans)", fontSize: "var(--fs-body-lg)", fontWeight: "var(--fw-semibold)" as unknown as number, color: "var(--ink)", marginBottom: 4 }}>
            No Active Requests
          </h3>
          <p style={{ ...sans, fontSize: "var(--fs-caption)", color: "var(--ink-muted)", marginBottom: 16 }}>
            Create a roast request manually or from an order to get started.
          </p>
          <Btn onClick={openCreateDialog}>
            <Plus size={12} strokeWidth={2.5} />
            New Request
          </Btn>
        </div>
      )}

      {/* Completed Requests — visually quieter than the active queue, per the design proposal. */}
      {completedRequests.length > 0 && (
        <div data-testid="requests-completed" className="flex flex-col gap-3">
          <h3 style={{ ...overline, color: "var(--ink-subtle)" }}>Fulfilled &amp; Cancelled</h3>
          <div
            style={{
              border: "1px solid var(--hairline)",
              borderRadius: "var(--r-md)",
              overflow: "hidden",
              background: "var(--surface)",
              opacity: 0.85,
            }}
          >
            {/* Desktop */}
            <RequestsTable
              requests={completedRequests.slice(0, 5)}
              variant="completed"
              onEdit={openEditDialog}
              onDelete={handleDelete}
              onStatusChange={handleStatusChange}
            />
            {/* Mobile */}
            <div className="md:hidden">
              {completedRequests.slice(0, 5).map((request, i) => (
                <div key={request.id} style={i > 0 ? { borderTop: "1px solid var(--hairline)" } : undefined}>
                  <RequestCard
                    request={request}
                    variant="completed"
                    onEdit={openEditDialog}
                    onDelete={handleDelete}
                    onStatusChange={handleStatusChange}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Dialog */}
      <RequestDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        editingRequest={editingRequest}
        coffeeInventory={coffeeInventory}
        formData={formData}
        setFormData={setFormData}
        isSubmitting={isSubmitting}
        onSubmit={handleSubmit}
      />
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Plus, Flame } from "lucide-react";
import { EmptyState } from "@merninos/ui/instrument";
import { sans } from "@/lib/instrument/tokens";
import { createSession, deleteSession } from "./actions";
import { Btn } from "./components/sessions/primitives";
import { SessionsTable } from "./components/sessions/SessionsTable";
import { SessionCard } from "./components/sessions/SessionCard";
import { SessionDialog, type SessionFormData } from "./components/sessions/SessionDialog";
import { DeleteDialog } from "./components/sessions/DeleteDialog";
import { YieldBand } from "./components/sessions/YieldBand";
import type { Session } from "./components/sessions/types";
import { sessionCost, type CostMode } from "./session-cost";

export type { Session };

/**
 * Retokenized onto instrument (CoffeeOS#71). Three substantive changes beyond
 * the restyle, all scoped by the approved spec:
 *
 *  - The three "Total Sessions / Total Batches / Total Roasted" stat cards
 *    are gone outright, not replaced. They were exactly the "row of equal
 *    cards" the design system forbids, AND they duplicated the shell's own
 *    StatStrip directly above this view — which already shows roasted
 *    weight, and disagreed with these cards on units (grams here, lb there).
 *  - `YieldBand` is wired in above the table, giving the loss figures on
 *    every row a visible scale to be read against.
 *  - The desktop table and mobile cards now share ONE hairline container
 *    (`--surface` / `--hairline` / `--r-md`), the same split RequestsTable /
 *    RequestCard use — no nested bordered "card" boxes with offset shadows.
 */

interface SessionsClientProps {
  initialSessions: Session[];
  hideHeader?: boolean;
}

export function SessionsClient({ initialSessions, hideHeader = false }: SessionsClientProps) {
  const router = useRouter();
  const [sessions, setSessions] = useState(initialSessions);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [formData, setFormData] = useState<SessionFormData>({
    sessionDate: format(new Date(), "yyyy-MM-dd"),
    vendorName: "",
    costMode: "toll_roasting",
    ratePerHour: "",
    ratePerLb: "",
    machineEnergyKwhPerHour: "",
    kwhRate: "",
    setupMinutes: "0",
    cleanupMinutes: "0",
    billingGranularityMinutes: "15",
    allocationMode: "time_weighted",
    notes: "",
  });

  const handleCreate = async () => {
    if (!formData.vendorName) { alert("Please fill in vendor name"); return; }
    if (formData.costMode === "toll_roasting" && !formData.ratePerHour) {
      alert("Please fill in hourly rate for toll roasting"); return;
    }
    if (formData.costMode === "power_usage" && (!formData.machineEnergyKwhPerHour || !formData.kwhRate)) {
      alert("Please fill in machine energy usage and kWh rate"); return;
    }
    if (formData.costMode === "co_roasting" && !formData.ratePerLb) {
      alert("Please fill in rate per pound for co-roasting"); return;
    }

    setIsSubmitting(true);
    const result = await createSession({
      sessionDate: formData.sessionDate,
      vendorName: formData.vendorName,
      costMode: formData.costMode,
      ratePerHour: formData.costMode === "toll_roasting" ? parseFloat(formData.ratePerHour) : 0,
      ratePerLb: formData.costMode === "co_roasting" ? parseFloat(formData.ratePerLb) : undefined,
      machineEnergyKwhPerHour: formData.costMode === "power_usage" ? parseFloat(formData.machineEnergyKwhPerHour) : undefined,
      kwhRate: formData.costMode === "power_usage" ? parseFloat(formData.kwhRate) : undefined,
      setupMinutes: parseInt(formData.setupMinutes) || 0,
      cleanupMinutes: parseInt(formData.cleanupMinutes) || 0,
      billingGranularityMinutes: parseInt(formData.billingGranularityMinutes) || 15,
      allocationMode: formData.allocationMode,
      notes: formData.notes || undefined,
    });
    setIsSubmitting(false);

    if (result.error) { alert(result.error); return; }
    if (result.session) {
      /**
       * The optimistic row has to carry its cost basis too.
       *
       * createSession returns the raw DB row, which has no cost_basis or
       * cost_mode_label — page.tsx derives those. Spreading it alone left a
       * freshly created session rendering a blank line under its cost until the
       * next full page load, which reads as a broken cell rather than a pending
       * one. Recomputed here from the same module the server uses, with no
       * batches, because a new session has none yet.
       */
      const optimistic = sessionCost({
        cost_mode: (result.session.cost_mode || "toll_roasting") as CostMode,
        setup_minutes: result.session.setup_minutes,
        cleanup_minutes: result.session.cleanup_minutes,
        billing_granularity_minutes: result.session.billing_granularity_minutes,
        rate_per_hour: result.session.rate_per_hour,
        rate_per_lb: result.session.rate_per_lb ?? null,
        machine_energy_kwh_per_hour: result.session.machine_energy_kwh_per_hour ?? null,
        kwh_rate: result.session.kwh_rate ?? null,
        batches: [],
      });
      setSessions([
        {
          ...result.session,
          batch_count: 0,
          total_green_weight_g: 0,
          total_roasted_weight_g: 0,
          session_toll_cost: optimistic.cost,
          cost_basis: optimistic.basis,
          cost_mode_label: optimistic.modeLabel,
        },
        ...sessions,
      ]);
      setIsCreateOpen(false);
      setFormData({
        sessionDate: format(new Date(), "yyyy-MM-dd"),
        vendorName: "",
        costMode: "toll_roasting",
        ratePerHour: "",
        ratePerLb: "",
        machineEnergyKwhPerHour: "",
        kwhRate: "",
        setupMinutes: "0",
        cleanupMinutes: "0",
        billingGranularityMinutes: "15",
        allocationMode: "time_weighted",
        notes: "",
      });
      router.push(`/roasting/sessions/${result.session.id}`);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const result = await deleteSession(deleteId);
    if (result.error) { alert(result.error); } else {
      setSessions(sessions.filter((s) => s.id !== deleteId));
    }
    setDeleteId(null);
  };

  const calcWeightLoss = (green: number, roasted: number) => {
    if (!green || !roasted) return null;
    return ((green - roasted) / green) * 100;
  };

  return (
    <div className="space-y-6">
      {/* Header + New Session button */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {!hideHeader && (
          <div>
            <h2 style={{ fontFamily: "var(--font-sans)", fontSize: "var(--fs-title)", fontWeight: "var(--fw-semibold)" as unknown as number, color: "var(--ink)" }}>
              Roasting Sessions
            </h2>
            <p style={{ ...sans, fontSize: "var(--fs-caption)", color: "var(--ink-muted)", marginTop: 2 }}>
              View and manage your roasting sessions
            </p>
          </div>
        )}
        <Btn data-testid="new-session" onClick={() => setIsCreateOpen(true)} className={hideHeader ? "self-start" : "sm:ml-auto"}>
          <Plus size={12} strokeWidth={2.5} />
          New Session
        </Btn>
      </div>

      {sessions.length === 0 ? (
        <div style={{ border: "1px solid var(--hairline)", borderRadius: "var(--r-md)", background: "var(--surface)" }}>
          <EmptyState
            icon={<Flame />}
            title="No Sessions Yet"
            description="Start tracking your roasting by creating your first session"
            action={
              <Btn onClick={() => setIsCreateOpen(true)}>
                <Plus size={12} strokeWidth={2.5} />
                Create First Session
              </Btn>
            }
          />
        </div>
      ) : (
        <>
          <YieldBand sessions={sessions} />

          {/* Desktop table + mobile cards share one hairline container, not
              a stack of individually bordered cards. */}
          <div
            style={{ border: "1px solid var(--hairline)", borderRadius: "var(--r-md)", overflow: "hidden", background: "var(--surface)" }}
          >
            <SessionsTable
              sessions={sessions}
              calcWeightLoss={calcWeightLoss}
              onDelete={setDeleteId}
            />

            <div className="md:hidden">
              {sessions.map((session, i) => (
                <div key={session.id} style={i > 0 ? { borderTop: "1px solid var(--hairline)" } : undefined}>
                  <SessionCard
                    session={session}
                    calcWeightLoss={calcWeightLoss}
                    onDelete={setDeleteId}
                  />
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Create Session Dialog */}
      <SessionDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        formData={formData}
        setFormData={setFormData}
        isSubmitting={isSubmitting}
        onSubmit={handleCreate}
      />

      {/* Delete Confirmation */}
      <DeleteDialog
        open={!!deleteId}
        onOpenChange={() => setDeleteId(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}

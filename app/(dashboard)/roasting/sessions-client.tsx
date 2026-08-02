"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Plus, Flame } from "lucide-react";
import { createSession, deleteSession } from "./actions";
import { Btn } from "./components/sessions/primitives";
import { SessionsTable } from "./components/sessions/SessionsTable";
import { SessionCard } from "./components/sessions/SessionCard";
import { SessionDialog, type SessionFormData } from "./components/sessions/SessionDialog";
import { DeleteDialog } from "./components/sessions/DeleteDialog";
import type { Session } from "./components/sessions/types";

export type { Session };

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
      setSessions([
        { ...result.session, batch_count: 0, total_green_weight_g: 0, total_roasted_weight_g: 0 },
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

  const weightLossColor = (pct: number) =>
    pct > 18 ? "text-tomato" : pct < 12 ? "text-honey" : "text-matcha";

  const totalBatches = sessions.reduce((s, x) => s + x.batch_count, 0);
  const totalRoasted = sessions.reduce((s, x) => s + x.total_roasted_weight_g, 0);

  return (
    <div className="space-y-6">
      {/* Header + New Session button */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {!hideHeader && (
          <div>
            <h2 className="font-extrabold text-[17px] uppercase tracking-[.04em] text-espresso">
              Roasting Sessions
            </h2>
            <p className="text-[12px] text-espresso/50 font-medium mt-0.5">
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
        <div className="bg-chalk border-[3px] border-espresso rounded-[16px] shadow-flat-md flex flex-col items-center justify-center py-14 text-center px-6">
          <Flame size={36} strokeWidth={1.5} className="text-espresso/20 mb-3" />
          <h3 className="font-extrabold text-[15px] uppercase tracking-[.04em] text-espresso mb-1">
            No Sessions Yet
          </h3>
          <p className="text-[12px] text-espresso/50 font-medium mb-4">
            Start tracking your roasting by creating your first session
          </p>
          <Btn onClick={() => setIsCreateOpen(true)}>
            <Plus size={12} strokeWidth={2.5} />
            Create First Session
          </Btn>
        </div>
      ) : (
        <>
          {/* Stat cards — desktop only */}
          <div className="hidden md:grid gap-4 grid-cols-3">
            {[
              { label: "Total Sessions", value: sessions.length.toString() },
              { label: "Total Batches", value: totalBatches.toString() },
              { label: "Total Roasted", value: `${totalRoasted.toFixed(0)}g` },
            ].map((card) => (
              <div
                key={card.label}
                className="bg-chalk border-[3px] border-espresso rounded-[14px] shadow-flat-sm px-5 py-4"
              >
                <p className="text-[10px] font-extrabold uppercase tracking-[.1em] text-espresso/50 mb-1">
                  {card.label}
                </p>
                <p className="text-[26px] font-extrabold text-espresso leading-none">{card.value}</p>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <SessionsTable
            sessions={sessions}
            calcWeightLoss={calcWeightLoss}
            weightLossColor={weightLossColor}
            onDelete={setDeleteId}
          />

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {sessions.map((session) => (
              <SessionCard
                key={session.id}
                session={session}
                calcWeightLoss={calcWeightLoss}
                weightLossColor={weightLossColor}
                onDelete={setDeleteId}
              />
            ))}
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

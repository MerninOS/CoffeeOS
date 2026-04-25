"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Plus, MoreHorizontal, Trash2, Eye, Flame } from "lucide-react";
import { createSession, deleteSession } from "./actions";

export interface Session {
  id: string;
  session_date: string;
  vendor_name: string;
  rate_per_hour: number;
  cost_mode: "toll_roasting" | "power_usage" | "co_roasting";
  rate_per_lb: number | null;
  machine_energy_kwh_per_hour: number | null;
  kwh_rate: number | null;
  setup_minutes: number;
  cleanup_minutes: number;
  billing_granularity_minutes: number;
  allocation_mode: string;
  billable_minutes: number | null;
  session_toll_cost: number | null;
  notes: string | null;
  created_at: string;
  batch_count: number;
  total_green_weight_g: number;
  total_roasted_weight_g: number;
}

interface SessionsClientProps {
  initialSessions: Session[];
  hideHeader?: boolean;
}

type BtnVariant = "primary" | "outline" | "ghost";
function Btn({
  variant = "primary",
  children,
  onClick,
  disabled,
  className = "",
  asChild,
  href,
}: {
  variant?: BtnVariant;
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  asChild?: boolean;
  href?: string;
}) {
  const base =
    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] border-[2.5px] font-extrabold text-[11px] uppercase tracking-[.08em] transition-all duration-[120ms] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed";
  const variants: Record<BtnVariant, string> = {
    primary:
      "bg-tomato text-cream border-espresso shadow-[3px_3px_0_#1C0F05] hover:-translate-x-px hover:-translate-y-px hover:shadow-[4px_4px_0_#1C0F05] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none",
    outline:
      "bg-transparent text-espresso border-espresso hover:bg-fog/40",
    ghost:
      "bg-transparent text-espresso border-transparent hover:bg-fog/30",
  };
  const cls = `${base} ${variants[variant]} ${className}`;
  if (href) {
    return <Link href={href} className={cls}>{children}</Link>;
  }
  return (
    <button onClick={onClick} disabled={disabled} className={cls}>
      {children}
    </button>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-extrabold uppercase tracking-[.08em] text-espresso mb-1.5">
      {children}
    </p>
  );
}

function MerninInput({
  id,
  type = "text",
  value,
  onChange,
  placeholder,
  step,
  min,
  required,
}: {
  id?: string;
  type?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  step?: string;
  min?: string;
  required?: boolean;
}) {
  return (
    <input
      id={id}
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      step={step}
      min={min}
      required={required}
      className="w-full px-3 py-2 rounded-[8px] border-[2.5px] border-espresso bg-cream text-[13px] font-medium text-espresso placeholder:text-espresso/30 shadow-[2px_2px_0_#1C0F05] focus:outline-none focus:shadow-[2px_2px_0_#E8442A] focus:border-tomato"
    />
  );
}

function MerninTextarea({
  id,
  value,
  onChange,
  placeholder,
  rows = 2,
}: {
  id?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <textarea
      id={id}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      rows={rows}
      className="w-full px-3 py-2 rounded-[8px] border-[2.5px] border-espresso bg-cream text-[13px] font-medium text-espresso placeholder:text-espresso/30 shadow-[2px_2px_0_#1C0F05] focus:outline-none focus:shadow-[2px_2px_0_#E8442A] focus:border-tomato resize-none"
    />
  );
}

const COST_MODES = [
  { value: "toll_roasting", label: "Toll Roasting" },
  { value: "power_usage", label: "Power Usage" },
  { value: "co_roasting", label: "Co-Roasting" },
] as const;

export function SessionsClient({ initialSessions, hideHeader = false }: SessionsClientProps) {
  const router = useRouter();
  const [sessions, setSessions] = useState(initialSessions);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    sessionDate: format(new Date(), "yyyy-MM-dd"),
    vendorName: "",
    costMode: "toll_roasting" as "toll_roasting" | "power_usage" | "co_roasting",
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
        <Btn onClick={() => setIsCreateOpen(true)} className={hideHeader ? "self-start" : "sm:ml-auto"}>
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
          <div className="hidden md:block bg-chalk border-[3px] border-espresso rounded-[16px] shadow-flat-md overflow-hidden">
            <div className="grid grid-cols-[120px_1fr_70px_90px_90px_90px_90px_48px] border-b-[2px] border-espresso bg-cream px-5 py-2.5">
              {["Date", "Vendor", "Batches", "Green (g)", "Roasted (g)", "Loss", "Cost", ""].map((h) => (
                <div key={h} className="text-[10px] font-extrabold uppercase tracking-[.1em] text-espresso/50">
                  {h}
                </div>
              ))}
            </div>
            <div className="divide-y-[1.5px] divide-dashed divide-fog">
              {sessions.map((session) => {
                const wl = calcWeightLoss(session.total_green_weight_g, session.total_roasted_weight_g);
                return (
                  <div
                    key={session.id}
                    className="grid grid-cols-[120px_1fr_70px_90px_90px_90px_90px_48px] px-5 py-3 items-center"
                  >
                    <div>
                      <Link
                        href={`/roasting/sessions/${session.id}`}
                        className="text-[13px] font-bold text-espresso hover:text-tomato transition-colors"
                      >
                        {format(new Date(session.session_date), "MMM d, yyyy")}
                      </Link>
                    </div>
                    <div className="text-[13px] text-espresso/60 font-medium truncate pr-3">
                      {session.vendor_name}
                    </div>
                    <div className="text-[13px] font-bold text-espresso text-center">
                      {session.batch_count}
                    </div>
                    <div className="text-[13px] font-medium text-espresso text-right">
                      {session.total_green_weight_g.toFixed(0)}
                    </div>
                    <div className="text-[13px] font-medium text-espresso text-right">
                      {session.total_roasted_weight_g.toFixed(0)}
                    </div>
                    <div className="text-right">
                      {wl !== null ? (
                        <span className={`text-[13px] font-extrabold ${weightLossColor(wl)}`}>
                          {wl.toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-espresso/30 text-[13px]">—</span>
                      )}
                    </div>
                    <div className="text-[13px] font-bold text-espresso text-right">
                      {session.session_toll_cost !== null
                        ? `$${session.session_toll_cost.toFixed(2)}`
                        : <span className="text-espresso/30">—</span>}
                    </div>
                    <div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="flex h-7 w-7 items-center justify-center rounded-[6px] border-[2px] border-transparent text-espresso/50 hover:border-fog hover:text-espresso hover:bg-fog/30 transition-all">
                            <MoreHorizontal size={14} strokeWidth={2} />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/roasting/sessions/${session.id}`}>
                              <Eye className="mr-2 h-4 w-4" />View Details
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setDeleteId(session.id)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {sessions.map((session) => {
              const wl = calcWeightLoss(session.total_green_weight_g, session.total_roasted_weight_g);
              return (
                <div
                  key={session.id}
                  className="bg-chalk border-[3px] border-espresso rounded-[14px] shadow-flat-sm p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <Link
                        href={`/roasting/sessions/${session.id}`}
                        className="text-[14px] font-extrabold text-espresso hover:text-tomato transition-colors block"
                      >
                        {format(new Date(session.session_date), "MMM d, yyyy")}
                      </Link>
                      <p className="text-[12px] text-espresso/50 font-medium truncate mt-0.5">
                        {session.vendor_name}
                      </p>
                    </div>
                    <span className="inline-flex items-center px-2 py-1 rounded-full border-[2px] border-espresso bg-fog/40 text-[10px] font-extrabold text-espresso shrink-0">
                      {session.batch_count} {session.batch_count === 1 ? "batch" : "batches"}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {[
                      { label: "Roasted", value: `${session.total_roasted_weight_g.toFixed(0)}g` },
                      {
                        label: "Loss",
                        value: wl !== null
                          ? <span className={`font-extrabold ${weightLossColor(wl)}`}>{wl.toFixed(1)}%</span>
                          : <span className="text-espresso/30">—</span>,
                      },
                      {
                        label: "Cost",
                        value: session.session_toll_cost !== null
                          ? `$${session.session_toll_cost.toFixed(2)}`
                          : <span className="text-espresso/30">—</span>,
                      },
                    ].map((stat) => (
                      <div key={stat.label}>
                        <span className="text-[10px] text-espresso/40 font-extrabold uppercase tracking-[.08em] block">
                          {stat.label}
                        </span>
                        <span className="text-[13px] font-bold text-espresso">{stat.value}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Btn href={`/roasting/sessions/${session.id}`} className="flex-1 justify-center">
                      <Eye size={11} strokeWidth={2.2} />
                      View Session
                    </Btn>
                    <button
                      onClick={() => setDeleteId(session.id)}
                      className="flex h-8 w-8 items-center justify-center rounded-[8px] border-[2.5px] border-espresso text-tomato hover:bg-tomato/10 transition-all"
                    >
                      <Trash2 size={13} strokeWidth={2} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Create Session Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-lg p-0 gap-0 border-[3px] border-espresso rounded-[16px] overflow-hidden bg-chalk shadow-flat-lg max-h-[90vh]">
          <div className="bg-cream border-b-[3px] border-espresso px-6 py-4">
            <DialogHeader>
              <DialogTitle className="font-extrabold text-[15px] uppercase tracking-[.08em] text-espresso">
                Create Roasting Session
              </DialogTitle>
            </DialogHeader>
          </div>
          <div className="px-6 py-5 space-y-4 overflow-y-auto">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <FieldLabel>Session Date</FieldLabel>
                <MerninInput
                  id="sessionDate"
                  type="date"
                  value={formData.sessionDate}
                  onChange={(e) => setFormData({ ...formData, sessionDate: e.target.value })}
                  required
                />
              </div>
              <div>
                <FieldLabel>Vendor / Roastery Name</FieldLabel>
                <MerninInput
                  id="vendorName"
                  value={formData.vendorName}
                  onChange={(e) => setFormData({ ...formData, vendorName: e.target.value })}
                  placeholder="e.g., Mill City Roasters"
                  required
                />
              </div>
            </div>

            {/* Cost Mode toggle */}
            <div>
              <FieldLabel>Roasting Cost Method</FieldLabel>
              <div className="flex gap-1.5">
                {COST_MODES.map((mode) => (
                  <button
                    key={mode.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, costMode: mode.value })}
                    className={`flex-1 py-1.5 rounded-[8px] border-[2px] font-extrabold text-[10px] uppercase tracking-[.07em] transition-all duration-[120ms] ${
                      formData.costMode === mode.value
                        ? "bg-espresso text-cream border-espresso"
                        : "bg-transparent text-espresso border-fog hover:border-espresso/40"
                    }`}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {formData.costMode === "toll_roasting" && (
                <div>
                  <FieldLabel>Rate per Hour ($)</FieldLabel>
                  <MerninInput
                    id="ratePerHour"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.ratePerHour}
                    onChange={(e) => setFormData({ ...formData, ratePerHour: e.target.value })}
                    placeholder="e.g., 75.00"
                    required
                  />
                </div>
              )}
              {formData.costMode === "power_usage" && (
                <>
                  <div>
                    <FieldLabel>Machine Usage (kWh/hr)</FieldLabel>
                    <MerninInput
                      id="machineEnergyKwhPerHour"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.machineEnergyKwhPerHour}
                      onChange={(e) => setFormData({ ...formData, machineEnergyKwhPerHour: e.target.value })}
                      placeholder="e.g., 6.5"
                      required
                    />
                  </div>
                  <div>
                    <FieldLabel>Cost per kWh ($)</FieldLabel>
                    <MerninInput
                      id="kwhRate"
                      type="number"
                      step="0.0001"
                      min="0"
                      value={formData.kwhRate}
                      onChange={(e) => setFormData({ ...formData, kwhRate: e.target.value })}
                      placeholder="e.g., 0.1350"
                      required
                    />
                  </div>
                </>
              )}
              {formData.costMode === "co_roasting" && (
                <div>
                  <FieldLabel>Rate per Pound – Green ($)</FieldLabel>
                  <MerninInput
                    id="ratePerLb"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.ratePerLb}
                    onChange={(e) => setFormData({ ...formData, ratePerLb: e.target.value })}
                    placeholder="e.g., 2.50"
                    required
                  />
                </div>
              )}
            </div>

            {formData.costMode !== "co_roasting" && (
              <>
                <div>
                  <FieldLabel>Billing Granularity (min)</FieldLabel>
                  <MerninInput
                    id="billingGranularityMinutes"
                    type="number"
                    min="1"
                    value={formData.billingGranularityMinutes}
                    onChange={(e) => setFormData({ ...formData, billingGranularityMinutes: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <FieldLabel>Setup Time (min)</FieldLabel>
                    <MerninInput
                      id="setupMinutes"
                      type="number"
                      min="0"
                      value={formData.setupMinutes}
                      onChange={(e) => setFormData({ ...formData, setupMinutes: e.target.value })}
                    />
                  </div>
                  <div>
                    <FieldLabel>Cleanup Time (min)</FieldLabel>
                    <MerninInput
                      id="cleanupMinutes"
                      type="number"
                      min="0"
                      value={formData.cleanupMinutes}
                      onChange={(e) => setFormData({ ...formData, cleanupMinutes: e.target.value })}
                    />
                  </div>
                </div>
              </>
            )}

            <div>
              <FieldLabel>Notes (optional)</FieldLabel>
              <MerninTextarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Any notes for this session..."
                rows={2}
              />
            </div>
          </div>
          <div className="bg-cream border-t-[3px] border-espresso px-6 py-4 flex justify-end gap-2">
            <Btn variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Btn>
            <Btn onClick={handleCreate} disabled={isSubmitting}>
              {isSubmitting ? "Creating..." : "Create Session"}
            </Btn>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="p-0 gap-0 border-[3px] border-espresso rounded-[16px] overflow-hidden bg-chalk shadow-flat-lg max-w-sm">
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
              onClick={handleDelete}
              className="inline-flex items-center px-3 py-1.5 rounded-[8px] border-[2.5px] border-espresso bg-tomato text-cream font-extrabold text-[11px] uppercase tracking-[.08em] shadow-[3px_3px_0_#1C0F05] hover:-translate-x-px hover:-translate-y-px hover:shadow-[4px_4px_0_#1C0F05] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"
            >
              Delete
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

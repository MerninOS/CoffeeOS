"use client";

import { useState } from "react";
import Link from "next/link";
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
  DropdownMenuSeparator,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, MoreHorizontal, Trash2, Eye, Package, Plus } from "lucide-react";
import { deleteBatch, createComponentFromBatch, addToExistingComponent } from "../actions";

interface Batch {
  id: string;
  coffee_name: string;
  lot_code: string | null;
  price_basis: "per_lb" | "per_kg";
  price_value: number;
  green_weight_g: number;
  roasted_weight_g: number;
  rejects_g: number;
  sellable_g: number;
  loss_percent: number;
  roast_minutes: number;
  batch_date: string;
  energy_kwh: number | null;
  kwh_rate: number | null;
  green_cost_per_g: number;
  component_id: string | null;
  created_at: string;
  roasting_sessions: {
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
    session_toll_cost: number | null;
  } | null;
  components: {
    id: string;
    name: string;
  } | null;
}

interface ExistingComponent {
  id: string;
  name: string;
  cost_per_unit: number;
  unit: string;
  type: string;
}

interface BatchesClientProps {
  initialBatches: Batch[];
  existingComponents: ExistingComponent[];
}

const UNITS = ["g", "oz", "lb", "kg"];
const COST_PER_UNIT_DECIMALS = 8;

type BtnVariant = "primary" | "outline" | "ghost";
function Btn({
  variant = "primary",
  children,
  onClick,
  disabled,
  className = "",
  href,
}: {
  variant?: BtnVariant;
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
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
      "bg-transparent text-espresso border-fog hover:border-espresso/40 hover:bg-fog/30",
  };
  const cls = `${base} ${variants[variant]} ${className}`;
  if (href) return <Link href={href} className={cls}>{children}</Link>;
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
}: {
  id?: string;
  type?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  step?: string;
}) {
  return (
    <input
      id={id}
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      step={step}
      className="w-full px-3 py-2 rounded-[8px] border-[2.5px] border-espresso bg-cream text-[13px] font-medium text-espresso placeholder:text-espresso/30 shadow-[2px_2px_0_#1C0F05] focus:outline-none focus:shadow-[2px_2px_0_#E8442A] focus:border-tomato"
    />
  );
}

const getSessionAggForBatch = (batch: Batch, allBatches: Batch[]) => {
  if (!batch.roasting_sessions) return { totalRoastMinutes: batch.roast_minutes || 0, batchCount: 1 };
  const sessionId = batch.roasting_sessions.id;
  const sessionBatches = allBatches.filter((b) => b.roasting_sessions?.id === sessionId);
  const totalRoastMinutes = sessionBatches.reduce((sum, b) => sum + (b.roast_minutes || 0), 0);
  return { totalRoastMinutes, batchCount: Math.max(sessionBatches.length, 1) };
};

const getSessionCostForBatch = (batch: Batch, allBatches: Batch[]) => {
  if (!batch.roasting_sessions) return 0;
  const session = batch.roasting_sessions;
  if (session.cost_mode === "co_roasting") {
    const sessionBatches = allBatches.filter((b) => b.roasting_sessions?.id === session.id);
    return sessionBatches.reduce(
      (sum, b) => sum + (b.green_weight_g / 453.592) * (session.rate_per_lb || 0),
      0
    );
  }
  const { totalRoastMinutes } = getSessionAggForBatch(batch, allBatches);
  const totalSessionMinutes = (session.setup_minutes || 0) + totalRoastMinutes + (session.cleanup_minutes || 0);
  const billableMinutes =
    Math.ceil(totalSessionMinutes / (session.billing_granularity_minutes || 15)) *
    (session.billing_granularity_minutes || 15);
  if (session.cost_mode === "power_usage") {
    return (billableMinutes / 60) * (session.machine_energy_kwh_per_hour || 0) * (session.kwh_rate || 0);
  }
  return (billableMinutes / 60) * (session.rate_per_hour || 0);
};

const getBatchCostPerGram = (batch: Batch, allBatches: Batch[]) => {
  if (batch.sellable_g <= 0) return 0;
  const session = batch.roasting_sessions;
  const totalGreenCost = batch.green_cost_per_g * batch.green_weight_g;
  if (session?.cost_mode === "co_roasting") {
    const roastingCost = (batch.green_weight_g / 453.592) * (session.rate_per_lb || 0);
    return (totalGreenCost + roastingCost) / batch.sellable_g;
  }
  const { totalRoastMinutes, batchCount } = getSessionAggForBatch(batch, allBatches);
  const setupMinutes = session?.setup_minutes || 0;
  const cleanupMinutes = session?.cleanup_minutes || 0;
  const totalSessionMinutes = setupMinutes + totalRoastMinutes + cleanupMinutes;
  const batchEffectiveMinutes = (batch.roast_minutes || 0) + (setupMinutes + cleanupMinutes) / batchCount;
  const sessionCost = getSessionCostForBatch(batch, allBatches);
  const allocatedSessionCost =
    totalSessionMinutes > 0 ? sessionCost * (batchEffectiveMinutes / totalSessionMinutes) : 0;
  return (totalGreenCost + allocatedSessionCost) / batch.sellable_g;
};

const lossColor = (pct: number) =>
  pct > 18 ? "text-tomato" : pct < 12 ? "text-honey" : "text-matcha";

export function BatchesClient({ initialBatches, existingComponents }: BatchesClientProps) {
  const [batches, setBatches] = useState(initialBatches);
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [createComponentBatch, setCreateComponentBatch] = useState<Batch | null>(null);
  const [componentMode, setComponentMode] = useState<"new" | "existing">("new");
  const [selectedComponentId, setSelectedComponentId] = useState<string>("");
  const [componentFormData, setComponentFormData] = useState({
    name: "",
    costPerUnit: "",
    unit: "g",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filteredBatches = batches.filter((batch) => {
    const q = searchQuery.toLowerCase();
    return batch.coffee_name?.toLowerCase().includes(q) || batch.lot_code?.toLowerCase().includes(q);
  });

  const handleDelete = async () => {
    if (!deleteId) return;
    const result = await deleteBatch(deleteId);
    if (result.error) { alert(result.error); } else {
      setBatches(batches.filter((b) => b.id !== deleteId));
    }
    setDeleteId(null);
  };

  const openCreateComponent = (batch: Batch) => {
    setCreateComponentBatch(batch);
    const costPerG = getBatchCostPerGram(batch, batches);
    setComponentFormData({
      name: `Roasted ${batch.coffee_name}`,
      costPerUnit: costPerG.toFixed(COST_PER_UNIT_DECIMALS),
      unit: "g",
    });
    setComponentMode("new");
    setSelectedComponentId("");
  };

  const handleCreateComponent = async () => {
    if (!createComponentBatch) return;
    setIsSubmitting(true);

    if (componentMode === "existing" && selectedComponentId) {
      const result = await addToExistingComponent(createComponentBatch.id, selectedComponentId);
      setIsSubmitting(false);
      if (result.error) { alert(result.error); return; }
      if (result.component) {
        const selectedComp = existingComponents.find((c) => c.id === selectedComponentId);
        setBatches(batches.map((b) =>
          b.id === createComponentBatch.id
            ? { ...b, component_id: result.component.id, components: { id: result.component.id, name: result.component.name } }
            : b
        ));
        alert(
          `Added to "${selectedComp?.name}". Cost updated from $${result.previousCost?.toFixed(COST_PER_UNIT_DECIMALS)} to $${result.newAveragedCost?.toFixed(COST_PER_UNIT_DECIMALS)} per gram.`
        );
        setCreateComponentBatch(null);
        setComponentFormData({ name: "", costPerUnit: "", unit: "g" });
        setSelectedComponentId("");
      }
    } else {
      const result = await createComponentFromBatch(createComponentBatch.id, {
        name: componentFormData.name,
        costPerUnit: parseFloat(componentFormData.costPerUnit),
        unit: componentFormData.unit,
      });
      setIsSubmitting(false);
      if (result.error) { alert(result.error); return; }
      if (result.component) {
        setBatches(batches.map((b) =>
          b.id === createComponentBatch.id
            ? { ...b, component_id: result.component.id, components: { id: result.component.id, name: result.component.name } }
            : b
        ));
        setCreateComponentBatch(null);
        setComponentFormData({ name: "", costPerUnit: "", unit: "g" });
      }
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="font-extrabold text-[17px] uppercase tracking-[.04em] text-espresso">
          All Batches
        </h2>
        <p className="text-[12px] text-espresso/50 font-medium mt-0.5">
          View all roasting batches across sessions
        </p>
      </div>

      {/* Search */}
      <div className="relative w-full md:max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-espresso/40" />
        <input
          type="text"
          placeholder="Search by coffee name or lot code..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-3 py-2 rounded-[8px] border-[2.5px] border-espresso bg-cream text-[13px] font-medium text-espresso placeholder:text-espresso/30 shadow-[2px_2px_0_#1C0F05] focus:outline-none focus:shadow-[2px_2px_0_#E8442A] focus:border-tomato"
        />
      </div>

      {batches.length === 0 ? (
        <div className="bg-chalk border-[3px] border-espresso rounded-[16px] shadow-flat-md flex flex-col items-center justify-center py-14 text-center px-6">
          <Package size={36} strokeWidth={1.5} className="text-espresso/20 mb-3" />
          <h3 className="font-extrabold text-[15px] uppercase tracking-[.04em] text-espresso mb-1">
            No Batches Yet
          </h3>
          <p className="text-[12px] text-espresso/50 font-medium mb-4">
            Create a roasting session and add batches to see them here
          </p>
          <Btn href="/roasting">Go to Sessions</Btn>
        </div>
      ) : (
        <>
          {/* Mobile card layout */}
          <div className="space-y-2 md:hidden">
            {filteredBatches.map((batch) => (
              <div
                key={batch.id}
                className="bg-chalk border-[2.5px] border-espresso rounded-[12px] shadow-flat-sm p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-bold text-espresso truncate">{batch.coffee_name}</p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                      {batch.roasting_sessions ? (
                        <Link
                          href={`/roasting/sessions/${batch.roasting_sessions.id}`}
                          className="text-[11px] text-espresso/50 font-medium hover:text-tomato transition-colors"
                        >
                          {format(new Date(batch.roasting_sessions.session_date), "MMM d, yyyy")}
                        </Link>
                      ) : (
                        <span className="text-[11px] text-espresso/50 font-medium">
                          {format(new Date(batch.batch_date), "MMM d, yyyy")}
                        </span>
                      )}
                      {batch.lot_code && (
                        <span className="inline-flex items-center px-1.5 py-0 rounded-full border-[1.5px] border-fog bg-fog/40 text-[9px] font-extrabold uppercase tracking-[.06em] text-espresso">
                          {batch.lot_code}
                        </span>
                      )}
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="flex h-7 w-7 items-center justify-center rounded-[6px] border-[2px] border-fog text-espresso/50 hover:text-espresso hover:border-espresso/40 hover:bg-fog/30 transition-all shrink-0">
                        <MoreHorizontal size={14} strokeWidth={2} />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {batch.roasting_sessions && (
                        <DropdownMenuItem asChild>
                          <Link href={`/roasting/sessions/${batch.roasting_sessions.id}`}>
                            <Eye className="mr-2 h-4 w-4" />View Session
                          </Link>
                        </DropdownMenuItem>
                      )}
                      {!batch.component_id && (
                        <DropdownMenuItem onClick={() => openCreateComponent(batch)}>
                          <Package className="mr-2 h-4 w-4" />Create Component
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => setDeleteId(batch.id)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="mt-2 grid grid-cols-4 gap-1">
                  {[
                    { label: "Green", value: `${batch.green_weight_g.toFixed(0)}g` },
                    { label: "Roasted", value: `${batch.roasted_weight_g.toFixed(0)}g` },
                    {
                      label: "Loss",
                      value: (
                        <span className={`font-extrabold ${lossColor(batch.loss_percent)}`}>
                          {batch.loss_percent.toFixed(1)}%
                        </span>
                      ),
                    },
                    { label: "Sellable", value: `${batch.sellable_g.toFixed(0)}g` },
                  ].map((stat) => (
                    <div key={stat.label}>
                      <span className="text-[9px] text-espresso/40 font-extrabold uppercase tracking-[.07em] block">
                        {stat.label}
                      </span>
                      <span className="text-[12px] font-bold text-espresso">{stat.value}</span>
                    </div>
                  ))}
                </div>

                {batch.components ? (
                  <div className="mt-2">
                    <Link
                      href="/components"
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-espresso hover:text-tomato transition-colors"
                    >
                      <Package size={10} strokeWidth={2} />
                      {batch.components.name}
                    </Link>
                  </div>
                ) : (
                  <button
                    onClick={() => openCreateComponent(batch)}
                    className="mt-2 flex w-full items-center justify-center gap-1 py-1 rounded-[6px] border-[1.5px] border-dashed border-espresso/30 text-[10px] font-extrabold uppercase tracking-[.07em] text-espresso/50 hover:border-espresso/60 hover:text-espresso hover:bg-fog/20 transition-all"
                  >
                    <Plus size={10} strokeWidth={2.5} />
                    Create Component
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block bg-chalk border-[3px] border-espresso rounded-[16px] shadow-flat-md overflow-hidden">
            <div className="grid grid-cols-[1fr_110px_80px_80px_80px_80px_80px_130px_48px] border-b-[2px] border-espresso bg-cream px-5 py-2.5">
              {["Coffee", "Session", "Lot Code", "Green (g)", "Roasted (g)", "Loss %", "Sellable (g)", "Component", ""].map((h) => (
                <div key={h} className="text-[10px] font-extrabold uppercase tracking-[.1em] text-espresso/50">
                  {h}
                </div>
              ))}
            </div>
            <div className="divide-y-[1.5px] divide-dashed divide-fog">
              {filteredBatches.map((batch) => (
                <div
                  key={batch.id}
                  className="grid grid-cols-[1fr_110px_80px_80px_80px_80px_80px_130px_48px] px-5 py-3 items-center"
                >
                  <p className="text-[13px] font-bold text-espresso truncate pr-2">{batch.coffee_name}</p>
                  <div className="text-[12px] font-medium text-espresso/70">
                    {batch.roasting_sessions ? (
                      <Link
                        href={`/roasting/sessions/${batch.roasting_sessions.id}`}
                        className="hover:text-tomato transition-colors"
                      >
                        {format(new Date(batch.roasting_sessions.session_date), "MMM d, yyyy")}
                      </Link>
                    ) : (
                      format(new Date(batch.batch_date), "MMM d, yyyy")
                    )}
                  </div>
                  <div>
                    {batch.lot_code ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full border-[1.5px] border-fog bg-fog/40 text-[10px] font-extrabold text-espresso">
                        {batch.lot_code}
                      </span>
                    ) : (
                      <span className="text-espresso/30 text-[13px]">—</span>
                    )}
                  </div>
                  <div className="text-[13px] font-medium text-espresso text-right">
                    {batch.green_weight_g.toFixed(0)}
                  </div>
                  <div className="text-[13px] font-medium text-espresso text-right">
                    {batch.roasted_weight_g.toFixed(0)}
                  </div>
                  <div className="text-right">
                    <span className={`text-[13px] font-extrabold ${lossColor(batch.loss_percent)}`}>
                      {batch.loss_percent.toFixed(1)}%
                    </span>
                  </div>
                  <div className="text-[13px] font-medium text-espresso text-right">
                    {batch.sellable_g.toFixed(0)}
                  </div>
                  <div>
                    {batch.components ? (
                      <Link
                        href="/components"
                        className="inline-flex items-center gap-1 text-[12px] font-bold text-espresso hover:text-tomato transition-colors"
                      >
                        <Package size={11} strokeWidth={2} />
                        <span className="truncate">{batch.components.name}</span>
                      </Link>
                    ) : (
                      <button
                        onClick={() => openCreateComponent(batch)}
                        className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-[.07em] text-espresso/40 hover:text-espresso transition-colors"
                      >
                        <Plus size={10} strokeWidth={2.5} />
                        Create
                      </button>
                    )}
                  </div>
                  <div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="flex h-7 w-7 items-center justify-center rounded-[6px] border-[2px] border-transparent text-espresso/50 hover:border-fog hover:text-espresso hover:bg-fog/30 transition-all">
                          <MoreHorizontal size={14} strokeWidth={2} />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {batch.roasting_sessions && (
                          <DropdownMenuItem asChild>
                            <Link href={`/roasting/sessions/${batch.roasting_sessions.id}`}>
                              <Eye className="mr-2 h-4 w-4" />View Session
                            </Link>
                          </DropdownMenuItem>
                        )}
                        {!batch.component_id && (
                          <DropdownMenuItem onClick={() => openCreateComponent(batch)}>
                            <Package className="mr-2 h-4 w-4" />Create Component
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => setDeleteId(batch.id)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Create Component Dialog */}
      <Dialog open={!!createComponentBatch} onOpenChange={() => setCreateComponentBatch(null)}>
        <DialogContent className="max-w-md p-0 gap-0 border-[3px] border-espresso rounded-[16px] overflow-hidden bg-chalk shadow-flat-lg">
          <div className="bg-cream border-b-[3px] border-espresso px-6 py-4">
            <DialogHeader>
              <DialogTitle className="font-extrabold text-[15px] uppercase tracking-[.08em] text-espresso">
                Add Roasted Coffee to Component
              </DialogTitle>
            </DialogHeader>
          </div>
          <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
            {/* Mode toggle — only shown when existing components exist */}
            {existingComponents.length > 0 && (
              <div>
                <FieldLabel>What would you like to do?</FieldLabel>
                <div className="flex gap-1.5">
                  {[
                    { value: "new", label: "Create New" },
                    { value: "existing", label: "Add to Existing" },
                  ].map((mode) => (
                    <button
                      key={mode.value}
                      type="button"
                      onClick={() => setComponentMode(mode.value as "new" | "existing")}
                      className={`flex-1 py-1.5 rounded-[8px] border-[2px] font-extrabold text-[10px] uppercase tracking-[.07em] transition-all duration-[120ms] ${
                        componentMode === mode.value
                          ? "bg-espresso text-cream border-espresso"
                          : "bg-transparent text-espresso border-fog hover:border-espresso/40"
                      }`}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Existing component select */}
            {componentMode === "existing" && existingComponents.length > 0 && (
              <div>
                <FieldLabel>Select Component</FieldLabel>
                <Select value={selectedComponentId} onValueChange={setSelectedComponentId}>
                  <SelectTrigger className="border-[2.5px] border-espresso bg-cream text-espresso font-medium text-[13px] rounded-[8px] shadow-[2px_2px_0_#1C0F05]">
                    <SelectValue placeholder="Choose a component..." />
                  </SelectTrigger>
                  <SelectContent>
                    {existingComponents.map((comp) => (
                      <SelectItem key={comp.id} value={comp.id}>
                        <div className="flex items-center justify-between gap-4">
                          <span>{comp.name}</span>
                          <span className="text-muted-foreground text-xs">
                            ${comp.cost_per_unit.toFixed(COST_PER_UNIT_DECIMALS)}/{comp.unit}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedComponentId && (
                  <p className="text-[11px] text-espresso/50 font-medium mt-1.5">
                    Current price will be averaged with this batch&apos;s cost per gram
                  </p>
                )}
              </div>
            )}

            {/* New component fields */}
            {componentMode === "new" && (
              <>
                <div>
                  <FieldLabel>Component Name</FieldLabel>
                  <MerninInput
                    id="componentName"
                    value={componentFormData.name}
                    onChange={(e) => setComponentFormData({ ...componentFormData, name: e.target.value })}
                    placeholder="e.g., Roasted Ethiopia Yirgacheffe"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <FieldLabel>Cost per Unit</FieldLabel>
                    <MerninInput
                      id="costPerUnit"
                      type="number"
                      step="0.00000001"
                      value={componentFormData.costPerUnit}
                      onChange={(e) => setComponentFormData({ ...componentFormData, costPerUnit: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <FieldLabel>Unit</FieldLabel>
                    <Select
                      value={componentFormData.unit}
                      onValueChange={(value) => setComponentFormData({ ...componentFormData, unit: value })}
                    >
                      <SelectTrigger className="border-[2.5px] border-espresso bg-cream text-espresso font-medium text-[13px] rounded-[8px] shadow-[2px_2px_0_#1C0F05]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {UNITS.map((unit) => (
                          <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </>
            )}

            {/* Batch summary */}
            {createComponentBatch && (
              <div className="rounded-[10px] border-[2px] border-fog bg-cream px-4 py-3 space-y-1">
                <p className="text-[10px] font-extrabold uppercase tracking-[.08em] text-espresso/50 mb-2">
                  Batch Details
                </p>
                {[
                  { label: "Coffee", value: createComponentBatch.coffee_name },
                  { label: "Lot", value: createComponentBatch.lot_code || "N/A" },
                  { label: "Sellable Weight", value: `${createComponentBatch.sellable_g.toFixed(0)}g` },
                  { label: "Loss", value: `${createComponentBatch.loss_percent.toFixed(1)}%` },
                ].map((row) => (
                  <div key={row.label} className="flex justify-between text-[12px]">
                    <span className="text-espresso/50 font-medium">{row.label}</span>
                    <span className="font-bold text-espresso">{row.value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="bg-cream border-t-[3px] border-espresso px-6 py-4 flex justify-end gap-2">
            <Btn variant="outline" onClick={() => setCreateComponentBatch(null)}>Cancel</Btn>
            <Btn
              onClick={handleCreateComponent}
              disabled={
                isSubmitting ||
                (componentMode === "new" && (!componentFormData.name || !componentFormData.costPerUnit)) ||
                (componentMode === "existing" && !selectedComponentId)
              }
            >
              {isSubmitting
                ? componentMode === "existing" ? "Adding..." : "Creating..."
                : componentMode === "existing" ? "Add to Component" : "Create Component"}
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
                Delete Batch?
              </AlertDialogTitle>
            </AlertDialogHeader>
          </div>
          <div className="px-6 py-5">
            <AlertDialogDescription className="text-[13px] text-espresso/70 font-medium">
              This will permanently delete this batch. This action cannot be undone.
            </AlertDialogDescription>
          </div>
          <AlertDialogFooter className="bg-cream border-t-[3px] border-espresso px-6 py-4 flex justify-end gap-2">
            <AlertDialogCancel className="inline-flex items-center px-3 py-1.5 rounded-[8px] border-[2.5px] border-espresso bg-transparent text-espresso font-extrabold text-[11px] uppercase tracking-[.08em] hover:bg-fog/40 transition-all">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="inline-flex items-center px-3 py-1.5 rounded-[8px] border-[2.5px] border-espresso bg-tomato text-cream font-extrabold text-[11px] uppercase tracking-[.08em] shadow-[3px_3px_0_#1C0F05] hover:-translate-x-px hover:-translate-y-px hover:shadow-[4px_4px_0_#1C0F05] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

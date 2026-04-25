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
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  ArrowLeft,
  Plus,
  Trash2,
  Edit,
  Package,
  ClipboardList,
  AlertTriangle,
  Clock,
} from "lucide-react";
import {
  createBatch,
  updateBatch,
  deleteBatch,
  fulfillRoastRequest,
} from "../../actions";

interface Batch {
  id: string;
  coffee_name: string;
  lot_code: string | null;
  price_basis: "per_lb" | "per_kg";
  price_value: number;
  green_weight_g: number;
  roasted_weight_g: number;
  rejects_g: number;
  roast_minutes: number;
  batch_date: string;
  energy_kwh: number | null;
  kwh_rate: number | null;
  sellable_g: number;
  loss_percent: number;
  green_cost_per_g: number;
  component_id: string | null;
  created_at: string;
}

interface Session {
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
  notes: string | null;
}

interface CoffeeInventory {
  id: string;
  name: string;
  origin: string;
  lot_code: string | null;
  supplier: string | null;
  price_per_lb: number;
  current_green_quantity_g: number;
}

const LBS_TO_GRAMS = 453.592;

interface RoastRequest {
  id: string;
  green_coffee_id: string;
  coffee_name: string;
  requested_roasted_g: number;
  fulfilled_roasted_g: number;
  priority: "low" | "normal" | "high" | "urgent";
  status: "pending" | "in_progress";
  due_date: string | null;
  order_id: string | null;
  notes: string | null;
  green_coffee_inventory?: { name: string; origin: string };
}

interface SessionDetailClientProps {
  session: Session;
  batches: Batch[];
  coffeeInventory: CoffeeInventory[];
  pendingRequests: RoastRequest[];
}

type BtnVariant = "primary" | "outline" | "ghost" | "danger";
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
    outline: "bg-transparent text-espresso border-espresso hover:bg-fog/40",
    ghost: "bg-transparent text-espresso border-transparent hover:bg-fog/30",
    danger: "bg-transparent text-tomato border-transparent hover:bg-tomato/10",
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
  min,
}: {
  id?: string;
  type?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  step?: string;
  min?: string;
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
      className="w-full px-3 py-2 rounded-[8px] border-[2.5px] border-espresso bg-cream text-[13px] font-medium text-espresso placeholder:text-espresso/30 shadow-[2px_2px_0_#1C0F05] focus:outline-none focus:shadow-[2px_2px_0_#E8442A] focus:border-tomato"
    />
  );
}

const lossColor = (pct: number) =>
  pct > 18 ? "text-tomato" : pct < 12 ? "text-honey" : "text-matcha";

const defaultBatchData = {
  coffeeInventoryId: "",
  coffeeName: "",
  lotCode: "",
  priceBasis: "per_lb" as "per_lb" | "per_kg",
  priceValue: "",
  greenWeightG: "",
  roastedWeightG: "",
  rejectsG: "0",
  roastMinutes: "",
  energyKwh: "",
};

export function SessionDetailClient({
  session,
  batches: initialBatches,
  coffeeInventory,
  pendingRequests,
}: SessionDetailClientProps) {
  const router = useRouter();
  const [batches, setBatches] = useState(initialBatches);
  const [isAddBatchOpen, setIsAddBatchOpen] = useState(false);
  const [editingBatch, setEditingBatch] = useState<Batch | null>(null);
  const [deleteBatchId, setDeleteBatchId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [batchData, setBatchData] = useState(defaultBatchData);
  const [selectedRequestId, setSelectedRequestId] = useState<string>("");

  const handleCoffeeSelect = (coffeeId: string) => {
    const coffee = coffeeInventory.find((c) => c.id === coffeeId);
    if (coffee) {
      setBatchData({
        ...batchData,
        coffeeInventoryId: coffeeId,
        coffeeName: coffee.name,
        lotCode: coffee.lot_code || "",
        priceBasis: "per_lb",
        priceValue: coffee.price_per_lb.toString(),
      });
    }
  };

  const handleRequestSelect = (requestId: string) => {
    setSelectedRequestId(requestId);
    const request = pendingRequests.find((r) => r.id === requestId);
    if (request) {
      const coffee = coffeeInventory.find((c) => c.id === request.green_coffee_id);
      if (coffee) handleCoffeeSelect(coffee.id);
    }
  };

  const handleAddBatch = async () => {
    const roastMinutesRequired = session.cost_mode !== "co_roasting";
    if (!batchData.coffeeName || !batchData.greenWeightG || !batchData.roastedWeightG || (roastMinutesRequired && !batchData.roastMinutes) || !batchData.priceValue) {
      alert(`Please fill in all required fields: Coffee Name, Price, Green Weight, Roasted Weight${roastMinutesRequired ? ", and Roast Duration" : ""}`);
      return;
    }
    setIsSubmitting(true);
    const result = await createBatch({
      sessionId: session.id,
      coffeeInventoryId: batchData.coffeeInventoryId || undefined,
      coffeeName: batchData.coffeeName,
      lotCode: batchData.lotCode || undefined,
      priceBasis: batchData.priceBasis,
      priceValue: parseFloat(batchData.priceValue),
      greenWeightG: parseFloat(batchData.greenWeightG),
      roastedWeightG: parseFloat(batchData.roastedWeightG),
      rejectsG: parseFloat(batchData.rejectsG) || 0,
      roastMinutes: parseFloat(batchData.roastMinutes),
      batchDate: session.session_date,
      energyKwh: batchData.energyKwh ? parseFloat(batchData.energyKwh) : undefined,
    });
    if (result.error) { setIsSubmitting(false); alert(result.error); return; }
    if (result.batch && selectedRequestId) {
      const roastedWeightG = parseFloat(batchData.roastedWeightG);
      const fulfillResult = await fulfillRoastRequest({
        requestId: selectedRequestId,
        batchId: result.batch.id,
        quantityG: roastedWeightG,
      });
      if (fulfillResult.error) console.warn("Failed to fulfill roast request:", fulfillResult.error);
    }
    setIsSubmitting(false);
    if (result.batch) {
      setBatches([...batches, result.batch]);
      setIsAddBatchOpen(false);
      setBatchData(defaultBatchData);
      setSelectedRequestId("");
      router.refresh();
    }
  };

  const handleUpdateBatch = async () => {
    if (!editingBatch) return;
    setIsSubmitting(true);
    const result = await updateBatch(editingBatch.id, {
      coffeeName: batchData.coffeeName || undefined,
      lotCode: batchData.lotCode || undefined,
      priceBasis: batchData.priceBasis,
      priceValue: parseFloat(batchData.priceValue) || undefined,
      greenWeightG: parseFloat(batchData.greenWeightG) || undefined,
      roastedWeightG: parseFloat(batchData.roastedWeightG) || undefined,
      rejectsG: parseFloat(batchData.rejectsG) || 0,
      roastMinutes: parseFloat(batchData.roastMinutes) || undefined,
      energyKwh: batchData.energyKwh ? parseFloat(batchData.energyKwh) : undefined,
    });
    setIsSubmitting(false);
    if (result.error) { alert(result.error); return; }
    router.refresh();
    setEditingBatch(null);
    setBatchData(defaultBatchData);
  };

  const handleDeleteBatch = async () => {
    if (!deleteBatchId) return;
    const result = await deleteBatch(deleteBatchId);
    if (result.error) { alert(result.error); } else {
      setBatches(batches.filter((b) => b.id !== deleteBatchId));
    }
    setDeleteBatchId(null);
  };

  const openEditBatch = (batch: Batch) => {
    setEditingBatch(batch);
    setBatchData({
      coffeeInventoryId: "",
      coffeeName: batch.coffee_name,
      lotCode: batch.lot_code || "",
      priceBasis: batch.price_basis,
      priceValue: batch.price_value.toString(),
      greenWeightG: batch.green_weight_g.toString(),
      roastedWeightG: batch.roasted_weight_g.toString(),
      rejectsG: batch.rejects_g.toString(),
      roastMinutes: batch.roast_minutes.toString(),
      energyKwh: batch.energy_kwh?.toString() || "",
    });
  };

  const totalGreenG = batches.reduce((sum, b) => sum + b.green_weight_g, 0);
  const totalSellableG = batches.reduce((sum, b) => sum + b.sellable_g, 0);
  const avgLossPercent =
    batches.length > 0 ? batches.reduce((sum, b) => sum + b.loss_percent, 0) / batches.length : null;
  const totalRoastMinutes = batches.reduce((sum, b) => sum + b.roast_minutes, 0);
  const totalSessionMinutes = session.setup_minutes + totalRoastMinutes + session.cleanup_minutes;
  const billableMinutes =
    Math.ceil(totalSessionMinutes / session.billing_granularity_minutes) *
    session.billing_granularity_minutes;
  const sessionTollCost =
    session.cost_mode === "co_roasting"
      ? batches.reduce((sum, b) => sum + (b.green_weight_g / 453.592) * Number(session.rate_per_lb || 0), 0)
      : session.cost_mode === "power_usage"
      ? (billableMinutes / 60) * (session.machine_energy_kwh_per_hour || 0) * (session.kwh_rate || 0)
      : (billableMinutes / 60) * session.rate_per_hour;

  const selectedCoffee = coffeeInventory.find((c) => c.id === batchData.coffeeInventoryId);
  const selectedRequest = pendingRequests.find((r) => r.id === selectedRequestId);

  const batchFormBody = (
    <div className="space-y-4">
      {/* Roast Request Selection */}
      {pendingRequests.length > 0 && !editingBatch && (
        <div>
          <FieldLabel>
            <span className="flex items-center gap-1.5">
              <ClipboardList size={11} />
              Fulfill a Roast Request (optional)
            </span>
          </FieldLabel>
          <Select value={selectedRequestId} onValueChange={handleRequestSelect}>
            <SelectTrigger className="border-[2.5px] border-espresso bg-cream text-espresso font-medium text-[13px] rounded-[8px] shadow-[2px_2px_0_#1C0F05]">
              <SelectValue placeholder="Select a request to fulfill..." />
            </SelectTrigger>
            <SelectContent>
              {pendingRequests.map((request) => {
                const remainingG = request.requested_roasted_g - request.fulfilled_roasted_g;
                const isOverdue = request.due_date && new Date(request.due_date) < new Date();
                return (
                  <SelectItem key={request.id} value={request.id}>
                    <div className="flex items-center gap-2">
                      {request.priority === "urgent" && <AlertTriangle className="h-3 w-3 text-red-500" />}
                      {request.priority === "high" && <Clock className="h-3 w-3 text-amber-500" />}
                      <span>{request.green_coffee_inventory?.name || "Unknown"}</span>
                      <span className="text-muted-foreground text-xs">
                        — {remainingG.toLocaleString()}g needed{isOverdue && " (overdue)"}
                      </span>
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          {selectedRequest && (
            <p className="text-[11px] text-espresso/50 font-medium mt-1.5">
              Needs {(selectedRequest.requested_roasted_g - selectedRequest.fulfilled_roasted_g).toLocaleString()}g
              {selectedRequest.due_date && ` by ${new Date(selectedRequest.due_date).toLocaleDateString()}`}
              {selectedRequest.notes && ` — ${selectedRequest.notes}`}
            </p>
          )}
        </div>
      )}

      {/* Coffee Inventory Select */}
      {coffeeInventory.length > 0 && (
        <div>
          <FieldLabel>Select from Inventory</FieldLabel>
          <Select value={batchData.coffeeInventoryId} onValueChange={handleCoffeeSelect}>
            <SelectTrigger className="border-[2.5px] border-espresso bg-cream text-espresso font-medium text-[13px] rounded-[8px] shadow-[2px_2px_0_#1C0F05]">
              <SelectValue placeholder="Select coffee from inventory..." />
            </SelectTrigger>
            <SelectContent>
              {coffeeInventory.map((coffee) => (
                <SelectItem key={coffee.id} value={coffee.id}>
                  <div className="flex items-center justify-between gap-4">
                    <span>{coffee.name}</span>
                    <span className="text-muted-foreground text-xs">
                      {(coffee.current_green_quantity_g / LBS_TO_GRAMS).toFixed(1)} lbs @ ${coffee.price_per_lb.toFixed(2)}/lb
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedCoffee && (
            <p className="text-[11px] text-espresso/50 font-medium mt-1.5">
              {selectedCoffee.origin}{selectedCoffee.supplier ? ` — ${selectedCoffee.supplier}` : ""}
              {selectedCoffee.lot_code ? ` | Lot: ${selectedCoffee.lot_code}` : ""}
              {" | "}Available: {(selectedCoffee.current_green_quantity_g / LBS_TO_GRAMS).toFixed(1)} lbs
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <FieldLabel>Coffee Name *</FieldLabel>
          <MerninInput
            id="coffeeName"
            value={batchData.coffeeName}
            onChange={(e) => setBatchData({ ...batchData, coffeeName: e.target.value })}
            placeholder="e.g., Ethiopia Yirgacheffe"
          />
        </div>
        <div>
          <FieldLabel>Lot Code</FieldLabel>
          <MerninInput
            id="lotCode"
            value={batchData.lotCode}
            onChange={(e) => setBatchData({ ...batchData, lotCode: e.target.value })}
            placeholder="e.g., LOT-2024-001"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <FieldLabel>Price Basis *</FieldLabel>
          <Select
            value={batchData.priceBasis}
            onValueChange={(value: "per_lb" | "per_kg") =>
              setBatchData({ ...batchData, priceBasis: value })
            }
          >
            <SelectTrigger className="border-[2.5px] border-espresso bg-cream text-espresso font-medium text-[13px] rounded-[8px] shadow-[2px_2px_0_#1C0F05]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="per_lb">Per Pound</SelectItem>
              <SelectItem value="per_kg">Per Kilogram</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <FieldLabel>Green Price (${batchData.priceBasis === "per_lb" ? "/lb" : "/kg"}) *</FieldLabel>
          <MerninInput
            id="priceValue"
            type="number"
            step="0.01"
            value={batchData.priceValue}
            onChange={(e) => setBatchData({ ...batchData, priceValue: e.target.value })}
            placeholder="e.g., 5.50"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <FieldLabel>Green Weight (g) *</FieldLabel>
          <MerninInput
            id="greenWeightG"
            type="number"
            value={batchData.greenWeightG}
            onChange={(e) => setBatchData({ ...batchData, greenWeightG: e.target.value })}
            placeholder="e.g., 5000"
          />
          {batchData.greenWeightG && (
            <p className="text-[10px] text-espresso/40 font-medium mt-1">
              {(parseFloat(batchData.greenWeightG) / LBS_TO_GRAMS).toFixed(2)} lbs
            </p>
          )}
        </div>
        <div>
          <FieldLabel>Roasted Weight (g) *</FieldLabel>
          <MerninInput
            id="roastedWeightG"
            type="number"
            value={batchData.roastedWeightG}
            onChange={(e) => setBatchData({ ...batchData, roastedWeightG: e.target.value })}
            placeholder="e.g., 4250"
          />
          {batchData.roastedWeightG && (
            <p className="text-[10px] text-espresso/40 font-medium mt-1">
              {(parseFloat(batchData.roastedWeightG) / LBS_TO_GRAMS).toFixed(2)} lbs
            </p>
          )}
        </div>
        <div>
          <FieldLabel>Rejects (g)</FieldLabel>
          <MerninInput
            id="rejectsG"
            type="number"
            value={batchData.rejectsG}
            onChange={(e) => setBatchData({ ...batchData, rejectsG: e.target.value })}
            placeholder="0"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <FieldLabel>Roast Duration (min) *</FieldLabel>
          <MerninInput
            id="roastMinutes"
            type="number"
            step="0.5"
            value={batchData.roastMinutes}
            onChange={(e) => setBatchData({ ...batchData, roastMinutes: e.target.value })}
            placeholder="e.g., 12"
          />
        </div>
        <div>
          <FieldLabel>Energy (kWh)</FieldLabel>
          <MerninInput
            id="energyKwh"
            type="number"
            step="0.01"
            value={batchData.energyKwh}
            onChange={(e) => setBatchData({ ...batchData, energyKwh: e.target.value })}
            placeholder="Optional"
          />
        </div>
      </div>
    </div>
  );

  const sessionRateLabel =
    session.cost_mode === "co_roasting"
      ? `$${Number(session.rate_per_lb || 0).toFixed(2)}/lb (green)`
      : session.cost_mode === "power_usage"
      ? `${session.machine_energy_kwh_per_hour || 0} kWh/hr | $${(session.kwh_rate || 0).toFixed(4)}/kWh | ${session.billing_granularity_minutes}min billing`
      : `$${session.rate_per_hour}/hr | ${session.billing_granularity_minutes}min billing`;

  return (
    <div className="p-6 space-y-6 bg-cream min-h-full">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/roasting"
            className="flex h-8 w-8 items-center justify-center rounded-[8px] border-[2.5px] border-espresso bg-cream text-espresso hover:bg-fog/40 transition-all shadow-[2px_2px_0_#1C0F05]"
          >
            <ArrowLeft size={14} strokeWidth={2.2} />
          </Link>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-extrabold text-[22px] uppercase tracking-[.04em] text-espresso leading-none">
                {format(new Date(session.session_date), "MMM d, yyyy")}
              </h1>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full border-[2px] border-espresso bg-fog/40 text-[10px] font-extrabold uppercase tracking-[.06em] text-espresso">
                {session.vendor_name}
              </span>
            </div>
            <p className="text-[12px] text-espresso/50 font-medium mt-1 truncate">{sessionRateLabel}</p>
          </div>
        </div>
        <Btn onClick={() => setIsAddBatchOpen(true)} className="self-start sm:self-auto">
          <Plus size={12} strokeWidth={2.5} />
          Add Batch
        </Btn>
      </div>

      {/* Stat cards — desktop 5-col, mobile 3-col compact */}
      <div className="grid grid-cols-3 gap-3 md:grid-cols-5">
        {[
          { label: "Batches", value: batches.length.toString() },
          { label: "Green", value: `${(totalGreenG / 1000).toFixed(2)} kg`, desktopOnly: false },
          { label: "Sellable", value: `${(totalSellableG / 1000).toFixed(2)} kg` },
          {
            label: "Avg Loss",
            value: avgLossPercent !== null ? `${avgLossPercent.toFixed(1)}%` : "—",
            colored: avgLossPercent !== null ? lossColor(avgLossPercent) : "",
          },
          {
            label: "Session Toll",
            value: `$${sessionTollCost.toFixed(2)}`,
            sub: session.cost_mode !== "co_roasting" ? `${billableMinutes}min billed` : undefined,
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-chalk border-[3px] border-espresso rounded-[12px] shadow-flat-sm px-4 py-3"
          >
            <p className="text-[9px] font-extrabold uppercase tracking-[.1em] text-espresso/40 mb-1">
              {stat.label}
            </p>
            <p className={`text-[20px] font-extrabold leading-none ${stat.colored || "text-espresso"}`}>
              {stat.value}
            </p>
            {stat.sub && (
              <p className="text-[10px] text-espresso/40 font-medium mt-0.5">{stat.sub}</p>
            )}
          </div>
        ))}
      </div>

      {/* Pending Requests Banner */}
      {pendingRequests.length > 0 && (
        <div className="bg-sun/20 border-[3px] border-sun/60 rounded-[14px] px-5 py-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sun/30 border-[2px] border-sun/60 shrink-0">
              <ClipboardList size={16} strokeWidth={2} className="text-espresso" />
            </div>
            <div className="min-w-0">
              <h3 className="text-[13px] font-extrabold text-espresso uppercase tracking-[.04em]">
                {pendingRequests.length} Pending Request{pendingRequests.length !== 1 ? "s" : ""}
              </h3>
              <p className="text-[11px] text-espresso/60 font-medium truncate">
                {pendingRequests.map((r) => r.green_coffee_inventory?.name || "Unknown").join(", ")}
              </p>
            </div>
          </div>
          <Btn onClick={() => setIsAddBatchOpen(true)} className="self-start sm:self-auto shrink-0">
            <Plus size={12} strokeWidth={2.5} />
            Fulfill Request
          </Btn>
        </div>
      )}

      {/* Batch grid */}
      {batches.length === 0 ? (
        <div className="bg-chalk border-[3px] border-espresso rounded-[16px] shadow-flat-md flex flex-col items-center justify-center py-14 text-center px-6">
          <Package size={36} strokeWidth={1.5} className="text-espresso/20 mb-3" />
          <h3 className="font-extrabold text-[15px] uppercase tracking-[.04em] text-espresso mb-1">
            No Batches Yet
          </h3>
          <p className="text-[12px] text-espresso/50 font-medium mb-4">
            Add your first batch to start tracking
          </p>
          <Btn onClick={() => setIsAddBatchOpen(true)}>
            <Plus size={12} strokeWidth={2.5} />
            Add First Batch
          </Btn>
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {batches.map((batch) => {
            const greenCostPerG = batch.green_cost_per_g;
            const totalGreenCost = greenCostPerG * batch.green_weight_g;
            let roastingCostPerG = 0;
            let totalCostPerG = 0;

            if (batch.sellable_g > 0) {
              if (session.cost_mode === "co_roasting") {
                const roastingCost = (batch.green_weight_g / 453.592) * Number(session.rate_per_lb || 0);
                roastingCostPerG = roastingCost / batch.sellable_g;
                totalCostPerG = (totalGreenCost + roastingCost) / batch.sellable_g;
              } else {
                const batchCount = Math.max(batches.length, 1);
                const batchEffectiveMinutes =
                  batch.roast_minutes + (session.setup_minutes + session.cleanup_minutes) / batchCount;
                const batchAllocatedCost =
                  totalSessionMinutes > 0
                    ? sessionTollCost * (batchEffectiveMinutes / totalSessionMinutes)
                    : 0;
                roastingCostPerG = batchAllocatedCost / batch.sellable_g;
                totalCostPerG = (totalGreenCost + batchAllocatedCost) / batch.sellable_g;
              }
            }

            return (
              <div
                key={batch.id}
                className="bg-chalk border-[3px] border-espresso rounded-[16px] shadow-flat-md overflow-hidden"
              >
                {/* Card header */}
                <div className="bg-cream border-b-[2px] border-espresso px-4 py-3 flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-[13px] font-extrabold text-espresso uppercase tracking-[.04em] truncate">
                      {batch.coffee_name}
                    </h3>
                    {batch.lot_code && (
                      <p className="text-[10px] text-espresso/50 font-medium truncate">
                        Lot: {batch.lot_code}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      onClick={() => openEditBatch(batch)}
                      className="flex h-7 w-7 items-center justify-center rounded-[6px] border-[1.5px] border-transparent text-espresso/40 hover:border-fog hover:text-espresso hover:bg-fog/30 transition-all"
                    >
                      <Edit size={12} strokeWidth={2} />
                    </button>
                    <button
                      onClick={() => setDeleteBatchId(batch.id)}
                      className="flex h-7 w-7 items-center justify-center rounded-[6px] border-[1.5px] border-transparent text-espresso/30 hover:border-tomato/30 hover:text-tomato hover:bg-tomato/10 transition-all"
                    >
                      <Trash2 size={12} strokeWidth={2} />
                    </button>
                  </div>
                </div>

                {/* Card body */}
                <div className="px-4 py-3 space-y-3">
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: "Green", value: `${batch.green_weight_g}g` },
                      { label: "Roasted", value: `${batch.roasted_weight_g}g` },
                      {
                        label: "Loss",
                        value: <span className={`font-extrabold ${lossColor(batch.loss_percent)}`}>{batch.loss_percent.toFixed(1)}%</span>,
                      },
                      { label: "Sellable", value: `${batch.sellable_g}g` },
                      { label: "Time", value: `${batch.roast_minutes}min` },
                      { label: "Price", value: `$${batch.price_value}/${batch.price_basis === "per_lb" ? "lb" : "kg"}` },
                    ].map((stat) => (
                      <div key={stat.label}>
                        <span className="text-[9px] text-espresso/40 font-extrabold uppercase tracking-[.08em] block">
                          {stat.label}
                        </span>
                        <span className="text-[12px] font-bold text-espresso">{stat.value}</span>
                      </div>
                    ))}
                  </div>

                  {/* Cost breakdown */}
                  <div className="pt-2 border-t-[1.5px] border-dashed border-fog">
                    <p className="text-[9px] font-extrabold uppercase tracking-[.1em] text-espresso/40 mb-1.5">
                      Cost / gram
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { label: "Green", value: `$${greenCostPerG.toFixed(5)}` },
                        { label: "Roasting", value: `$${roastingCostPerG.toFixed(5)}` },
                        { label: "Total", value: `$${totalCostPerG.toFixed(5)}`, bold: true },
                      ].map((cost) => (
                        <div key={cost.label}>
                          <span className="text-[9px] text-espresso/40 font-extrabold uppercase tracking-[.08em] block">
                            {cost.label}
                          </span>
                          <span className={`text-[11px] ${cost.bold ? "font-extrabold text-espresso" : "font-bold text-espresso/70"}`}>
                            {cost.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Batch Dialog */}
      <Dialog open={isAddBatchOpen} onOpenChange={setIsAddBatchOpen}>
        <DialogContent className="max-w-lg p-0 gap-0 border-[3px] border-espresso rounded-[16px] overflow-hidden bg-chalk shadow-flat-lg max-h-[90vh]">
          <div className="bg-cream border-b-[3px] border-espresso px-6 py-4">
            <DialogHeader>
              <DialogTitle className="font-extrabold text-[15px] uppercase tracking-[.08em] text-espresso">
                Add New Batch
              </DialogTitle>
              <DialogDescription className="text-[12px] text-espresso/50 font-medium">
                Record the details of your roasting batch
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="px-6 py-5 overflow-y-auto">
            {batchFormBody}
          </div>
          <div className="bg-cream border-t-[3px] border-espresso px-6 py-4 flex justify-end gap-2">
            <Btn variant="outline" onClick={() => setIsAddBatchOpen(false)}>Cancel</Btn>
            <Btn
              onClick={handleAddBatch}
              disabled={
                isSubmitting ||
                !batchData.coffeeName ||
                !batchData.greenWeightG ||
                !batchData.roastedWeightG ||
                (session.cost_mode !== "co_roasting" && !batchData.roastMinutes) ||
                !batchData.priceValue
              }
            >
              {isSubmitting ? "Adding..." : "Add Batch"}
            </Btn>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Batch Dialog */}
      <Dialog open={!!editingBatch} onOpenChange={(open) => !open && setEditingBatch(null)}>
        <DialogContent className="max-w-lg p-0 gap-0 border-[3px] border-espresso rounded-[16px] overflow-hidden bg-chalk shadow-flat-lg max-h-[90vh]">
          <div className="bg-cream border-b-[3px] border-espresso px-6 py-4">
            <DialogHeader>
              <DialogTitle className="font-extrabold text-[15px] uppercase tracking-[.08em] text-espresso">
                Edit Batch
              </DialogTitle>
              <DialogDescription className="text-[12px] text-espresso/50 font-medium">
                Update the batch details
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="px-6 py-5 overflow-y-auto">
            {batchFormBody}
          </div>
          <div className="bg-cream border-t-[3px] border-espresso px-6 py-4 flex justify-end gap-2">
            <Btn variant="outline" onClick={() => setEditingBatch(null)}>Cancel</Btn>
            <Btn onClick={handleUpdateBatch} disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Btn>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteBatchId} onOpenChange={(open) => !open && setDeleteBatchId(null)}>
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
              This action cannot be undone. This will permanently delete this batch record.
            </AlertDialogDescription>
          </div>
          <AlertDialogFooter className="bg-cream border-t-[3px] border-espresso px-6 py-4 flex justify-end gap-2">
            <AlertDialogCancel className="inline-flex items-center px-3 py-1.5 rounded-[8px] border-[2.5px] border-espresso bg-transparent text-espresso font-extrabold text-[11px] uppercase tracking-[.08em] hover:bg-fog/40 transition-all">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteBatch}
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

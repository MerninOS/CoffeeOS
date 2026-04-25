"use client";

import { useState } from "react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  MoreHorizontal,
  Edit,
  Trash2,
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  Coffee,
} from "lucide-react";
import {
  createRoastRequest,
  updateRoastRequest,
  deleteRoastRequest,
} from "./actions";

interface CoffeeInventory {
  id: string;
  name: string;
  origin: string;
  current_green_quantity_g: number;
}

interface RoastRequest {
  id: string;
  green_coffee_id: string;
  coffee_name: string;
  requested_roasted_g: number;
  fulfilled_roasted_g: number;
  priority: "low" | "normal" | "high" | "urgent";
  status: "pending" | "in_progress" | "fulfilled" | "cancelled";
  due_date: string | null;
  order_id: string | null;
  notes: string | null;
  created_at: string;
  green_coffee_inventory?: {
    name: string;
    origin: string;
  };
}

interface RoastRequestsClientProps {
  requests: RoastRequest[];
  coffeeInventory: CoffeeInventory[];
}

const LBS_TO_GRAMS = 453.592;
const gramsToLbs = (g: number) => (g / LBS_TO_GRAMS).toFixed(2);

type BtnVariant = "primary" | "outline" | "ghost" | "danger";
function Btn({
  variant = "primary",
  children,
  onClick,
  disabled,
  className = "",
  type = "button",
}: {
  variant?: BtnVariant;
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  type?: "button" | "submit";
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
    danger:
      "bg-transparent text-tomato border-transparent hover:bg-tomato/10",
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${variants[variant]} ${className}`}
    >
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

function MerninTextarea({
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      rows={rows}
      className="w-full px-3 py-2 rounded-[8px] border-[2.5px] border-espresso bg-cream text-[13px] font-medium text-espresso placeholder:text-espresso/30 shadow-[2px_2px_0_#1C0F05] focus:outline-none focus:shadow-[2px_2px_0_#E8442A] focus:border-tomato resize-none"
    />
  );
}

const priorityConfig = {
  low: { label: "Low", className: "bg-fog/60 text-espresso border-fog" },
  normal: { label: "Normal", className: "bg-sky/20 text-espresso border-sky/40" },
  high: { label: "High", className: "bg-sun/30 text-espresso border-sun/60" },
  urgent: { label: "Urgent", className: "bg-tomato text-cream border-espresso" },
};

const statusConfig = {
  pending: { label: "Pending", Icon: Clock, className: "bg-fog/60 text-espresso border-fog" },
  in_progress: { label: "In Progress", Icon: Coffee, className: "bg-honey/20 text-espresso border-honey/40" },
  fulfilled: { label: "Fulfilled", Icon: CheckCircle2, className: "bg-matcha/20 text-matcha border-matcha/40" },
  cancelled: { label: "Cancelled", Icon: XCircle, className: "bg-espresso/10 text-espresso/60 border-fog" },
};

function PriorityPill({ priority }: { priority: keyof typeof priorityConfig }) {
  const cfg = priorityConfig[priority];
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full border-[1.5px] text-[10px] font-extrabold uppercase tracking-[.06em] ${cfg.className}`}
    >
      {cfg.label}
    </span>
  );
}

function StatusPill({ status }: { status: keyof typeof statusConfig }) {
  const cfg = statusConfig[status];
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border-[1.5px] text-[10px] font-extrabold uppercase tracking-[.06em] ${cfg.className}`}
    >
      <cfg.Icon size={10} strokeWidth={2.2} />
      {cfg.label}
    </span>
  );
}

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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-extrabold text-[17px] uppercase tracking-[.04em] text-espresso">
            Roast Requests
          </h2>
          <p className="text-[12px] text-espresso/50 font-medium mt-0.5">
            Track and manage roasting requests from orders
          </p>
        </div>
        <Btn onClick={openCreateDialog}>
          <Plus size={12} strokeWidth={2.5} />
          New Request
        </Btn>
      </div>

      {/* Active Requests */}
      {pendingRequests.length > 0 && (
        <div className="bg-chalk border-[3px] border-espresso rounded-[16px] shadow-flat-md overflow-hidden">
          {/* Desktop table */}
          <div className="hidden md:block">
            <div className="grid grid-cols-[1fr_100px_160px_90px_100px_100px_48px] border-b-[2px] border-espresso bg-cream px-5 py-2.5">
              {["Coffee", "Quantity", "Progress", "Priority", "Due Date", "Status", ""].map((h) => (
                <div key={h} className="text-[10px] font-extrabold uppercase tracking-[.1em] text-espresso/50">
                  {h}
                </div>
              ))}
            </div>
            <div className="divide-y-[1.5px] divide-dashed divide-fog">
              {pendingRequests.map((request) => {
                const progressPercent = (request.fulfilled_roasted_g / request.requested_roasted_g) * 100;
                const isOverdue = request.due_date && new Date(request.due_date) < new Date() && request.status !== "fulfilled";
                return (
                  <div key={request.id} className="grid grid-cols-[1fr_100px_160px_90px_100px_100px_48px] px-5 py-3 items-center">
                    <div className="min-w-0">
                      <p className="text-[13px] font-bold text-espresso truncate">
                        {request.green_coffee_inventory?.name || "Unknown"}
                      </p>
                      {request.green_coffee_inventory?.origin && (
                        <p className="text-[11px] text-espresso/50 font-medium truncate">
                          {request.green_coffee_inventory.origin}
                        </p>
                      )}
                    </div>
                    <div className="text-[13px] font-bold text-espresso">
                      {request.requested_roasted_g.toLocaleString()}g
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-2 bg-fog rounded-full overflow-hidden border border-espresso/20">
                        <div
                          className="h-full bg-honey rounded-full"
                          style={{ width: `${Math.min(progressPercent, 100)}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-espresso/50 font-medium whitespace-nowrap">
                        {request.fulfilled_roasted_g.toLocaleString()} / {request.requested_roasted_g.toLocaleString()}g
                      </span>
                    </div>
                    <div>
                      <PriorityPill priority={request.priority} />
                    </div>
                    <div className="text-[12px] font-medium text-espresso">
                      {request.due_date ? (
                        <div className="flex items-center gap-1">
                          {isOverdue && <AlertTriangle size={11} className="text-tomato shrink-0" />}
                          <span className={isOverdue ? "text-tomato" : ""}>
                            {new Date(request.due_date).toLocaleDateString()}
                          </span>
                        </div>
                      ) : (
                        <span className="text-espresso/30">—</span>
                      )}
                    </div>
                    <div>
                      <StatusPill status={request.status} />
                    </div>
                    <div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="flex h-7 w-7 items-center justify-center rounded-[6px] border-[2px] border-transparent text-espresso/50 hover:border-fog hover:text-espresso hover:bg-fog/30 transition-all cursor-pointer">
                            <MoreHorizontal size={14} strokeWidth={2} />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditDialog(request)}>
                            <Edit className="mr-2 h-4 w-4" />Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleStatusChange(request.id, "fulfilled")}>
                            <CheckCircle2 className="mr-2 h-4 w-4" />Mark Fulfilled
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleStatusChange(request.id, "cancelled")}>
                            <XCircle className="mr-2 h-4 w-4" />Cancel
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDelete(request.id)}
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
          <div className="md:hidden divide-y-[1.5px] divide-dashed divide-fog">
            {pendingRequests.map((request) => {
              const progressPercent = (request.fulfilled_roasted_g / request.requested_roasted_g) * 100;
              const isOverdue = request.due_date && new Date(request.due_date) < new Date() && request.status !== "fulfilled";
              return (
                <div key={request.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[13px] font-bold text-espresso">
                        {request.green_coffee_inventory?.name || "Unknown"}
                      </p>
                      {request.green_coffee_inventory?.origin && (
                        <p className="text-[11px] text-espresso/50 font-medium">
                          {request.green_coffee_inventory.origin}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <PriorityPill priority={request.priority} />
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="flex h-7 w-7 items-center justify-center rounded-[6px] border-[2px] border-fog text-espresso/50 hover:text-espresso hover:bg-fog/30 transition-all cursor-pointer">
                            <MoreHorizontal size={14} strokeWidth={2} />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditDialog(request)}>
                            <Edit className="mr-2 h-4 w-4" />Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleStatusChange(request.id, "fulfilled")}>
                            <CheckCircle2 className="mr-2 h-4 w-4" />Mark Fulfilled
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleStatusChange(request.id, "cancelled")}>
                            <XCircle className="mr-2 h-4 w-4" />Cancel
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDelete(request.id)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-espresso/50 font-medium">Progress</span>
                      <span className="font-bold text-espresso">
                        {request.fulfilled_roasted_g.toLocaleString()} / {request.requested_roasted_g.toLocaleString()}g
                      </span>
                    </div>
                    <div className="w-full h-2 bg-fog rounded-full overflow-hidden border border-espresso/20">
                      <div
                        className="h-full bg-honey rounded-full"
                        style={{ width: `${Math.min(progressPercent, 100)}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <StatusPill status={request.status} />
                    {request.due_date && (
                      <div className="flex items-center gap-1 text-[11px] font-medium">
                        {isOverdue && <AlertTriangle size={11} className="text-tomato" />}
                        <span className={isOverdue ? "text-tomato" : "text-espresso/50"}>
                          Due: {new Date(request.due_date).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty State */}
      {pendingRequests.length === 0 && (
        <div className="bg-chalk border-[3px] border-espresso rounded-[16px] shadow-flat-md flex flex-col items-center justify-center py-12 text-center px-6">
          <Coffee size={32} strokeWidth={1.5} className="text-espresso/20 mb-3" />
          <h3 className="font-extrabold text-[15px] uppercase tracking-[.04em] text-espresso mb-1">
            No Active Requests
          </h3>
          <p className="text-[12px] text-espresso/50 font-medium mb-4">
            Create a roast request manually or from an order to get started.
          </p>
          <Btn onClick={openCreateDialog}>
            <Plus size={12} strokeWidth={2.5} />
            New Request
          </Btn>
        </div>
      )}

      {/* Completed Requests */}
      {completedRequests.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-extrabold text-[11px] uppercase tracking-[.1em] text-espresso/50">
            Fulfilled &amp; Cancelled
          </h3>
          <div className="bg-chalk border-[3px] border-espresso rounded-[16px] shadow-flat-md overflow-hidden opacity-75">
            {/* Desktop */}
            <div className="hidden md:block">
              <div className="grid grid-cols-[1fr_100px_100px_100px_48px] border-b-[2px] border-espresso bg-cream px-5 py-2.5">
                {["Coffee", "Quantity", "Status", "Completed", ""].map((h) => (
                  <div key={h} className="text-[10px] font-extrabold uppercase tracking-[.1em] text-espresso/50">
                    {h}
                  </div>
                ))}
              </div>
              <div className="divide-y-[1.5px] divide-dashed divide-fog">
                {completedRequests.slice(0, 5).map((request) => (
                  <div key={request.id} className="grid grid-cols-[1fr_100px_100px_100px_48px] px-5 py-3 items-center">
                    <p className="text-[13px] font-bold text-espresso truncate">
                      {request.green_coffee_inventory?.name || "Unknown"}
                    </p>
                    <div className="text-[13px] font-bold text-espresso">
                      {request.requested_roasted_g.toLocaleString()}g
                    </div>
                    <div>
                      <StatusPill status={request.status} />
                    </div>
                    <div className="text-[12px] text-espresso/50 font-medium">
                      {new Date(request.created_at).toLocaleDateString()}
                    </div>
                    <button
                      onClick={() => handleDelete(request.id)}
                      className="flex h-7 w-7 items-center justify-center rounded-[6px] border-[2px] border-transparent text-espresso/30 hover:border-tomato/30 hover:text-tomato hover:bg-tomato/10 transition-all"
                    >
                      <Trash2 size={13} strokeWidth={2} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
            {/* Mobile */}
            <div className="md:hidden divide-y-[1.5px] divide-dashed divide-fog">
              {completedRequests.slice(0, 5).map((request) => (
                <div key={request.id} className="flex items-center justify-between p-4">
                  <div>
                    <p className="text-[13px] font-bold text-espresso">
                      {request.green_coffee_inventory?.name || "Unknown"}
                    </p>
                    <p className="text-[11px] text-espresso/50 font-medium">
                      {request.requested_roasted_g.toLocaleString()}g
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusPill status={request.status} />
                    <button
                      onClick={() => handleDelete(request.id)}
                      className="flex h-7 w-7 items-center justify-center rounded-[6px] border-[2px] border-transparent text-espresso/30 hover:border-tomato/30 hover:text-tomato hover:bg-tomato/10 transition-all"
                    >
                      <Trash2 size={13} strokeWidth={2} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
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
            <Btn variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Btn>
            <Btn
              onClick={handleSubmit}
              disabled={isSubmitting || !formData.greenCoffeeId || !formData.quantityG}
            >
              {isSubmitting ? "Saving..." : editingRequest ? "Update" : "Create"}
            </Btn>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

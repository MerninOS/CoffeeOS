"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  TrendingDown,
  Edit,
  Trash2,
  Search,
  Scale,
  Warehouse,
} from "lucide-react";
import {
  createCoffeeInventory,
  updateCoffeeInventory,
  adjustInventoryQuantity,
  deleteCoffeeInventory,
} from "./actions";

interface CoffeeInventory {
  id: string;
  name: string;
  origin: string;
  lot_code: string | null;
  supplier: string | null;
  price_per_lb: number;
  initial_quantity_g: number;
  current_green_quantity_g: number;
  roasted_stock_g: number;
  purchase_date: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
}

const LBS_TO_GRAMS = 453.592;

interface InventoryClientProps {
  initialInventory: CoffeeInventory[];
}

// ── Primitives ──────────────────────────────────────────────────────────────

function Btn({
  children,
  onClick,
  disabled,
  variant = "primary",
  size = "md",
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md";
  type?: "button" | "submit";
}) {
  const base =
    "inline-flex items-center justify-center font-extrabold uppercase tracking-[.08em] transition-all duration-[120ms] border-[2.5px] cursor-pointer disabled:opacity-50 disabled:pointer-events-none";
  const sizes = {
    sm: "text-[11px] px-3 py-1.5 rounded-[8px]",
    md: "text-[12px] px-4 py-2 rounded-[10px]",
  };
  const variants = {
    primary:
      "bg-tomato text-cream border-espresso shadow-[3px_3px_0_#1C0F05] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_#1C0F05] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none",
    outline:
      "bg-transparent text-espresso border-espresso hover:bg-espresso hover:text-cream",
    ghost:
      "bg-transparent text-espresso border-transparent hover:bg-fog/50 shadow-none",
    danger:
      "bg-transparent text-tomato border-tomato hover:bg-tomato hover:text-cream",
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${sizes[size]} ${variants[variant]}`}
    >
      {children}
    </button>
  );
}

function Panel({
  title,
  subtitle,
  action,
  children,
  className = "",
}: {
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`bg-chalk border-[3px] border-espresso rounded-[16px] shadow-flat-md overflow-hidden ${className}`}
    >
      {title && (
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b-2 border-espresso bg-cream">
          <div>
            <div className="font-extrabold text-sm uppercase tracking-[.08em] text-espresso">
              {title}
            </div>
            {subtitle && (
              <div className="text-[11px] text-muted-foreground mt-0.5">
                {subtitle}
              </div>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-extrabold uppercase tracking-[.08em] text-espresso mb-1">
      {children}
    </div>
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
      step={step}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className="w-full bg-cream border-[2.5px] border-espresso rounded-[10px] px-3 py-2 text-[13px] font-medium text-espresso placeholder:text-espresso/40 shadow-[3px_3px_0_#1C0F05] focus:outline-none focus:border-tomato focus:shadow-[3px_3px_0_#E8442A] focus:-translate-x-px focus:-translate-y-px transition-all duration-[120ms]"
    />
  );
}

function MerninTextarea({
  id,
  value,
  onChange,
  placeholder,
  rows = 3,
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
      className="w-full bg-cream border-[2.5px] border-espresso rounded-[10px] px-3 py-2 text-[13px] font-medium text-espresso placeholder:text-espresso/40 shadow-[3px_3px_0_#1C0F05] focus:outline-none focus:border-tomato focus:shadow-[3px_3px_0_#E8442A] focus:-translate-x-px focus:-translate-y-px transition-all duration-[120ms] resize-none"
    />
  );
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="bg-chalk border-[3px] border-espresso rounded-[14px] shadow-flat-sm px-5 py-4 flex flex-col gap-1">
      <div className="text-[11px] font-extrabold uppercase tracking-[.1em] text-espresso/60">
        {label}
      </div>
      <div className="text-[26px] font-extrabold text-espresso leading-none">
        {value}
      </div>
      {sub && (
        <div className="text-[11px] font-bold text-espresso/50">{sub}</div>
      )}
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export function InventoryClient({ initialInventory }: InventoryClientProps) {
  const [inventory, setInventory] = useState(initialInventory);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isAdjustDialogOpen, setIsAdjustDialogOpen] = useState(false);
  const [editingCoffee, setEditingCoffee] = useState<CoffeeInventory | null>(null);
  const [adjustingCoffee, setAdjustingCoffee] = useState<CoffeeInventory | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    origin: "",
    lot_code: "",
    supplier: "",
    price_per_lb: "",
    quantity_lbs: "",
    purchase_date: "",
    notes: "",
  });

  const [adjustmentData, setAdjustmentData] = useState({
    change_type: "manual_green_adjust" as
      | "manual_green_adjust"
      | "roast_deduct"
      | "sale_deduct",
    quantity: "",
    notes: "",
  });

  const gramsToLbs = (g: number) => g / LBS_TO_GRAMS;

  const filteredInventory = inventory.filter(
    (coffee) =>
      coffee.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      coffee.origin.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (coffee.supplier?.toLowerCase().includes(searchQuery.toLowerCase()) ??
        false)
  );

  const totalGreenLbs = inventory.reduce(
    (sum, c) => sum + gramsToLbs(c.current_green_quantity_g),
    0
  );
  const totalRoastedLbs = inventory.reduce(
    (sum, c) => sum + gramsToLbs(c.roasted_stock_g || 0),
    0
  );
  const totalValue = inventory.reduce(
    (sum, c) => sum + gramsToLbs(c.current_green_quantity_g) * c.price_per_lb,
    0
  );

  const resetForm = () => {
    setFormData({
      name: "",
      origin: "",
      lot_code: "",
      supplier: "",
      price_per_lb: "",
      quantity_lbs: "",
      purchase_date: "",
      notes: "",
    });
    setEditingCoffee(null);
  };

  const handleAddOrEdit = async () => {
    setIsSubmitting(true);
    try {
      if (editingCoffee) {
        const result = await updateCoffeeInventory(editingCoffee.id, {
          name: formData.name,
          origin: formData.origin,
          lot_code: formData.lot_code || undefined,
          supplier: formData.supplier || undefined,
          price_per_lb: parseFloat(formData.price_per_lb),
          notes: formData.notes || undefined,
        });
        if (result.error) {
          alert(result.error);
        } else {
          setIsAddDialogOpen(false);
          resetForm();
          window.location.reload();
        }
      } else {
        const result = await createCoffeeInventory({
          name: formData.name,
          origin: formData.origin,
          lot_code: formData.lot_code || undefined,
          supplier: formData.supplier || undefined,
          price_per_lb: parseFloat(formData.price_per_lb),
          quantity_lbs: parseFloat(formData.quantity_lbs),
          purchase_date: formData.purchase_date || undefined,
          notes: formData.notes || undefined,
        });
        if (result.error) {
          alert(result.error);
        } else {
          setIsAddDialogOpen(false);
          resetForm();
          window.location.reload();
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAdjustQuantity = async () => {
    if (!adjustingCoffee) return;
    setIsSubmitting(true);
    try {
      const quantity = parseFloat(adjustmentData.quantity);
      const actualChange =
        adjustmentData.change_type === "manual_green_adjust"
          ? quantity
          : -Math.abs(quantity);

      const result = await adjustInventoryQuantity(
        adjustingCoffee.id,
        adjustmentData.change_type,
        actualChange,
        adjustmentData.notes || undefined
      );

      if (result.error) {
        alert(result.error);
      } else {
        setIsAdjustDialogOpen(false);
        setAdjustingCoffee(null);
        setAdjustmentData({
          change_type: "manual_green_adjust",
          quantity: "",
          notes: "",
        });
        window.location.reload();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (
      !confirm(
        "Are you sure you want to delete this coffee? This cannot be undone."
      )
    )
      return;
    const result = await deleteCoffeeInventory(id);
    if (result.error) {
      alert(result.error);
    } else {
      window.location.reload();
    }
  };

  const openEditDialog = (coffee: CoffeeInventory) => {
    setEditingCoffee(coffee);
    setFormData({
      name: coffee.name,
      origin: coffee.origin,
      lot_code: coffee.lot_code || "",
      supplier: coffee.supplier || "",
      price_per_lb: coffee.price_per_lb.toString(),
      quantity_lbs: (coffee.initial_quantity_g / LBS_TO_GRAMS).toFixed(2),
      purchase_date: coffee.purchase_date || "",
      notes: coffee.notes || "",
    });
    setIsAddDialogOpen(true);
  };

  const openAdjustDialog = (coffee: CoffeeInventory) => {
    setAdjustingCoffee(coffee);
    setAdjustmentData({
      change_type: "manual_green_adjust",
      quantity: "",
      notes: "",
    });
    setIsAdjustDialogOpen(true);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[28px] md:text-[36px] font-extrabold uppercase tracking-tight leading-none text-espresso">
            Coffee Inventory
          </h1>
          <p className="text-[13px] text-espresso/60 font-medium mt-1">
            Manage your green and roasted coffee stock
          </p>
        </div>

        <Dialog
          open={isAddDialogOpen}
          onOpenChange={(open) => {
            setIsAddDialogOpen(open);
            if (!open) resetForm();
          }}
        >
          <DialogTrigger asChild>
            <Btn>
              <Plus size={14} strokeWidth={2.5} className="mr-1.5" />
              Add Coffee
            </Btn>
          </DialogTrigger>

          <DialogContent className="max-w-2xl p-0 gap-0 border-[3px] border-espresso rounded-[16px] overflow-hidden bg-chalk shadow-flat-lg">
            {/* Dialog header */}
            <div className="bg-cream border-b-[3px] border-espresso px-6 py-4">
              <DialogHeader>
                <DialogTitle className="font-extrabold text-[15px] uppercase tracking-[.08em] text-espresso">
                  {editingCoffee ? "Edit Coffee" : "Add New Coffee"}
                </DialogTitle>
              </DialogHeader>
            </div>

            {/* Dialog body */}
            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <FieldLabel>Name *</FieldLabel>
                  <MerninInput
                    id="name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="Ethiopia Yirgacheffe"
                  />
                </div>
                <div>
                  <FieldLabel>Origin *</FieldLabel>
                  <MerninInput
                    id="origin"
                    value={formData.origin}
                    onChange={(e) =>
                      setFormData({ ...formData, origin: e.target.value })
                    }
                    placeholder="Ethiopia"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <FieldLabel>Lot Code</FieldLabel>
                  <MerninInput
                    id="lot_code"
                    value={formData.lot_code}
                    onChange={(e) =>
                      setFormData({ ...formData, lot_code: e.target.value })
                    }
                    placeholder="12345"
                  />
                </div>
                <div>
                  <FieldLabel>Supplier</FieldLabel>
                  <MerninInput
                    id="supplier"
                    value={formData.supplier}
                    onChange={(e) =>
                      setFormData({ ...formData, supplier: e.target.value })
                    }
                    placeholder="Supplier Name"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <FieldLabel>Price per lb ($) *</FieldLabel>
                  <MerninInput
                    id="price_per_lb"
                    type="number"
                    step="0.01"
                    value={formData.price_per_lb}
                    onChange={(e) =>
                      setFormData({ ...formData, price_per_lb: e.target.value })
                    }
                    placeholder="6.50"
                  />
                </div>
                <div>
                  <FieldLabel>Initial Qty (lbs) *</FieldLabel>
                  <MerninInput
                    id="quantity_lbs"
                    type="number"
                    step="0.01"
                    value={formData.quantity_lbs}
                    onChange={(e) =>
                      setFormData({ ...formData, quantity_lbs: e.target.value })
                    }
                    placeholder="50"
                  />
                </div>
                <div>
                  <FieldLabel>Purchase Date</FieldLabel>
                  <MerninInput
                    id="purchase_date"
                    type="date"
                    value={formData.purchase_date}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        purchase_date: e.target.value,
                      })
                    }
                  />
                </div>
              </div>
              <div>
                <FieldLabel>Notes</FieldLabel>
                <MerninTextarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData({ ...formData, notes: e.target.value })
                  }
                  placeholder="Tasting notes, supplier info, etc."
                  rows={3}
                />
              </div>
            </div>

            {/* Dialog footer */}
            <div className="bg-cream border-t-[3px] border-espresso px-6 py-4 flex justify-end gap-2">
              <Btn
                variant="outline"
                onClick={() => {
                  setIsAddDialogOpen(false);
                  resetForm();
                }}
              >
                Cancel
              </Btn>
              <Btn
                onClick={handleAddOrEdit}
                disabled={
                  isSubmitting ||
                  !formData.name ||
                  !formData.origin ||
                  !formData.price_per_lb ||
                  (!editingCoffee && !formData.quantity_lbs)
                }
              >
                {isSubmitting
                  ? "Saving..."
                  : editingCoffee
                  ? "Save Changes"
                  : "Add Coffee"}
              </Btn>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Total Green Stock"
          value={`${totalGreenLbs.toFixed(1)} lbs`}
          sub={`${inventory.length} coffees tracked`}
        />
        <StatCard
          label="Total Roasted Stock"
          value={`${totalRoastedLbs.toFixed(1)} lbs`}
        />
        <StatCard
          label="Total Inventory Value"
          value={`$${totalValue.toFixed(2)}`}
          sub="Green coffee at cost"
        />
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search
          size={15}
          strokeWidth={2.2}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-espresso/40"
        />
        <input
          type="text"
          placeholder="Search by name, origin, or supplier..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-cream border-[2.5px] border-espresso rounded-[10px] pl-9 pr-3 py-2 text-[13px] font-medium text-espresso placeholder:text-espresso/40 shadow-[3px_3px_0_#1C0F05] focus:outline-none focus:border-tomato focus:shadow-[3px_3px_0_#E8442A] transition-all duration-[120ms]"
        />
      </div>

      {/* Inventory table */}
      <Panel title="Green Coffee" subtitle={`${filteredInventory.length} coffees`}>
        {/* Desktop */}
        <div className="hidden md:block -mx-5 -mb-5">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b-[2px] border-dashed border-fog">
                <th className="text-left px-5 py-2.5 font-extrabold text-[11px] uppercase tracking-[.08em] text-espresso/60">
                  Coffee
                </th>
                <th className="text-left px-3 py-2.5 font-extrabold text-[11px] uppercase tracking-[.08em] text-espresso/60">
                  Origin
                </th>
                <th className="text-left px-3 py-2.5 font-extrabold text-[11px] uppercase tracking-[.08em] text-espresso/60">
                  Supplier
                </th>
                <th className="text-right px-3 py-2.5 font-extrabold text-[11px] uppercase tracking-[.08em] text-espresso/60">
                  $/lb
                </th>
                <th className="text-right px-3 py-2.5 font-extrabold text-[11px] uppercase tracking-[.08em] text-espresso/60">
                  Green
                </th>
                <th className="text-right px-3 py-2.5 font-extrabold text-[11px] uppercase tracking-[.08em] text-espresso/60">
                  Roasted
                </th>
                <th className="text-right px-3 py-2.5 font-extrabold text-[11px] uppercase tracking-[.08em] text-espresso/60">
                  Value
                </th>
                <th className="w-[100px]" />
              </tr>
            </thead>
            <tbody>
              {filteredInventory.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-5 py-10 text-center text-espresso/50 font-medium"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <Warehouse size={28} strokeWidth={1.5} className="text-espresso/30" />
                      {searchQuery
                        ? "No coffees match your search."
                        : "Nothing here yet. Add your first coffee to get started."}
                    </div>
                  </td>
                </tr>
              ) : (
                <>
                  {filteredInventory.map((coffee, i) => {
                    const greenLbs = gramsToLbs(coffee.current_green_quantity_g);
                    const roastedLbs = gramsToLbs(coffee.roasted_stock_g || 0);
                    const totalCoffeeValue = greenLbs * coffee.price_per_lb;
                    const isLow = greenLbs < 5 && greenLbs > 0;
                    return (
                      <tr
                        key={coffee.id}
                        className={`border-b border-dashed border-fog/70 hover:bg-cream/60 transition-colors ${
                          i === filteredInventory.length - 1
                            ? "border-b-0"
                            : ""
                        }`}
                      >
                        <td className="px-5 py-3 font-bold text-espresso">
                          {coffee.name}
                        </td>
                        <td className="px-3 py-3 text-espresso/70">
                          {coffee.origin}
                        </td>
                        <td className="px-3 py-3 text-espresso/50">
                          {coffee.supplier || "—"}
                        </td>
                        <td className="px-3 py-3 text-right font-bold text-espresso">
                          ${coffee.price_per_lb.toFixed(2)}
                        </td>
                        <td className="px-3 py-3 text-right">
                          <span className="font-bold text-espresso">
                            {greenLbs.toFixed(1)} lbs
                          </span>
                          {isLow && (
                            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full border-[2px] border-espresso bg-sun text-espresso text-[10px] font-extrabold uppercase tracking-[.06em]">
                              Low
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-right font-bold text-espresso">
                          {roastedLbs.toFixed(1)} lbs
                        </td>
                        <td className="px-3 py-3 text-right font-bold text-espresso">
                          ${totalCoffeeValue.toFixed(2)}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => openAdjustDialog(coffee)}
                              title="Adjust quantity"
                              className="p-1.5 rounded-[8px] text-espresso/60 hover:text-espresso hover:bg-fog/50 transition-colors"
                            >
                              <Scale size={15} strokeWidth={2.2} />
                            </button>
                            <button
                              onClick={() => openEditDialog(coffee)}
                              title="Edit"
                              className="p-1.5 rounded-[8px] text-espresso/60 hover:text-espresso hover:bg-fog/50 transition-colors"
                            >
                              <Edit size={15} strokeWidth={2.2} />
                            </button>
                            <button
                              onClick={() => handleDelete(coffee.id)}
                              title="Delete"
                              className="p-1.5 rounded-[8px] text-espresso/60 hover:text-tomato hover:bg-tomato/10 transition-colors"
                            >
                              <Trash2 size={15} strokeWidth={2.2} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {/* Totals row */}
                  <tr className="bg-cream border-t-[2px] border-espresso">
                    <td
                      colSpan={4}
                      className="px-5 py-3 font-extrabold text-[11px] uppercase tracking-[.08em] text-espresso/60 text-right"
                    >
                      Totals
                    </td>
                    <td className="px-3 py-3 text-right font-extrabold text-espresso">
                      {totalGreenLbs.toFixed(1)} lbs
                    </td>
                    <td className="px-3 py-3 text-right font-extrabold text-espresso">
                      {totalRoastedLbs.toFixed(1)} lbs
                    </td>
                    <td className="px-3 py-3 text-right font-extrabold text-espresso">
                      ${totalValue.toFixed(2)}
                    </td>
                    <td />
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile card layout */}
        <div className="md:hidden -mx-5 -mb-5 divide-y-[2px] divide-dashed divide-fog">
          {filteredInventory.length === 0 ? (
            <div className="px-5 py-10 text-center text-espresso/50 font-medium flex flex-col items-center gap-2">
              <Warehouse size={28} strokeWidth={1.5} className="text-espresso/30" />
              {searchQuery
                ? "No coffees match your search."
                : "Nothing here yet. Add your first coffee."}
            </div>
          ) : (
            <>
              {filteredInventory.map((coffee) => {
                const greenLbs = gramsToLbs(coffee.current_green_quantity_g);
                const roastedLbs = gramsToLbs(coffee.roasted_stock_g || 0);
                const totalCoffeeValue = greenLbs * coffee.price_per_lb;
                const isLow = greenLbs < 5 && greenLbs > 0;
                return (
                  <div key={coffee.id} className="px-5 py-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-bold text-espresso">
                          {coffee.name}
                        </div>
                        <div className="text-[12px] text-espresso/60 font-medium">
                          {coffee.origin}
                          {coffee.supplier ? ` · ${coffee.supplier}` : ""}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => openAdjustDialog(coffee)}
                          className="p-1.5 rounded-[8px] text-espresso/60 hover:text-espresso hover:bg-fog/50 transition-colors"
                        >
                          <Scale size={15} strokeWidth={2.2} />
                        </button>
                        <button
                          onClick={() => openEditDialog(coffee)}
                          className="p-1.5 rounded-[8px] text-espresso/60 hover:text-espresso hover:bg-fog/50 transition-colors"
                        >
                          <Edit size={15} strokeWidth={2.2} />
                        </button>
                        <button
                          onClick={() => handleDelete(coffee.id)}
                          className="p-1.5 rounded-[8px] text-espresso/60 hover:text-tomato hover:bg-tomato/10 transition-colors"
                        >
                          <Trash2 size={15} strokeWidth={2.2} />
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <div className="text-[10px] font-extrabold uppercase tracking-[.08em] text-espresso/50 mb-0.5">
                          Price/lb
                        </div>
                        <div className="font-bold text-espresso text-[13px]">
                          ${coffee.price_per_lb.toFixed(2)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] font-extrabold uppercase tracking-[.08em] text-espresso/50 mb-0.5">
                          Value
                        </div>
                        <div className="font-bold text-espresso text-[13px]">
                          ${totalCoffeeValue.toFixed(2)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] font-extrabold uppercase tracking-[.08em] text-espresso/50 mb-0.5">
                          Green Stock
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-espresso text-[13px]">
                            {greenLbs.toFixed(1)} lbs
                          </span>
                          {isLow && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full border-[2px] border-espresso bg-sun text-espresso text-[9px] font-extrabold uppercase">
                              Low
                            </span>
                          )}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] font-extrabold uppercase tracking-[.08em] text-espresso/50 mb-0.5">
                          Roasted Stock
                        </div>
                        <div className="font-bold text-espresso text-[13px]">
                          {roastedLbs.toFixed(1)} lbs
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              {/* Mobile totals */}
              <div className="px-5 py-4 bg-cream border-t-[2px] border-espresso">
                <div className="text-[10px] font-extrabold uppercase tracking-[.08em] text-espresso/50 mb-2">
                  Totals
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <div className="text-[10px] font-extrabold uppercase tracking-[.08em] text-espresso/40 mb-0.5">
                      Green
                    </div>
                    <div className="font-extrabold text-espresso text-[13px]">
                      {totalGreenLbs.toFixed(1)} lbs
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-extrabold uppercase tracking-[.08em] text-espresso/40 mb-0.5">
                      Roasted
                    </div>
                    <div className="font-extrabold text-espresso text-[13px]">
                      {totalRoastedLbs.toFixed(1)} lbs
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-extrabold uppercase tracking-[.08em] text-espresso/40 mb-0.5">
                      Value
                    </div>
                    <div className="font-extrabold text-espresso text-[13px]">
                      ${totalValue.toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </Panel>

      {/* Adjust Quantity Dialog */}
      <Dialog open={isAdjustDialogOpen} onOpenChange={setIsAdjustDialogOpen}>
        <DialogContent className="max-w-md p-0 gap-0 border-[3px] border-espresso rounded-[16px] overflow-hidden bg-chalk shadow-flat-lg">
          <div className="bg-cream border-b-[3px] border-espresso px-6 py-4">
            <DialogHeader>
              <DialogTitle className="font-extrabold text-[15px] uppercase tracking-[.08em] text-espresso">
                Adjust: {adjustingCoffee?.name}
              </DialogTitle>
            </DialogHeader>
          </div>

          <div className="px-6 py-5 space-y-4">
            <div>
              <FieldLabel>Adjustment Type</FieldLabel>
              <Select
                value={adjustmentData.change_type}
                onValueChange={(value) =>
                  setAdjustmentData({
                    ...adjustmentData,
                    change_type: value as typeof adjustmentData.change_type,
                  })
                }
              >
                <SelectTrigger className="border-[2.5px] border-espresso bg-cream rounded-[10px] shadow-[3px_3px_0_#1C0F05] focus:ring-0 focus:border-tomato">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual_green_adjust">
                    <div className="flex items-center gap-2">
                      <Scale size={14} strokeWidth={2.2} className="text-espresso/60" />
                      Manual Adjustment (+/-)
                    </div>
                  </SelectItem>
                  <SelectItem value="roast_deduct">
                    <div className="flex items-center gap-2">
                      <TrendingDown size={14} strokeWidth={2.2} className="text-honey" />
                      Roast (Deduct Stock)
                    </div>
                  </SelectItem>
                  <SelectItem value="sale_deduct">
                    <div className="flex items-center gap-2">
                      <TrendingDown size={14} strokeWidth={2.2} className="text-tomato" />
                      Sale (Deduct Stock)
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <FieldLabel>Quantity (lbs)</FieldLabel>
              <MerninInput
                id="adjust_quantity"
                type="number"
                step="0.01"
                value={adjustmentData.quantity}
                onChange={(e) =>
                  setAdjustmentData({ ...adjustmentData, quantity: e.target.value })
                }
                placeholder="Enter amount"
              />
              {adjustmentData.quantity && (
                <p className="mt-1.5 text-[11px] font-medium text-espresso/60">
                  Current:{" "}
                  {gramsToLbs(
                    adjustingCoffee?.current_green_quantity_g || 0
                  ).toFixed(1)}{" "}
                  lbs →{" "}
                  <span className="font-extrabold text-espresso">
                    {adjustmentData.change_type === "manual_green_adjust"
                      ? (
                          gramsToLbs(
                            adjustingCoffee?.current_green_quantity_g || 0
                          ) + (parseFloat(adjustmentData.quantity) || 0)
                        ).toFixed(1)
                      : (
                          gramsToLbs(
                            adjustingCoffee?.current_green_quantity_g || 0
                          ) - Math.abs(parseFloat(adjustmentData.quantity) || 0)
                        ).toFixed(1)}{" "}
                    lbs
                  </span>{" "}
                  after adjustment
                </p>
              )}
            </div>

            <div>
              <FieldLabel>Notes (optional)</FieldLabel>
              <MerninTextarea
                id="adjust_notes"
                value={adjustmentData.notes}
                onChange={(e) =>
                  setAdjustmentData({ ...adjustmentData, notes: e.target.value })
                }
                placeholder="Reason for adjustment..."
                rows={2}
              />
            </div>
          </div>

          <div className="bg-cream border-t-[3px] border-espresso px-6 py-4 flex justify-end gap-2">
            <Btn
              variant="outline"
              onClick={() => setIsAdjustDialogOpen(false)}
            >
              Cancel
            </Btn>
            <Btn
              onClick={handleAdjustQuantity}
              disabled={isSubmitting || !adjustmentData.quantity}
            >
              {isSubmitting ? "Saving..." : "Apply Adjustment"}
            </Btn>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

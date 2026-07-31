"use client";

/**
 * The loud-Mernin' primitives /orders/[id] is built from.
 *
 * Moved out of order-detail-client.tsx byte-for-byte (CoffeeOS#70 Stage A). The
 * extraction is deliberately behaviour- and pixel-preserving: nothing here is
 * tidied, renamed or restyled, because Stage A's only proof is that the six
 * visual baselines did not move. A "while I'm here" change makes a broken
 * behaviour and a changed pixel indistinguishable.
 *
 * This whole file is temporary. Stage B replaces every one of these with the
 * Instrument kit (`@merninos/ui/instrument`) and deletes it. Do not invest here.
 */

export function Btn({
  children,
  onClick,
  disabled,
  variant = "primary",
  size = "md",
  className = "",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md";
  className?: string;
}) {
  const base =
    "inline-flex items-center justify-center font-extrabold uppercase tracking-[.08em] transition-all duration-[120ms] border-[2.5px] cursor-pointer disabled:opacity-50 disabled:pointer-events-none";
  const sizes = { sm: "text-[11px] px-3 py-1.5 rounded-[8px]", md: "text-[12px] px-4 py-2 rounded-[10px]" };
  const variants = {
    primary: "bg-tomato text-cream border-espresso shadow-[3px_3px_0_#1C0F05] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_#1C0F05] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none",
    outline: "bg-transparent text-espresso border-espresso hover:bg-espresso hover:text-cream",
    ghost: "bg-transparent text-espresso border-transparent hover:bg-fog/50 shadow-none",
    danger: "bg-transparent text-tomato border-tomato hover:bg-tomato hover:text-cream",
  };
  return (
    <button onClick={onClick} disabled={disabled} className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}>
      {children}
    </button>
  );
}

export function Panel({
  title,
  action,
  children,
  className = "",
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`bg-chalk border-[3px] border-espresso rounded-[16px] shadow-flat-md overflow-hidden ${className}`}>
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-b-2 border-espresso bg-cream">
        <div className="font-extrabold text-sm uppercase tracking-[.08em] text-espresso">{title}</div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

export function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-extrabold uppercase tracking-[.08em] text-espresso mb-1">
      {children}
    </div>
  );
}

export function MerninInput({
  type = "text",
  value,
  onChange,
  placeholder,
  step,
  min,
}: {
  type?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  step?: string;
  min?: string;
}) {
  return (
    <input
      type={type}
      step={step}
      min={min}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className="w-full bg-cream border-[2.5px] border-espresso rounded-[10px] px-3 py-2 text-[13px] font-medium text-espresso placeholder:text-espresso/40 shadow-[3px_3px_0_#1C0F05] focus:outline-none focus:border-tomato focus:shadow-[3px_3px_0_#E8442A] transition-all duration-[120ms]"
    />
  );
}

export function StatusPill({ status, type }: { status: string | null; type: "financial" | "fulfillment" }) {
  const s = (status || "").toLowerCase();
  let bg = "bg-fog text-espresso border-fog";
  if (type === "financial") {
    if (s === "paid") bg = "bg-matcha/20 text-matcha border-matcha";
    else if (s === "pending") bg = "bg-sun/30 text-espresso border-sun";
    else if (s === "refunded" || s === "partially_refunded") bg = "bg-tomato/20 text-tomato border-tomato";
  } else {
    if (s === "fulfilled") bg = "bg-matcha/20 text-matcha border-matcha";
    else if (s === "unfulfilled") bg = "bg-sun/30 text-espresso border-sun";
    else if (s === "partially_fulfilled") bg = "bg-sky/30 text-espresso border-sky";
  }
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full border-[2px] ${bg} text-[11px] font-extrabold uppercase tracking-[.06em]`}>
      {status || "Unfulfilled"}
    </span>
  );
}

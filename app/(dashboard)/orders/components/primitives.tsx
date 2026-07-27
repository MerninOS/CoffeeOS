"use client";

import React from "react";

/**
 * Presentational primitives for the /orders surface.
 *
 * Moved verbatim out of orders-client.tsx during the CoffeeOS#65 Stage A
 * extraction so the extracted components and their parent can share them
 * without a circular import. The class strings are UNCHANGED — Stage A is a
 * pure refactor and the visual baselines must not move. Restyling to the
 * instrument design system is Stage B's job.
 */

export function Btn({
  children,
  onClick,
  disabled,
  variant = "primary",
  size = "md",
  type = "button",
  className = "",
  testId,
}: {
  children: React.ReactNode;
  onClick?: (e?: React.MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  variant?: "primary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md";
  type?: "button" | "submit";
  className?: string;
  /** Test hook, not styling — Stage B's rewrite must preserve it. */
  testId?: string;
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
      data-testid={testId}
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function StatCard({
  label,
  value,
  valueClassName = "",
  valueTestId,
}: {
  label: string;
  value: string;
  valueClassName?: string;
  /** Test hook, not styling — survives the CoffeeOS#65 visual rebuild. */
  valueTestId?: string;
}) {
  return (
    <div className="bg-chalk border-[3px] border-espresso rounded-[14px] shadow-flat-sm px-4 py-3 flex flex-col gap-1">
      <div className="text-[10px] font-extrabold uppercase tracking-[.1em] text-espresso/60">
        {label}
      </div>
      <div
        data-testid={valueTestId}
        className={`text-[22px] font-extrabold text-espresso leading-none ${valueClassName}`}
      >
        {value}
      </div>
    </div>
  );
}

export function MerninInput({
  id,
  type = "text",
  value,
  onChange,
  placeholder,
  step,
  min,
  onClick,
  testId,
}: {
  id?: string;
  type?: string;
  value: string | number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  step?: string;
  min?: string;
  onClick?: (e: React.MouseEvent) => void;
  /** Test hook, not styling — Stage B's rewrite must preserve it. */
  testId?: string;
}) {
  return (
    <input
      id={id}
      type={type}
      step={step}
      min={min}
      value={value}
      onChange={onChange}
      onClick={onClick}
      placeholder={placeholder}
      data-testid={testId}
      className="w-full bg-cream border-[2.5px] border-espresso rounded-[10px] px-3 py-2 text-[13px] font-medium text-espresso placeholder:text-espresso/40 shadow-[3px_3px_0_#1C0F05] focus:outline-none focus:border-tomato focus:shadow-[3px_3px_0_#E8442A] transition-all duration-[120ms]"
    />
  );
}

export function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-extrabold uppercase tracking-[.08em] text-espresso mb-1">
      {children}
    </div>
  );
}

export function StatusPill({ status, type }: { status: string | null; type: "financial" | "fulfillment" }) {
  // Shopify leaves fulfillment_status null for an unfulfilled order, so this is
  // reached with null for real data — it threw "Cannot read properties of null"
  // and took the whole page down.
  const label = status ?? (type === "fulfillment" ? "unfulfilled" : "unknown");
  const s = label.toLowerCase();
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
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full border-[2px] ${bg} text-[10px] font-extrabold uppercase tracking-[.06em]`}>
      {label}
    </span>
  );
}

export function MarginPill({ margin }: { margin: number }) {
  const color =
    margin >= 30
      ? "bg-matcha/20 text-matcha border-matcha"
      : margin >= 15
      ? "bg-sun/30 text-espresso border-sun"
      : "bg-tomato/20 text-tomato border-tomato";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full border-[2px] ${color} text-[10px] font-extrabold`}>
      {margin.toFixed(1)}%
    </span>
  );
}

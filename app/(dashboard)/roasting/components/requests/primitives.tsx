"use client";

import type React from "react";

export type BtnVariant = "primary" | "outline" | "ghost" | "danger";
export function Btn({
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

export function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-extrabold uppercase tracking-[.08em] text-espresso mb-1.5">
      {children}
    </p>
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

export function MerninTextarea({
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

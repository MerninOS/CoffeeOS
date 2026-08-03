"use client";

import Link from "next/link";

export type BtnVariant = "primary" | "outline" | "ghost";
export function Btn({
  "data-testid": testId,
  variant = "primary",
  children,
  onClick,
  disabled,
  className = "",
  href,
}: {
  "data-testid"?: string;
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
  if (href) return <Link href={href} data-testid={testId} className={cls}>{children}</Link>;
  return (
    <button data-testid={testId} onClick={onClick} disabled={disabled} className={cls}>
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
  "data-testid": testId,
  id,
  type = "text",
  value,
  onChange,
  placeholder,
  step,
}: {
  "data-testid"?: string;
  id?: string;
  type?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  step?: string;
}) {
  return (
    <input
      data-testid={testId}
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

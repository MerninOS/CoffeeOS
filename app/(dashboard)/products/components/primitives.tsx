"use client";

import Link from "next/link";

/**
 * The loud-Mernin' primitives this page defines for itself.
 *
 * Moved out of products-client.tsx VERBATIM (CoffeeOS#69 Stage A) — every class
 * string is byte-identical, because Stage A's proof is that the baselines do not
 * move. Nothing here is improved on purpose.
 *
 * These are DELETED in Stage B, replaced by @merninos/ui/instrument's Button,
 * Badge, Input, Textarea and Field. They live in their own file meanwhile so
 * that deletion is a file removal and an import change rather than surgery on a
 * 766-line component.
 *
 * Note for the reader: `Btn`, `MerninInput` and `FieldLabel` are each redefined
 * in 13 separate files across this app. Consolidating them is the real prize of
 * the instrument rollout, not the colours.
 */

export function Btn({
  variant = "primary",
  size = "md",
  onClick,
  disabled,
  href,
  children,
  type = "button",
  className = "",
}: {
  variant?: "primary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md";
  onClick?: () => void;
  disabled?: boolean;
  asChild?: boolean;
  href?: string;
  children: React.ReactNode;
  type?: "button" | "submit";
  className?: string;
}) {
  const base =
    "inline-flex items-center gap-2 font-extrabold uppercase tracking-[.08em] rounded-full transition-all duration-100 cursor-pointer whitespace-nowrap select-none";
  const sizes = { sm: "h-[30px] px-3.5 text-[11px]", md: "h-[38px] px-5 text-[12px]" };
  const variants = {
    primary:
      "bg-tomato text-cream border-[2.5px] border-espresso shadow-[3px_3px_0_#1C0F05] hover:-translate-x-[1.5px] hover:-translate-y-[1.5px] hover:shadow-[4px_4px_0_#1C0F05] active:translate-x-[2.5px] active:translate-y-[2.5px] active:shadow-none disabled:opacity-50 disabled:pointer-events-none",
    outline:
      "bg-transparent text-espresso border-[2.5px] border-espresso shadow-[3px_3px_0_#1C0F05] hover:-translate-x-[1.5px] hover:-translate-y-[1.5px] hover:shadow-[4px_4px_0_#1C0F05] active:translate-x-[2.5px] active:translate-y-[2.5px] active:shadow-none disabled:opacity-50 disabled:pointer-events-none",
    ghost:
      "bg-transparent text-espresso border-[2.5px] border-transparent hover:bg-fog/50 disabled:opacity-50 disabled:pointer-events-none",
    danger:
      "bg-tomato text-cream border-[2.5px] border-espresso shadow-[3px_3px_0_#1C0F05] hover:-translate-x-[1.5px] hover:-translate-y-[1.5px] active:translate-x-[2.5px] active:translate-y-[2.5px] active:shadow-none disabled:opacity-50 disabled:pointer-events-none",
  };
  const cls = `${base} ${sizes[size]} ${variants[variant]} ${className}`;
  if (href) {
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    );
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={cls}>
      {children}
    </button>
  );
}

export function Pill({
  variant,
  children,
}: {
  variant: "matcha" | "sun" | "tomato" | "sky" | "fog" | "espresso";
  children: React.ReactNode;
}) {
  const styles: Record<string, string> = {
    matcha: "bg-matcha text-cream",
    sun: "bg-sun text-espresso",
    tomato: "bg-tomato text-cream",
    sky: "bg-sky text-espresso",
    fog: "bg-fog text-espresso",
    espresso: "bg-espresso text-cream",
  };
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full border-2 border-espresso text-[10px] font-extrabold tracking-[.1em] uppercase ${styles[variant]}`}
    >
      {children}
    </span>
  );
}

export function MerninInput({
  id,
  value,
  onChange,
  placeholder,
  type = "text",
  step,
}: {
  id?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  type?: string;
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
      className="w-full bg-chalk border-[3px] border-espresso rounded-[10px] px-3.5 py-2.5 font-body text-[14px] text-espresso shadow-[3px_3px_0_#1C0F05] outline-none placeholder:text-muted-foreground focus:-translate-x-[1px] focus:-translate-y-[1px] focus:shadow-[4px_4px_0_#E8442A] focus:border-tomato transition-all duration-100"
    />
  );
}

export function MerninTextarea({
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
      className="w-full bg-chalk border-[3px] border-espresso rounded-[10px] px-3.5 py-2.5 font-body text-[14px] text-espresso shadow-[3px_3px_0_#1C0F05] outline-none placeholder:text-muted-foreground focus:-translate-x-[1px] focus:-translate-y-[1px] focus:shadow-[4px_4px_0_#E8442A] focus:border-tomato transition-all duration-100 resize-none"
    />
  );
}

export function FieldLabel({
  htmlFor,
  children,
}: {
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="block text-[10.5px] font-extrabold uppercase tracking-[.1em] text-espresso mb-1.5"
    >
      {children}
    </label>
  );
}

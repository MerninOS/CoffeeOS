"use client";

import Link from "next/link";

/**
 * The loud-Mernin' primitives this page defines for itself.
 *
 * Moved out of product-detail-client.tsx VERBATIM (CoffeeOS#69 Stage A) — every
 * class string is byte-identical, because Stage A's proof is that the baselines
 * do not move. Nothing here is improved on purpose.
 *
 * These are DELETED in Stage B, replaced by @merninos/ui/instrument's Button,
 * Badge, Input, Field and the worksheet Panel. They live in their own file
 * meanwhile so that deletion is a file removal and an import change rather than
 * surgery on a 972-line component.
 *
 * Note for the reader: these are near-twins of ../../components/primitives.tsx
 * but NOT identical, and the differences are load-bearing today, so they are
 * kept apart rather than merged:
 *  - this `Btn` adds a `size: "icon"` and a `variant: "icon-ghost"`, adds
 *    `justify-center`, and hoists the `disabled:` classes into `base` instead of
 *    repeating them per variant (the list page's version has no `icon` size)
 *  - this `Btn` has no `danger` variant; the list page's has no `icon-ghost`
 *  - this `MerninInput` takes `min` and a `prefix` slot and swaps `px-3.5` for
 *    `pl-9` when prefixed; the list page's takes neither
 *  - this `Pill` has no `espresso` variant
 * Consolidating them is Stage B's job, not Stage A's.
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
  variant?: "primary" | "outline" | "ghost" | "icon-ghost";
  size?: "sm" | "md" | "icon";
  onClick?: () => void;
  disabled?: boolean;
  href?: string;
  children: React.ReactNode;
  type?: "button" | "submit";
  className?: string;
}) {
  const base =
    "inline-flex items-center justify-center gap-2 font-extrabold uppercase tracking-[.08em] rounded-full transition-all duration-100 cursor-pointer whitespace-nowrap select-none disabled:opacity-50 disabled:pointer-events-none";
  const sizes = {
    sm: "h-[30px] px-3.5 text-[11px]",
    md: "h-[38px] px-5 text-[12px]",
    icon: "h-[34px] w-[34px] p-0",
  };
  const variants = {
    primary:
      "bg-tomato text-cream border-[2.5px] border-espresso shadow-[3px_3px_0_#1C0F05] hover:-translate-x-[1.5px] hover:-translate-y-[1.5px] hover:shadow-[4px_4px_0_#1C0F05] active:translate-x-[2.5px] active:translate-y-[2.5px] active:shadow-none",
    outline:
      "bg-transparent text-espresso border-[2.5px] border-espresso shadow-[3px_3px_0_#1C0F05] hover:-translate-x-[1.5px] hover:-translate-y-[1.5px] hover:shadow-[4px_4px_0_#1C0F05] active:translate-x-[2.5px] active:translate-y-[2.5px] active:shadow-none",
    ghost:
      "bg-transparent text-espresso border-[2.5px] border-transparent hover:bg-fog/50",
    "icon-ghost":
      "bg-transparent text-tomato border-[2px] border-transparent hover:bg-tomato/10",
  };
  const cls = `${base} ${sizes[size]} ${variants[variant]} ${className}`;
  if (href)
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    );
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={cls}>
      {children}
    </button>
  );
}

export function Panel({
  title,
  subtitle,
  action,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`bg-chalk border-[3px] border-espresso rounded-[16px] shadow-flat-md overflow-hidden ${className}`}
    >
      <div className="flex items-start justify-between gap-3 px-5 py-4 border-b-2 border-espresso bg-cream">
        <div>
          <div className="font-extrabold text-sm uppercase tracking-[.08em] text-espresso">
            {title}
          </div>
          {subtitle && (
            <div className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</div>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

export function FieldLabel({ htmlFor, children }: { htmlFor?: string; children: React.ReactNode }) {
  return (
    <label
      htmlFor={htmlFor}
      className="block text-[10.5px] font-extrabold uppercase tracking-[.1em] text-espresso mb-1.5"
    >
      {children}
    </label>
  );
}

export function MerninInput({
  id,
  value,
  onChange,
  placeholder,
  type = "text",
  step,
  min,
  prefix,
}: {
  id?: string;
  value: string | number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  type?: string;
  step?: string;
  min?: string;
  prefix?: React.ReactNode;
}) {
  return (
    <div className="relative">
      {prefix && (
        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
          {prefix}
        </div>
      )}
      <input
        id={id}
        type={type}
        step={step}
        min={min}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`w-full bg-chalk border-[3px] border-espresso rounded-[10px] ${prefix ? "pl-9" : "px-3.5"} py-2.5 pr-3.5 font-body text-[14px] text-espresso shadow-[3px_3px_0_#1C0F05] outline-none placeholder:text-muted-foreground focus:-translate-x-[1px] focus:-translate-y-[1px] focus:shadow-[4px_4px_0_#E8442A] focus:border-tomato transition-all duration-100`}
      />
    </div>
  );
}

export function Pill({
  variant,
  children,
}: {
  variant: "matcha" | "sun" | "tomato" | "sky" | "fog";
  children: React.ReactNode;
}) {
  const styles: Record<string, string> = {
    matcha: "bg-matcha text-cream",
    sun: "bg-sun text-espresso",
    tomato: "bg-tomato text-cream",
    sky: "bg-sky text-espresso",
    fog: "bg-fog text-espresso",
  };
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full border-2 border-espresso text-[10px] font-extrabold tracking-[.1em] uppercase ${styles[variant]}`}
    >
      {children}
    </span>
  );
}

/**
 * DEFECT PRESERVED ON PURPOSE: every money figure on this page is rendered to
 * THREE decimals, including the four stat tiles, the per-line COGS totals and
 * the donut tooltip — so a $18.00 product reads "$18.000". The sibling list page
 * uses `toFixed(2)`. Stage A must not change behaviour, so this is recorded
 * rather than fixed; Criterion 4's currency formatting lands in Stage C.
 *
 * Note the wholesale panel's inline "Profit: $…" is NOT routed through this and
 * uses `toFixed(2)`, so the two disagree on the same screen. Also preserved.
 */
export const fmt = (n: number) => `$${n.toFixed(3)}`;

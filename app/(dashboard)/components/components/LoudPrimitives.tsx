"use client";

/**
 * The loud-Mernin' primitives of /components, moved out of components-client.tsx
 * BYTE-IDENTICALLY.
 *
 * CoffeeOS#73 Stage A. This file is temporary and is deleted in Stage B (plan
 * task B6). It exists so the extraction can be proven behaviour-preserving on
 * its own: with every class string unchanged, a baseline diff at this point can
 * only mean the extraction broke something — it cannot mean the design changed,
 * because the design has not been touched yet.
 *
 * Do NOT tidy these class strings. Their value here is that they are the same
 * bytes that were rendering before.
 */

import React from "react";

export function Btn({
  children,
  variant = "primary",
  size = "md",
  disabled,
  onClick,
  type = "button",
  className = "",
  testId,
}: {
  children: React.ReactNode;
  variant?: "primary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md";
  disabled?: boolean;
  onClick?: () => void;
  type?: "button" | "submit";
  className?: string;
  /** The capability specs select by testid, never by class or copy — those are
   *  exactly what Stage B rewrites. Btn does not spread arbitrary props, so the
   *  hook has to be explicit. */
  testId?: string;
}) {
  const base =
    "inline-flex items-center justify-center font-body font-extrabold uppercase tracking-widest transition-all duration-100 cursor-pointer disabled:opacity-50 disabled:pointer-events-none";
  const sizes = {
    sm: "text-[0.65rem] px-3 py-1.5 gap-1",
    md: "text-[0.7rem] px-4 py-2 gap-1.5",
  };
  const variants = {
    primary:
      "bg-tomato text-cream border-[2.5px] border-espresso rounded-full shadow-[3px_3px_0_#1C0F05] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_#1C0F05] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none",
    outline:
      "bg-transparent text-espresso border-[2.5px] border-espresso rounded-full shadow-[3px_3px_0_#1C0F05] hover:bg-espresso hover:text-cream active:translate-x-0.5 active:translate-y-0.5 active:shadow-none",
    ghost:
      "bg-transparent text-espresso border-[2px] border-transparent rounded-lg hover:bg-fog/40 active:bg-fog/60",
    danger:
      "bg-tomato text-cream border-[2.5px] border-espresso rounded-full shadow-[3px_3px_0_#1C0F05] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_#1C0F05] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none",
  };
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      data-testid={testId}
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function FieldLabel({
  children,
  htmlFor,
}: {
  children: React.ReactNode;
  htmlFor?: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="block text-[0.65rem] font-extrabold uppercase tracking-widest text-espresso font-body mb-1"
    >
      {children}
    </label>
  );
}

export function MerninInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full bg-chalk border-[2.5px] border-espresso rounded-xl px-3 py-2 font-body text-sm text-espresso placeholder:text-espresso/30 shadow-[3px_3px_0_#1C0F05] focus:outline-none focus:-translate-x-0.5 focus:-translate-y-0.5 focus:shadow-[4px_4px_0_#E8442A] focus:border-tomato transition-all ${props.className ?? ""}`}
    />
  );
}

export function MerninTextarea(
  props: React.TextareaHTMLAttributes<HTMLTextAreaElement>
) {
  return (
    <textarea
      {...props}
      className={`w-full bg-chalk border-[2.5px] border-espresso rounded-xl px-3 py-2 font-body text-sm text-espresso placeholder:text-espresso/30 shadow-[3px_3px_0_#1C0F05] focus:outline-none focus:-translate-x-0.5 focus:-translate-y-0.5 focus:shadow-[4px_4px_0_#E8442A] focus:border-tomato transition-all resize-none ${props.className ?? ""}`}
    />
  );
}

const TYPE_COLORS: Record<string, string> = {
  ingredient: "bg-sky/20 text-espresso border-sky",
  labor: "bg-honey/20 text-espresso border-honey",
  packaging: "bg-sun/30 text-espresso border-sun",
  other: "bg-fog/60 text-espresso border-fog",
};

export function TypePill({ type }: { type: string }) {
  const colors = TYPE_COLORS[type] ?? "bg-fog/60 text-espresso border-fog";
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[0.6rem] font-extrabold uppercase tracking-widest border-[2px] font-body ${colors}`}
    >
      {type}
    </span>
  );
}

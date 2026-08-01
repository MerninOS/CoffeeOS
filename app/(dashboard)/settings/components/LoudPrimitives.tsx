"use client";

import React from "react";

/**
 * The hand-rolled loud-Mernin' primitives /settings used before the Instrument
 * conversion, moved here VERBATIM during the CoffeeOS#74 Stage A extraction.
 *
 * They are lifted rather than rewritten on purpose. Stage A's only claim is that
 * it moved code without changing behaviour, and the proof is that no pixel
 * moved — so not one character of these class strings may change here.
 *
 * ALL OF THIS IS DELETED IN STAGE B. Nothing new should import from this file:
 * every one of these has an `@merninos/ui/instrument` equivalent (Btn → Button,
 * MerninInput → Input, FieldLabel → Field, StatusPill → Badge, InfoNote →
 * InlineBanner), and SectionPanel/PanelHeader have none by design — the nested
 * bordered card is the pattern the Instrument layout rule exists to forbid.
 */

export function Btn({
  children,
  variant = "primary",
  size = "md",
  disabled,
  onClick,
  type = "button",
  className = "",
  href,
  target,
  rel,
}: {
  children: React.ReactNode;
  variant?: "primary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md";
  disabled?: boolean;
  onClick?: () => void;
  type?: "button" | "submit";
  className?: string;
  asChild?: boolean;
  href?: string;
  target?: string;
  rel?: string;
}) {
  const base =
    "inline-flex items-center justify-center font-body font-extrabold uppercase tracking-widest transition-all duration-100 cursor-pointer disabled:opacity-50 disabled:pointer-events-none";
  const sizes = { sm: "text-[0.65rem] px-3 py-1.5 gap-1", md: "text-[0.7rem] px-4 py-2 gap-1.5" };
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
  const cls = `${base} ${sizes[size]} ${variants[variant]} ${className}`;
  if (href) {
    return (
      <a href={href} target={target} rel={rel} className={cls}>
        {children}
      </a>
    );
  }
  return (
    <button type={type} disabled={disabled} onClick={onClick} className={cls}>
      {children}
    </button>
  );
}

export function FieldLabel({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
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
      className={`w-full bg-chalk border-[2.5px] border-espresso rounded-xl px-3 py-2 font-body text-sm text-espresso placeholder:text-espresso/30 shadow-[3px_3px_0_#1C0F05] focus:outline-none focus:-translate-x-0.5 focus:-translate-y-0.5 focus:shadow-[4px_4px_0_#E8442A] focus:border-tomato transition-all disabled:opacity-40 disabled:shadow-none disabled:cursor-not-allowed ${props.className ?? ""}`}
    />
  );
}

export function SectionPanel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-chalk border-[3px] border-espresso rounded-[16px] shadow-flat-md overflow-hidden ${className}`}>
      {children}
    </div>
  );
}

export function PanelHeader({ icon, title, subtitle, right }: { icon: React.ReactNode; title: string; subtitle?: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 px-5 py-4 border-b-2 border-espresso bg-cream">
      <div className="flex items-center gap-2.5">
        <div className="text-espresso/60">{icon}</div>
        <div>
          <h2 className="font-body font-extrabold text-sm uppercase tracking-widest text-espresso leading-none">
            {title}
          </h2>
          {subtitle && (
            <p className="mt-0.5 text-xs text-espresso/50 font-body">{subtitle}</p>
          )}
        </div>
      </div>
      {right && <div className="flex items-center gap-2">{right}</div>}
    </div>
  );
}

export function StatusPill({ active, label }: { active: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[0.6rem] font-extrabold uppercase tracking-widest border-[2px] font-body ${
        active
          ? "bg-matcha/20 text-espresso border-matcha"
          : "bg-honey/20 text-espresso border-honey"
      }`}
    >
      {label}
    </span>
  );
}

export function InfoNote({
  variant = "info",
  children,
}: {
  variant?: "info" | "warn" | "note";
  children: React.ReactNode;
}) {
  const colors = {
    info: "bg-sky/10 border-sky/40",
    warn: "bg-honey/10 border-honey/40",
    note: "bg-fog/40 border-fog",
  };
  return (
    <div className={`rounded-xl border-[2px] px-4 py-3 text-sm font-body text-espresso/80 ${colors[variant]}`}>
      {children}
    </div>
  );
}

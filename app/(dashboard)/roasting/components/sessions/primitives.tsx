"use client";

import type React from "react";
import type { CSSProperties } from "react";
import Link from "next/link";
import { Button, Input, Textarea } from "@merninos/ui/instrument";
import { mono, overline } from "@/lib/instrument/tokens";

/**
 * Retokenized onto instrument (CoffeeOS#71), matching the
 * requests/primitives.tsx conversion. Same external contract as before —
 * data-testid, variant names, value/onChange shapes, and the `href` branch on
 * `Btn` for the mobile card's "View Session" link — because
 * sessions-client.tsx, SessionCard.tsx and SessionDialog.tsx call these
 * without change.
 *
 * `Btn`'s `href` branch does NOT delegate to instrument's own `Button` (which
 * only ever renders a `<button>`) — it renders a `next/link` `Link` carrying
 * the same `data-instrument="button"` / `data-variant` hooks the shipped
 * instrument stylesheet keys its button skin off of (see
 * node_modules/@merninos/ui/dist/instrument/styles.css: the rules are
 * `[data-instrument="button"][data-variant="…"]`, not `button[…]`), so the
 * link picks up the exact same fill/hover/press states as a real `Button`
 * without a second hand-rolled copy of them here.
 */
export type BtnVariant = "primary" | "outline" | "ghost";

const VARIANT_MAP: Record<BtnVariant, "primary" | "secondary" | "tertiary"> = {
  primary: "primary",
  outline: "secondary",
  ghost: "tertiary",
};

const LINK_BTN_STYLE: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  fontFamily: "var(--font-sans)",
  fontWeight: "var(--fw-medium)" as unknown as number,
  fontSize: "var(--fs-label)",
  lineHeight: 1,
  padding: "6px 12px",
  minHeight: 30,
  borderRadius: "var(--r-md)",
  whiteSpace: "nowrap",
  userSelect: "none",
  textDecoration: "none",
};

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
  const v = VARIANT_MAP[variant];
  if (href) {
    return (
      <Link
        href={href}
        data-testid={testId}
        data-instrument="button"
        data-variant={v}
        className={className}
        style={LINK_BTN_STYLE}
      >
        {children}
      </Link>
    );
  }
  return (
    <Button
      data-testid={testId}
      variant={v}
      size="sm"
      onClick={onClick}
      disabled={disabled}
      className={className}
    >
      {children}
    </Button>
  );
}

export function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ ...overline, color: "var(--ink-muted)", marginBottom: 6 }}>
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
  min,
  required,
}: {
  "data-testid"?: string;
  id?: string;
  type?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  step?: string;
  min?: string;
  required?: boolean;
}) {
  return (
    <Input
      data-testid={testId}
      id={id}
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      step={step}
      min={min}
      required={required}
    />
  );
}

export function MerninTextarea({
  "data-testid": testId,
  id,
  value,
  onChange,
  placeholder,
  rows = 2,
}: {
  "data-testid"?: string;
  id?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <Textarea
      data-testid={testId}
      id={id}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      rows={rows}
    />
  );
}

/**
 * Small mono for the cost basis line under each cost figure (session-cost.ts'
 * `cost_basis`, e.g. "1.3 h × $85.00"). Deliberately NOT `overline` — overline
 * uppercases, which mangles unit symbols ("1.3 h" -> "1.3 H", "8.1 kWh" ->
 * "8.1 KWH"). Units keep their own casing here; only labels (`overline`)
 * shout.
 */
export const microdata: CSSProperties = {
  ...mono,
  fontSize: "var(--fs-overline)",
  color: "var(--ink-subtle)",
};

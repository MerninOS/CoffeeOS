"use client";

import type React from "react";
import { Button, Input } from "@merninos/ui/instrument";
import { overline } from "@/lib/instrument/tokens";

/**
 * Retokenized onto instrument (CoffeeOS#71), matching the shape already proven
 * out by ../requests/primitives.tsx — same external contract (data-testid,
 * variant names, value/onChange shapes) so BatchesTable/BatchCard/
 * ComponentDialog call these without change beyond the import.
 *
 * Btn is a thin variant-mapping wrapper around instrument's own `Button`
 * rather than a hand-rolled style object, for the same reason as the requests
 * copy: there is nothing left to retokenize once the mapping is in place, and
 * a second copy of instrument's button geometry here would be exactly the
 * near-duplicate CoffeeOS#110 warns about for tokens.ts.
 *
 * `href` is dropped rather than ported: instrument's Button always renders a
 * `<button>` (no `asChild`), so the one caller that used to navigate via
 * `href` (the empty state's "Go to Sessions") now does it the way the other
 * converted list pages already do — `useRouter().push(...)` on `onClick` (see
 * inventory-client.tsx) — rather than growing a second, hand-styled anchor
 * variant here just to keep a `href` prop alive.
 */
export type BtnVariant = "primary" | "outline" | "ghost";

const VARIANT_MAP: Record<BtnVariant, "primary" | "secondary" | "tertiary"> = {
  primary: "primary",
  outline: "secondary",
  ghost: "tertiary",
};

export function Btn({
  "data-testid": testId,
  variant = "primary",
  children,
  onClick,
  disabled,
  className = "",
}: {
  "data-testid"?: string;
  variant?: BtnVariant;
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <Button
      data-testid={testId}
      type="button"
      variant={VARIANT_MAP[variant]}
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
    <Input
      data-testid={testId}
      id={id}
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      step={step}
    />
  );
}

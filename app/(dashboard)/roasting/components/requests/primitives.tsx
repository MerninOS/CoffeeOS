"use client";

import type React from "react";
import { Button, Input, Textarea } from "@merninos/ui/instrument";
import { overline } from "@/lib/instrument/tokens";

/**
 * Retokenized onto instrument (CoffeeOS#71). Same external contract as before
 * — data-testid, variant names, value/onChange shapes — because
 * roast-requests-client.tsx and RequestDialog.tsx call these without change.
 *
 * Btn is a thin variant-mapping wrapper around instrument's own `Button`
 * rather than a hand-rolled style object: there is nothing left to retokenize
 * once the mapping is in place, and a second copy of instrument's button
 * geometry here would be exactly the near-duplicate CoffeeOS#110 warns about
 * for tokens.ts.
 */
export type BtnVariant = "primary" | "outline" | "ghost" | "danger";

const VARIANT_MAP: Record<BtnVariant, "primary" | "secondary" | "tertiary" | "destructive"> = {
  primary: "primary",
  outline: "secondary",
  ghost: "tertiary",
  danger: "destructive",
};

export function Btn({
  "data-testid": testId,
  variant = "primary",
  children,
  onClick,
  disabled,
  className = "",
  type = "button",
}: {
  "data-testid"?: string;
  variant?: BtnVariant;
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  type?: "button" | "submit";
}) {
  return (
    <Button
      data-testid={testId}
      type={type}
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
  min,
}: {
  "data-testid"?: string;
  id?: string;
  type?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  step?: string;
  min?: string;
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
    />
  );
}

export function MerninTextarea({
  "data-testid": testId,
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  "data-testid"?: string;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <Textarea
      data-testid={testId}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      rows={rows}
    />
  );
}

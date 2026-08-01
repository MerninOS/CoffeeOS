"use client";

/**
 * The loud-Mernin' primitives this route defines for itself, moved verbatim out
 * of inventory-client.tsx (CoffeeOS#72 Stage 3).
 *
 * EXTRACTION ONLY — byte-identical to what shipped. They are shared here because
 * the dialogs need them too, and duplicating them into two files would have made
 * the Stage 4 deletion twice the work.
 *
 * All six are SCHEDULED FOR DELETION in Stage 4, replaced by Button, Field,
 * Input, Textarea, Badge and the worksheet layout from @merninos/ui/instrument.
 * Nothing new should import them.
 */


export function Btn({
  children,
  onClick,
  disabled,
  variant = "primary",
  size = "md",
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md";
  type?: "button" | "submit";
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
      className={`${base} ${sizes[size]} ${variants[variant]}`}
    >
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
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`bg-chalk border-[3px] border-espresso rounded-[16px] shadow-flat-md overflow-hidden ${className}`}
    >
      {title && (
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b-2 border-espresso bg-cream">
          <div>
            <div className="font-extrabold text-sm uppercase tracking-[.08em] text-espresso">
              {title}
            </div>
            {subtitle && (
              <div className="text-[11px] text-muted-foreground mt-0.5">
                {subtitle}
              </div>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
}

export function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-extrabold uppercase tracking-[.08em] text-espresso mb-1">
      {children}
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
}: {
  id?: string;
  type?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
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
      className="w-full bg-cream border-[2.5px] border-espresso rounded-[10px] px-3 py-2 text-[13px] font-medium text-espresso placeholder:text-espresso/40 shadow-[3px_3px_0_#1C0F05] focus:outline-none focus:border-tomato focus:shadow-[3px_3px_0_#E8442A] focus:-translate-x-px focus:-translate-y-px transition-all duration-[120ms]"
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
      className="w-full bg-cream border-[2.5px] border-espresso rounded-[10px] px-3 py-2 text-[13px] font-medium text-espresso placeholder:text-espresso/40 shadow-[3px_3px_0_#1C0F05] focus:outline-none focus:border-tomato focus:shadow-[3px_3px_0_#E8442A] focus:-translate-x-px focus:-translate-y-px transition-all duration-[120ms] resize-none"
    />
  );
}

export function StatCard({
  label,
  value,
  sub,
  testId,
}: {
  label: string;
  value: string;
  sub?: string;
  testId?: string;
}) {
  return (
    <div className="bg-chalk border-[3px] border-espresso rounded-[14px] shadow-flat-sm px-5 py-4 flex flex-col gap-1">
      <div className="text-[11px] font-extrabold uppercase tracking-[.1em] text-espresso/60">
        {label}
      </div>
      <div
        data-testid={testId}
        className="text-[26px] font-extrabold text-espresso leading-none"
      >
        {value}
      </div>
      {sub && (
        <div className="text-[11px] font-bold text-espresso/50">{sub}</div>
      )}
    </div>
  );
}


"use client";

import React, { useState } from "react";
import { X, Plus, Loader2, Check } from "lucide-react";
import { saveRoastingSettings } from "../actions";

interface Settings {
  id: string;
  default_charge_temp: number | null;
  default_roast_duration_minutes: number | null;
  default_roast_profiles: string[] | null;
  weight_loss_target: number | null;
}

interface RoastingSettingsClientProps {
  initialSettings: Settings | null;
}

// ── Mernin' primitives ───────────────────────────────────────────────────────

function Btn({
  children,
  variant = "primary",
  size = "md",
  disabled,
  onClick,
  type = "button",
}: {
  children: React.ReactNode;
  variant?: "primary" | "outline" | "ghost";
  size?: "sm" | "md";
  disabled?: boolean;
  onClick?: () => void;
  type?: "button" | "submit";
}) {
  const base =
    "inline-flex items-center justify-center gap-1.5 font-extrabold uppercase tracking-[.08em] transition-all duration-[120ms] border-[2.5px] cursor-pointer disabled:opacity-50 disabled:pointer-events-none rounded-full";
  const sizes = {
    sm: "text-[11px] px-3.5 h-[30px]",
    md: "text-[12px] px-5 h-[38px]",
  };
  const variants = {
    primary:
      "bg-tomato text-cream border-espresso shadow-[3px_3px_0_#1C0F05] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_#1C0F05] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none",
    outline:
      "bg-transparent text-espresso border-espresso shadow-[3px_3px_0_#1C0F05] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_#1C0F05] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none",
    ghost:
      "bg-transparent text-espresso border-transparent hover:bg-fog/50 shadow-none",
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

function FieldLabel({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <label
      htmlFor={htmlFor}
      className="block text-[10.5px] font-extrabold uppercase tracking-[.1em] text-espresso mb-1.5"
    >
      {children}
    </label>
  );
}

function MerninInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full bg-chalk border-[3px] border-espresso rounded-[10px] px-3.5 py-2.5 font-body text-[14px] text-espresso shadow-[3px_3px_0_#1C0F05] outline-none placeholder:text-muted-foreground focus:-translate-x-[1px] focus:-translate-y-[1px] focus:shadow-[4px_4px_0_#E8442A] focus:border-tomato transition-all duration-100 ${props.className ?? ""}`}
    />
  );
}

function Panel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-chalk border-[3px] border-espresso rounded-[16px] shadow-flat-md overflow-hidden">
      <div className="px-5 py-4 border-b-2 border-espresso bg-cream">
        <div className="font-extrabold text-sm uppercase tracking-[.08em] text-espresso">
          {title}
        </div>
        {subtitle && (
          <div className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</div>
        )}
      </div>
      <div className="px-5 py-5">{children}</div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export function RoastingSettingsClient({ initialSettings }: RoastingSettingsClientProps) {
  const [formData, setFormData] = useState({
    defaultChargeTemp: initialSettings?.default_charge_temp?.toString() || "",
    defaultRoastDurationMinutes:
      initialSettings?.default_roast_duration_minutes?.toString() || "",
    weightLossTarget: initialSettings?.weight_loss_target?.toString() || "",
  });
  const [roastProfiles, setRoastProfiles] = useState<string[]>(
    initialSettings?.default_roast_profiles || []
  );
  const [newProfile, setNewProfile] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  const handleAddProfile = () => {
    const trimmed = newProfile.trim();
    if (trimmed && !roastProfiles.includes(trimmed)) {
      setRoastProfiles([...roastProfiles, trimmed]);
      setNewProfile("");
    }
  };

  const handleRemoveProfile = (profile: string) => {
    setRoastProfiles(roastProfiles.filter((p) => p !== profile));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setIsSaved(false);
    const result = await saveRoastingSettings({
      defaultChargeTemp: formData.defaultChargeTemp
        ? parseFloat(formData.defaultChargeTemp)
        : undefined,
      defaultRoastDurationMinutes: formData.defaultRoastDurationMinutes
        ? parseFloat(formData.defaultRoastDurationMinutes)
        : undefined,
      defaultRoastProfiles: roastProfiles.length > 0 ? roastProfiles : undefined,
      weightLossTarget: formData.weightLossTarget
        ? parseFloat(formData.weightLossTarget)
        : undefined,
    });
    setIsSubmitting(false);
    if (result.error) {
      alert(result.error);
    } else {
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-[28px] md:text-[36px] font-extrabold uppercase tracking-tight leading-none text-espresso">
          Roasting Settings
        </h1>
        <p className="text-[13px] text-espresso/60 font-medium mt-1">
          Configure default values for your roasting sessions
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <Panel
          title="Default Values"
          subtitle="Pre-filled when creating new batches"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <FieldLabel htmlFor="defaultChargeTemp">Default Charge Temp (°F)</FieldLabel>
              <MerninInput
                id="defaultChargeTemp"
                type="number"
                value={formData.defaultChargeTemp}
                onChange={(e) =>
                  setFormData({ ...formData, defaultChargeTemp: e.target.value })
                }
                placeholder="e.g., 400"
              />
              <p className="mt-1.5 text-[11px] text-espresso/50 font-medium">
                Temperature when charging the roaster
              </p>
            </div>
            <div>
              <FieldLabel htmlFor="defaultRoastDurationMinutes">
                Default Duration (min)
              </FieldLabel>
              <MerninInput
                id="defaultRoastDurationMinutes"
                type="number"
                step="0.5"
                value={formData.defaultRoastDurationMinutes}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    defaultRoastDurationMinutes: e.target.value,
                  })
                }
                placeholder="e.g., 12"
              />
              <p className="mt-1.5 text-[11px] text-espresso/50 font-medium">
                Typical roast time in minutes
              </p>
            </div>
          </div>
          <div className="mt-4">
            <FieldLabel htmlFor="weightLossTarget">Target Weight Loss (%)</FieldLabel>
            <MerninInput
              id="weightLossTarget"
              type="number"
              step="0.1"
              value={formData.weightLossTarget}
              onChange={(e) =>
                setFormData({ ...formData, weightLossTarget: e.target.value })
              }
              placeholder="e.g., 15"
              className="max-w-[200px]"
            />
            <p className="mt-1.5 text-[11px] text-espresso/50 font-medium">
              Target % weight loss during roasting (typically 12–18%)
            </p>
          </div>
        </Panel>

        <Panel
          title="Roast Profiles"
          subtitle="Selectable profiles when creating batches"
        >
          <div className="flex items-center gap-2 mb-4">
            <MerninInput
              value={newProfile}
              onChange={(e) => setNewProfile(e.target.value)}
              placeholder='e.g., Light, Medium, Dark...'
              className="max-w-[260px]"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddProfile();
                }
              }}
            />
            <Btn
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddProfile}
              disabled={!newProfile.trim()}
            >
              <Plus className="h-3.5 w-3.5" />
              Add
            </Btn>
          </div>
          {roastProfiles.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {roastProfiles.map((profile) => (
                <span
                  key={profile}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border-[2px] border-espresso bg-cream text-[11px] font-extrabold uppercase tracking-[.08em] text-espresso"
                >
                  {profile}
                  <button
                    type="button"
                    onClick={() => handleRemoveProfile(profile)}
                    className="rounded-full hover:text-tomato transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <p className="text-[13px] text-espresso/50 font-medium">
              No profiles yet. Add profiles like &ldquo;Light&rdquo;, &ldquo;Medium&rdquo;,
              &ldquo;Dark&rdquo;, etc.
            </p>
          )}
        </Panel>

        <div className="flex items-center gap-3">
          <Btn type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : isSaved ? (
              <Check className="h-3.5 w-3.5" />
            ) : null}
            {isSubmitting ? "Saving..." : isSaved ? "Saved!" : "Save Settings"}
          </Btn>
        </div>
      </form>
    </div>
  );
}

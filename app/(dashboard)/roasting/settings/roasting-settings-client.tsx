"use client";

import React from "react"

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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

export function RoastingSettingsClient({
  initialSettings,
}: RoastingSettingsClientProps) {
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
    if (newProfile.trim() && !roastProfiles.includes(newProfile.trim())) {
      setRoastProfiles([...roastProfiles, newProfile.trim()]);
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
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Roasting Settings</h2>
        <p className="text-sm text-muted-foreground">
          Configure default values for your roasting sessions
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Default Values</CardTitle>
            <CardDescription>
              These values will be pre-filled when creating new batches
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="defaultChargeTemp">Default Charge Temp (F)</Label>
                <Input
                  id="defaultChargeTemp"
                  type="number"
                  value={formData.defaultChargeTemp}
                  onChange={(e) =>
                    setFormData({ ...formData, defaultChargeTemp: e.target.value })
                  }
                  placeholder="e.g., 400"
                />
                <p className="text-xs text-muted-foreground">
                  The temperature when charging the roaster
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="defaultRoastDurationMinutes">
                  Default Roast Duration (min)
                </Label>
                <Input
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
                <p className="text-xs text-muted-foreground">
                  Typical roast time in minutes
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="weightLossTarget">Target Weight Loss (%)</Label>
              <Input
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
              <p className="text-xs text-muted-foreground">
                Your target percentage of weight loss during roasting (typically
                12-18%)
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Roast Profiles</CardTitle>
            <CardDescription>
              Define roast profiles that can be selected when creating batches
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Input
                value={newProfile}
                onChange={(e) => setNewProfile(e.target.value)}
                placeholder="Enter profile name..."
                className="max-w-[300px]"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddProfile();
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleAddProfile}
                disabled={!newProfile.trim()}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add
              </Button>
            </div>
            {roastProfiles.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {roastProfiles.map((profile) => (
                  <Badge
                    key={profile}
                    variant="secondary"
                    className="flex items-center gap-1 px-3 py-1"
                  >
                    {profile}
                    <button
                      type="button"
                      onClick={() => handleRemoveProfile(profile)}
                      className="ml-1 rounded-full hover:bg-muted-foreground/20"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No profiles defined. Add profiles like &quot;Light&quot;, &quot;Medium&quot;,
                &quot;Dark&quot;, etc.
              </p>
            )}
          </CardContent>
        </Card>

        <div className="flex items-center gap-4">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : isSaved ? (
              <>
                <Check className="mr-2 h-4 w-4" />
                Saved
              </>
            ) : (
              "Save Settings"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

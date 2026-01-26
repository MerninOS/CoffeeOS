import { createClient } from "@/lib/supabase/server";
import { RoastingSettingsClient } from "./roasting-settings-client";

export default async function RoastingSettingsPage() {
  const supabase = await createClient();

  const { data: settings } = await supabase
    .from("roasting_settings")
    .select("*")
    .maybeSingle();

  return <RoastingSettingsClient initialSettings={settings} />;
}

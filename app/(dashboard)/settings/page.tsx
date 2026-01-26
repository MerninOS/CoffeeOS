import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SettingsClient } from "./settings-client";

export default async function SettingsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  // Get profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const isOwner = profile?.role === "owner" || user.user_metadata?.role === "owner";

  // Get Shopify settings if owner
  let shopifySettings = null;
  if (isOwner) {
    const { data } = await supabase
      .from("shopify_settings")
      .select("store_domain, access_token, client_id, client_secret")
      .eq("user_id", user.id)
      .single();
    shopifySettings = data ? {
      store_domain: data.store_domain,
      has_storefront_token: !!data.access_token,
      has_admin_credentials: !!data.client_id && !!data.client_secret,
    } : null;
  }

  return (
    <SettingsClient
      user={{
        email: user.email || "",
        firstName: profile?.first_name || user.user_metadata?.first_name || "",
        lastName: profile?.last_name || user.user_metadata?.last_name || "",
      }}
      isOwner={isOwner}
      shopifySettings={shopifySettings}
    />
  );
}

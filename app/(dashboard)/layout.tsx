import React from "react"
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/team";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Separator } from "@/components/ui/separator";
import { OnboardingTourWidget } from "@/components/onboarding-tour-widget";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  // Get profile data
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const role = profile?.role || user.user_metadata?.role || "owner";
  const canSeeOnboarding = role === "owner" || role === "admin";

  let onboardingStatus: {
    hasShopifyConnection: boolean;
    hasGreenCoffeeInventory: boolean;
    hasRoastingActivity: boolean;
    hasComponents: boolean;
    hasRoastedCoffeeComponent: boolean;
    hasProductCogs: boolean;
  } | null = null;

  if (canSeeOnboarding) {
    const { ownerId } = await getEffectiveOwnerId();

    if (ownerId) {
      const [
        shopifySettingsResult,
        inventoryCountResult,
        roastingCountResult,
        componentsCountResult,
        roastedComponentCountResult,
        productComponentsCountResult,
      ] = await Promise.all([
        supabase
          .from("shopify_settings")
          .select("connected_via_oauth, admin_access_token")
          .eq("user_id", ownerId)
          .maybeSingle(),
        supabase
          .from("green_coffee_inventory")
          .select("id", { count: "exact", head: true })
          .eq("user_id", ownerId),
        supabase
          .from("roasting_batches")
          .select("id", { count: "exact", head: true })
          .eq("user_id", ownerId),
        supabase
          .from("components")
          .select("id", { count: "exact", head: true })
          .eq("user_id", ownerId),
        supabase
          .from("components")
          .select("id", { count: "exact", head: true })
          .eq("user_id", ownerId)
          .eq("type", "ingredient")
          .or("name.ilike.%roasted coffee%,name.ilike.%roasted%,notes.ilike.%roasted%"),
        supabase.from("product_components").select("id", { count: "exact", head: true }),
      ]);

      onboardingStatus = {
        hasShopifyConnection: !!(
          shopifySettingsResult.data?.connected_via_oauth &&
          shopifySettingsResult.data?.admin_access_token
        ),
        hasGreenCoffeeInventory: (inventoryCountResult.count || 0) > 0,
        hasRoastingActivity: (roastingCountResult.count || 0) > 0,
        hasComponents: (componentsCountResult.count || 0) > 0,
        hasRoastedCoffeeComponent: (roastedComponentCountResult.count || 0) > 0,
        hasProductCogs: (productComponentsCountResult.count || 0) > 0,
      };
    }
  }

  const userData = {
    email: user.email || "",
    firstName: profile?.first_name || user.user_metadata?.first_name,
    lastName: profile?.last_name || user.user_metadata?.last_name,
    role: role as "owner" | "admin" | "roaster" | "employee",
  };

  return (
    <SidebarProvider>
      <AppSidebar user={userData} />
      <SidebarInset>
        <header className="flex h-12 shrink-0 items-center gap-2 border-b-[3px] border-espresso bg-cream px-4">
          <SidebarTrigger className="-ml-1 text-espresso hover:bg-fog/50" />
          <Separator orientation="vertical" className="mr-2 h-4 bg-fog" />
        </header>
        <main className="flex-1 overflow-auto bg-cream">{children}</main>
        {onboardingStatus ? (
          <OnboardingTourWidget userId={user.id} initialStatus={onboardingStatus} />
        ) : null}
      </SidebarInset>
    </SidebarProvider>
  );
}

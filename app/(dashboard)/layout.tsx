import React from "react"
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Separator } from "@/components/ui/separator";

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
         <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
        </header>
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}

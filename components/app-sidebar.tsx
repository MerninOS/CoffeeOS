"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  LayoutDashboard,
  Package,
  Layers,
  Flame,
  ShoppingCart,
  Settings,
  LogOut,
  Warehouse,
  Snowflake,
  Crown,
  ChevronUp,
} from "lucide-react";

type UserRole = "owner" | "admin" | "roaster" | "employee";

interface AppSidebarProps {
  user: {
    email: string;
    firstName?: string;
    lastName?: string;
    role: UserRole;
  };
}

const navigation: Array<{
  name: string;
  href: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  allowedRoles?: UserRole[];
}> = [
  {
    name: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    allowedRoles: ["owner", "admin"],
  },
  { name: "Products", href: "/products", icon: Package, allowedRoles: ["owner", "admin"] },
  { name: "Inventory", href: "/inventory", icon: Warehouse },
  { name: "Orders", href: "/orders", icon: ShoppingCart, allowedRoles: ["owner", "admin"] },
  { name: "Roasting", href: "/roasting", icon: Flame },
  { name: "Components", href: "/components", icon: Layers, allowedRoles: ["owner", "admin"] },
];

const apps: Array<{
  name: string;
  href: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  external?: boolean;
}> = [
  { name: "Soluble", href: "https://v0-new-chat-eight-topaz.vercel.app/auth/login", icon: Snowflake, external: true },
  { name: "CrowdRoast", href: "/settings", icon: Crown },
];

export function AppSidebar({ user }: AppSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { isMobile, setOpenMobile } = useSidebar();

  const closeMobile = () => { if (isMobile) setOpenMobile(false); };

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/auth/login");
    router.refresh();
  };

  const initials =
    user.firstName && user.lastName
      ? `${user.firstName[0]}${user.lastName[0]}`
      : user.email.substring(0, 2).toUpperCase();

  const displayName =
    user.firstName && user.lastName
      ? `${user.firstName} ${user.lastName}`
      : user.email;

  const visibleNav = navigation.filter(
    (item) => !item.allowedRoles || item.allowedRoles.includes(user.role)
  );
  const isOwnerOrAdmin = user.role === "owner" || user.role === "admin";

  return (
    <Sidebar className="border-r border-sidebar-border">
      {/* Header */}
      <SidebarHeader className="px-3.5 pt-5 pb-0">
        <Link
          href="/dashboard"
          onClick={closeMobile}
          className="flex items-center gap-2.5 px-2 pb-4 border-b border-sidebar-border mb-3.5"
        >
          {/* Icon */}
          <div className="w-[34px] h-[34px] rounded-[9px] border border-border overflow-hidden shrink-0 bg-secondary flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/icon.png"
              alt="CoffeeOS"
              width={34}
              height={34}
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          </div>
          <div>
            <div className="font-display text-[18px] leading-none font-semibold text-foreground">
              CoffeeOS
            </div>
            <div className="text-[9.5px] font-medium tracking-[.12em] uppercase text-muted-foreground mt-0.5">
              Roaster Admin
            </div>
          </div>
        </Link>

        {/* Main nav */}
        <SidebarMenu className="gap-1">
          {visibleNav.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <SidebarMenuItem key={item.name}>
                <Link
                  href={item.href}
                  onClick={closeMobile}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-[10px] transition-all duration-[120ms]"
                  style={
                    active
                      ? {
                          background: "var(--u-accent-subtle)",
                          color: "var(--u-accent)",
                          border: "1px solid transparent",
                          fontWeight: 500,
                          fontSize: "13px",
                        }
                      : {
                          background: "transparent",
                          color: "var(--u-text-muted)",
                          border: "1px solid transparent",
                          fontWeight: 500,
                          fontSize: "13px",
                        }
                  }
                >
                  <item.icon size={16} strokeWidth={2.2} />
                  <span className="flex-1">{item.name}</span>
                </Link>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="px-3.5 pt-4">
        {/* Settings */}
        {isOwnerOrAdmin && (
          <>
            <div
              className="text-[9.5px] font-semibold tracking-[.12em] uppercase px-2 mb-1.5"
              style={{ color: "var(--u-text-faint)" }}
            >
              Admin
            </div>
            <SidebarMenu className="gap-1 mb-4">
              <SidebarMenuItem>
                <Link
                  href="/settings"
                  onClick={closeMobile}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-[10px] transition-all duration-[120ms]"
                  style={
                    pathname === "/settings" || pathname.startsWith("/settings/")
                      ? {
                          background: "var(--u-accent-subtle)",
                          color: "var(--u-accent)",
                          border: "1px solid transparent",
                          fontWeight: 500,
                          fontSize: "13px",
                        }
                      : {
                          background: "transparent",
                          color: "var(--u-text-muted)",
                          border: "1px solid transparent",
                          fontWeight: 500,
                          fontSize: "13px",
                        }
                  }
                >
                  <Settings size={16} strokeWidth={2.2} />
                  <span className="flex-1">Settings</span>
                </Link>
              </SidebarMenuItem>
            </SidebarMenu>
          </>
        )}

        {/* Apps */}
        {isOwnerOrAdmin && (
          <>
            <div
              className="text-[9.5px] font-semibold tracking-[.12em] uppercase px-2 mb-1.5"
              style={{ color: "var(--u-text-faint)" }}
            >
              Apps
            </div>
            <SidebarMenu className="gap-1">
              {apps.map((app) => (
                <SidebarMenuItem key={app.name}>
                  <Link
                    href={app.href}
                    onClick={closeMobile}
                    target={app.external ? "_blank" : undefined}
                    rel={app.external ? "noopener noreferrer" : undefined}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-[10px] transition-all duration-[120ms]"
                    style={{
                      background: "transparent",
                      color: "var(--u-text-muted)",
                      border: "1px solid transparent",
                      fontWeight: 500,
                      fontSize: "13px",
                    }}
                  >
                    <app.icon size={16} strokeWidth={2.2} />
                    <span className="flex-1">{app.name}</span>
                  </Link>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </>
        )}
      </SidebarContent>

      {/* Footer: Shopify status + user */}
      <SidebarFooter className="px-3.5 pb-4 gap-3">
        {/* Shopify Connected widget */}
        <div
          className="rounded-[10px] p-3 text-[11px] leading-relaxed"
          style={{
            background: "var(--u-surface-2)",
            border: "1px solid var(--u-border)",
          }}
        >
          <div className="flex items-center gap-2 text-[12px] font-medium text-foreground mb-1">
            <span
              className="w-[7px] h-[7px] rounded-full shrink-0"
              style={{ background: "var(--u-success)" }}
            />
            Shopify connected
          </div>
          <div className="font-mono text-[11px] text-muted-foreground">
            {user.email.split("@")[0]}.myshopify.com
          </div>
        </div>

        {/* User dropdown */}
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-[10px] border border-border bg-transparent hover:bg-secondary transition-colors duration-100 text-left"
                >
                  <div
                    className="w-8 h-8 rounded-full border border-border bg-secondary flex items-center justify-center shrink-0 text-[12px] font-semibold text-muted-foreground"
                  >
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium text-foreground truncate">
                      {displayName}
                    </div>
                    <div className="text-[11px] capitalize text-muted-foreground">
                      {user.role}
                    </div>
                  </div>
                  <ChevronUp size={14} strokeWidth={2} className="text-muted-foreground shrink-0" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" className="w-[--radix-dropdown-menu-trigger-width]">
                <DropdownMenuItem asChild>
                  <Link href="/settings" onClick={closeMobile} className="cursor-pointer">
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleSignOut}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

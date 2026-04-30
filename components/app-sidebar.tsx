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
    <Sidebar
      className="border-r-0"
      style={
        {
          "--sidebar": "#1C0F05",
          "--sidebar-foreground": "#F5F0D8",
          "--sidebar-border": "#1C0F05",
          "--sidebar-accent": "#2a1508",
          "--sidebar-accent-foreground": "#F5F0D8",
        } as React.CSSProperties
      }
    >
      {/* Header */}
      <SidebarHeader className="px-3.5 pt-5 pb-0">
        <Link
          href="/dashboard"
          onClick={closeMobile}
          className="flex items-center gap-2.5 px-2 pb-4 border-b-2 border-roast mb-3.5"
        >
          {/* Icon */}
          <div className="w-[34px] h-[34px] rounded-[8px] border-2 border-cream overflow-hidden shrink-0 bg-roast flex items-center justify-center">
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
            <div className="font-display text-[20px] leading-none uppercase text-cream">
              CoffeeOS
            </div>
            <div
              className="text-[9.5px] font-bold tracking-[.12em] uppercase text-cream mt-0.5"
              style={{ opacity: 0.6 }}
            >
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
                  className="flex items-center gap-3 px-3 py-2.5 rounded-[12px] transition-all duration-[120ms] text-cream"
                  style={
                    active
                      ? {
                          background: "#E8442A",
                          border: "2.5px solid #F5F0D8",
                          boxShadow: "3px 3px 0 #F5F0D8",
                          fontWeight: 800,
                          fontSize: "12.5px",
                          letterSpacing: ".08em",
                          textTransform: "uppercase",
                        }
                      : {
                          background: "transparent",
                          border: "2.5px solid transparent",
                          fontWeight: 800,
                          fontSize: "12.5px",
                          letterSpacing: ".08em",
                          textTransform: "uppercase",
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
              className="text-[9.5px] font-extrabold tracking-[.12em] uppercase px-2 mb-1.5"
              style={{ color: "rgba(245,240,216,0.45)" }}
            >
              Admin
            </div>
            <SidebarMenu className="gap-1 mb-4">
              <SidebarMenuItem>
                <Link
                  href="/settings"
                  onClick={closeMobile}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-[12px] transition-all duration-[120ms] text-cream"
                  style={
                    pathname === "/settings" || pathname.startsWith("/settings/")
                      ? {
                          background: "#E8442A",
                          border: "2.5px solid #F5F0D8",
                          boxShadow: "3px 3px 0 #F5F0D8",
                          fontWeight: 800,
                          fontSize: "12.5px",
                          letterSpacing: ".08em",
                          textTransform: "uppercase",
                        }
                      : {
                          background: "transparent",
                          border: "2.5px solid transparent",
                          fontWeight: 800,
                          fontSize: "12.5px",
                          letterSpacing: ".08em",
                          textTransform: "uppercase",
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
              className="text-[9.5px] font-extrabold tracking-[.12em] uppercase px-2 mb-1.5"
              style={{ color: "rgba(245,240,216,0.45)" }}
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
                    className="flex items-center gap-3 px-3 py-2.5 rounded-[12px] transition-all duration-[120ms] text-cream"
                    style={{
                      background: "transparent",
                      border: "2.5px solid transparent",
                      fontWeight: 800,
                      fontSize: "12.5px",
                      letterSpacing: ".08em",
                      textTransform: "uppercase",
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
          className="rounded-[12px] p-3 text-[11px] leading-relaxed"
          style={{
            background: "#3B1F0A",
            border: "2px solid #E8442A",
          }}
        >
          <div
            className="font-display text-[14px] uppercase mb-1"
            style={{ color: "#F5C842" }}
          >
            Shopify Connected
          </div>
          <div className="text-cream" style={{ opacity: 0.75 }}>
            {user.email.split("@")[0]}.myshopify.com
          </div>
        </div>

        {/* User dropdown */}
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-[12px] border-[2.5px] border-roast hover:border-cream/30 transition-all duration-100 text-left"
                  style={{ background: "#2a1508" }}
                >
                  <div
                    className="w-8 h-8 rounded-[8px] border-2 border-roast flex items-center justify-center shrink-0 text-[12px] font-extrabold text-cream"
                    style={{ background: "#E8442A" }}
                  >
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12.5px] font-bold text-cream truncate">
                      {displayName}
                    </div>
                    <div
                      className="text-[10px] tracking-[.08em] uppercase font-bold capitalize"
                      style={{ color: "rgba(245,240,216,0.6)" }}
                    >
                      {user.role}
                    </div>
                  </div>
                  <ChevronUp size={14} strokeWidth={2.2} className="text-cream/40 shrink-0" />
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

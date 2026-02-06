"use client";

import React from "react"

import Image from "next/image"
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Coffee,
  LayoutDashboard,
  Package,
  Layers,
  Flame,
  ShoppingCart,
  Settings,
  LogOut,
  ChevronUp,
  Crown,
  Snowflake,
  Warehouse,
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

// Roles that can see each nav item. If not specified, all roles can see it.
const navigation: Array<{
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  allowedRoles?: UserRole[];
}> = [
  {
    name: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    allowedRoles: ["owner", "admin"],
  },
  {
    name: "Products",
    href: "/products",
    icon: Package,
    allowedRoles: ["owner", "admin"],
  },
  {
    name: "Inventory",
    href: "/inventory",
    icon: Warehouse,
    // All roles can access inventory
  },
  {
    name: "Orders",
    href: "/orders",
    icon: ShoppingCart,
    allowedRoles: ["owner", "admin"],
  },
  {
    name: "Roasting",
    href: "/roasting",
    icon: Flame,
    // All roles can access roasting
  },
  {
    name: "Components",
    href: "/components",
    icon: Layers,
    allowedRoles: ["owner", "admin"],
  },
];

export function AppSidebar({ user }: AppSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

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

  return (
    <Sidebar className="border-primary-foreground">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/dashboard">
                <div className="flex flex-col gap-0.5 leading-none">
                <Image alt={"coffee os logo"} width={200} height={100} src="/coffee_os_logo.png" />
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground">Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigation
                .filter((item) => !item.allowedRoles || item.allowedRoles.includes(user.role))
                .map((item) => (
                <SidebarMenuItem key={item.name}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.href || pathname.startsWith(`${item.href}/`)}
                  >
                    <Link href={item.href}>
                      <item.icon className="h-4 w-4 text-sidebar-foreground" />
                      <span className="text-sidebar-foreground">{item.name}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {(user.role === "owner" || user.role === "admin") && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-sidebar-foreground">Admin</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === "/settings" || pathname.startsWith("/settings/")}
                  >
                    <Link href="/settings">
                      <Settings className="h-4 w-4 text-sidebar-foreground" />
                      <span className="text-foreground">Settings</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
        {(user.role === "owner" || user.role === "admin") && (
        <SidebarGroup>
            <SidebarGroupLabel className="text-sidebar-foreground">Apps</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                  >
                    <Link href="https://v0-new-chat-eight-topaz.vercel.app/auth/login" target="_blank">
                      <Snowflake className="h-4 w-4 text-sidebar-foreground" />
                      <span className="text-foreground">Soluble</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                  >
                    <Link href="/settings">
                      <Crown className="h-4 w-4 text-sidebar-foreground" />
                      <span className="text-foreground">CrowdRoast</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-xs">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">
                      {user.firstName && user.lastName
                        ? `${user.firstName} ${user.lastName}`
                        : user.email}
                    </span>
                    <span className="truncate text-xs text-sidebar-foreground/70 capitalize">
                      {user.role}
                    </span>
                  </div>
                  <ChevronUp className="ml-auto h-4 w-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="top"
                className="w-(--radix-dropdown-menu-trigger-width)"
              >
                <DropdownMenuItem asChild>
                  <Link href="/settings" className="cursor-pointer">
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

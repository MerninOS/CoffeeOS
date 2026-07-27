"use client";

/**
 * The dashboard chrome, on the instrument design system.
 *
 * WHY THIS FILE EXISTS AT ALL: `app/(dashboard)/layout.tsx` is a server
 * component (it awaits Supabase for the user, profile, role and onboarding
 * status). `AppShell` needs `onNavigate` / `onToggleCollapse` — functions — and
 * a server component cannot hand a function to a client component ("Functions
 * cannot be passed directly to Client Components"). Worse, the whole
 * `@merninos/ui/instrument` barrel is marked `'use client'` because esbuild
 * drops per-module directives when bundling, so *every* instrument component is
 * across that boundary. This wrapper is where the callbacks are created, so the
 * layout only ever passes serializable props.
 *
 * Design-system rule: instrument values are read as `var(--token)` through
 * inline styles, never through Tailwind classes — the Tailwind theme is the
 * loud Mernin' palette and would silently resolve to the wrong thing.
 */

import React from "react";
import { usePathname, useRouter } from "next/navigation";
import { AppShell, Button, type NavGroup } from "@merninos/ui/instrument";
import { createClient } from "@/lib/supabase/client";
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
} from "lucide-react";

type UserRole = "owner" | "admin" | "roaster" | "employee";

interface InstrumentShellProps {
  /** Must stay serializable — it crosses the server/client boundary. */
  user: {
    email: string;
    firstName?: string;
    lastName?: string;
    role: UserRole;
  };
  children: React.ReactNode;
}

/** 1.5px stroke is the design system's icon weight (lucide defaults to 2). */
const icon = (
  Icon: React.ComponentType<{ size?: number; strokeWidth?: number }>
): React.ReactElement => <Icon size={18} strokeWidth={1.5} />;

/**
 * Ported verbatim from components/app-sidebar.tsx — same order, same hrefs, and
 * critically the same `allowedRoles`. An item with no `allowedRoles` is visible
 * to every role; anything else is visible only to the roles listed. Getting this
 * wrong is a privilege bug, not a cosmetic one.
 */
const NAVIGATION: Array<{
  id: string;
  label: string;
  icon: React.ReactElement;
  allowedRoles?: UserRole[];
}> = [
  { id: "/dashboard", label: "Dashboard", icon: icon(LayoutDashboard), allowedRoles: ["owner", "admin"] },
  { id: "/products", label: "Products", icon: icon(Package), allowedRoles: ["owner", "admin"] },
  { id: "/inventory", label: "Inventory", icon: icon(Warehouse) },
  { id: "/orders", label: "Orders", icon: icon(ShoppingCart), allowedRoles: ["owner", "admin"] },
  { id: "/roasting", label: "Roasting", icon: icon(Flame) },
  { id: "/components", label: "Components", icon: icon(Layers), allowedRoles: ["owner", "admin"] },
];

/**
 * The Apps list. Ids are deliberately NOT route paths: CrowdRoast points at
 * /settings, and reusing "/settings" as its id would make it light up as the
 * active item whenever Settings is — which the old sidebar never did (Apps
 * entries were rendered with a fixed, always-inactive style). Keeping them
 * opaque preserves that exactly.
 */
const APPS: Array<{
  id: string;
  label: string;
  icon: React.ReactElement;
  href: string;
  external?: boolean;
}> = [
  {
    id: "app:soluble",
    label: "Soluble",
    icon: icon(Snowflake),
    href: "https://v0-new-chat-eight-topaz.vercel.app/auth/login",
    external: true,
  },
  { id: "app:crowdroast", label: "CrowdRoast", icon: icon(Crown), href: "/settings" },
];

const SETTINGS_ID = "/settings";

/** Same predicate the old sidebar used: `pathname === href || pathname.startsWith(href + "/")`. */
function isActivePath(pathname: string, path: string) {
  return pathname === path || pathname.startsWith(`${path}/`);
}

/** Label lookup for breadcrumbs, so "/roasting" reads "Roasting" not "roasting". */
const SECTION_LABELS: Record<string, string> = {
  ...Object.fromEntries(NAVIGATION.map((n) => [n.id.slice(1), n.label])),
  settings: "Settings",
};

function titleCase(segment: string) {
  return segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, " ");
}

/**
 * Breadcrumbs straight off the pathname: first segment via the nav label,
 * remaining segments title-cased. Record ids (e.g. /orders/8f2c…) are left as
 * they are rather than mangled into prose. Deliberately dumb — a per-route
 * breadcrumb registry is a later phase's problem.
 */
function buildBreadcrumbs(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return [{ label: "CoffeeOS" }];

  return segments.map((segment, i) => {
    if (i === 0) return { label: SECTION_LABELS[segment] ?? titleCase(segment) };
    // Looks like an id (uuid / numeric / mixed) — show it verbatim.
    if (/\d/.test(segment)) return { label: segment };
    return { label: titleCase(segment) };
  });
}

export function InstrumentShell({ user, children }: InstrumentShellProps) {
  const pathname = usePathname() || "/";
  const router = useRouter();
  const [collapsed, setCollapsed] = React.useState(false);

  const isOwnerOrAdmin = user.role === "owner" || user.role === "admin";

  const visibleNav = NAVIGATION.filter(
    (item) => !item.allowedRoles || item.allowedRoles.includes(user.role)
  );

  const nav: NavGroup[] = [
    { items: visibleNav.map(({ id, label, icon: i }) => ({ id, label, icon: i })) },
    ...(isOwnerOrAdmin
      ? [
          { group: "Admin", items: [{ id: SETTINGS_ID, label: "Settings", icon: icon(Settings) }] },
          { group: "Apps", items: APPS.map(({ id, label, icon: i }) => ({ id, label, icon: i })) },
        ]
      : []),
  ];

  // Only real routes participate in the active state; Apps ids never match.
  const activeId = [...visibleNav.map((i) => i.id), ...(isOwnerOrAdmin ? [SETTINGS_ID] : [])].find(
    (id) => isActivePath(pathname, id)
  );

  const handleNavigate = (id: string) => {
    const app = APPS.find((a) => a.id === id);
    if (app) {
      if (app.external) {
        window.open(app.href, "_blank", "noopener,noreferrer");
      } else {
        router.push(app.href);
      }
      return;
    }
    router.push(id);
  };

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/auth/login");
    router.refresh();
  };

  const displayName =
    user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.email;

  return (
    <AppShell
      product="CoffeeOS"
      nav={nav}
      activeId={activeId}
      onNavigate={handleNavigate}
      breadcrumbs={buildBreadcrumbs(pathname)}
      collapsed={collapsed}
      onToggleCollapse={() => setCollapsed((c) => !c)}
      actions={
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", lineHeight: 1.2, minWidth: 0 }}>
            <span
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "var(--fs-label)",
                fontWeight: "var(--fw-medium)" as unknown as number,
                color: "var(--ink)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                maxWidth: 220,
              }}
            >
              {displayName}
            </span>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontVariationSettings: "var(--overline-settings)",
                fontWeight: "var(--overline-weight)" as unknown as number,
                textTransform: "uppercase",
                letterSpacing: "var(--overline-tracking)",
                fontSize: "var(--fs-overline)",
                color: "var(--ink-subtle)",
              }}
            >
              {user.role}
            </span>
          </div>
          <Button
            size="sm"
            variant="tertiary"
            onClick={handleSignOut}
            iconLeft={<LogOut />}
          >
            Sign out
          </Button>
        </div>
      }
    >
      {children}
    </AppShell>
  );
}

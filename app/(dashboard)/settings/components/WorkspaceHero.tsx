"use client";

import { Button, HeroMetric, StatStrip } from "@merninos/ui/instrument";
import { RefreshCw } from "lucide-react";
import { workspaceStatus } from "@/lib/settings/status";
import type { ShopifySettings } from "./types";

/**
 * The one question /settings exists to answer: can this workspace trade?
 *
 * The loud page answered it in two small pills inside the third of three
 * identical bordered cards, while `billing_status !== 'ACTIVE'` makes the whole
 * app read-only — there is a forced redirect in settings-client.tsx that exists
 * because of it. Here it is the hero, and the blocked state is the only red on
 * the page.
 *
 * Red is the live register, so it is used at hero scale and NOT as a button
 * fill: the action that clears it is ink. That is the design system's rule, and
 * also the honest hierarchy — the figure is the alarm, the button is just the
 * way out.
 *
 * The status comes from lib/settings/status.ts. This component never reads
 * connected_via_oauth, has_admin_credentials or billing_status itself;
 * tests/unit/settings-tokens.spec.ts fails the build if it does.
 */
export function WorkspaceHero({
  shopifySettings,
  canManage,
  members,
  invited,
}: {
  shopifySettings: ShopifySettings | null;
  canManage: boolean;
  members: number;
  invited: number;
}) {
  const status = workspaceStatus(shopifySettings);
  const connected = status.tone !== "idle";
  const billed = status.tone === "live";

  const note = canManage
    ? {
        idle: "Connect a Shopify store below to sync products and orders. Nothing syncs until you do.",
        blocked:
          "Your store is connected but the app plan is not active — CoffeeOS stays read-only until billing is approved in Shopify.",
        live: shopifySettings?.shop_name
          ? `Products and orders are syncing from ${shopifySettings.shop_name.replace(/\.+$/, "")}.`
          : "Products and orders are syncing.",
      }[status.tone]
    : {
        idle: "No Shopify store is connected, so nothing is syncing. Your workspace owner can connect one.",
        blocked:
          "The app plan is not active, so CoffeeOS is read-only. Your workspace owner can approve it in Shopify.",
        live: "Products and orders are syncing.",
      }[status.tone];

  /* Only cells that have a value — a strip of "—" placeholders is four columns
     of nothing wearing the same weight as the figures that matter. */
  const stats = [
    ...(billed
      ? [
          { label: "Plan", value: shopifySettings?.billing_plan_name ?? "—" },
          {
            label: "Renews",
            value: shopifySettings?.billing_current_period_end
              ? new Date(shopifySettings.billing_current_period_end).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })
              : "—",
          },
        ]
      : []),
    ...(connected
      ? [{ label: "Scopes", value: (shopifySettings?.oauth_scope ?? "").split(",").filter(Boolean).length }]
      : []),
    { label: "Members", value: members },
    { label: "Invited", value: invited },
  ];

  return (
    <>
      <HeroMetric
        label="Workspace"
        value={
          <span style={{ color: status.tone === "blocked" ? "var(--brand)" : "var(--ink)" }}>
            {status.label}
          </span>
        }
        note={note}
      />

      {/* The single action that clears the hero's own failure. Not repeated in
          the Shopify section below — actions live where their state lives. */}
      {status.tone === "blocked" && canManage && (
        <div style={{ marginTop: 16 }}>
          <Button iconLeft={<RefreshCw />}>Refresh billing status</Button>
        </div>
      )}

      {/* Owner/admin figures only. Every cell is workspace information a roaster
          has no section for, and leaking a member count to a role with no team
          list is the gap criterion 18 asserts against. */}
      {canManage && (
        <div style={{ marginTop: 22, overflowX: "auto", paddingBottom: 2 }}>
          {/* StatStrip is a row of flex:1 cells with no wrap of its own; below
              this width it crushes each label to about three characters, so it
              scrolls instead. */}
          <StatStrip stats={stats} style={{ minWidth: 760 }} />
        </div>
      )}
    </>
  );
}

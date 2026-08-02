"use client";

import React from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { sans } from "@/lib/instrument/tokens";
import { TabLinks } from "./components/TabLinks";

/**
 * The roasting shell.
 *
 * The tab bar stays HERE rather than moving into the page client: this layout
 * wraps every roasting route, and it already mixed `?tab=` view switches with a
 * real route link (Batches). Keeping all four together means /roasting/batches
 * and /roasting/settings keep their chrome while their bodies convert in later
 * stages.
 *
 * Tailwind survives for layout only — flex, padding, gap. Every colour, border,
 * radius, shadow and type value is read as `var(--token)`, because this repo's
 * Tailwind theme is the LOUD Mernin' palette and its utilities resolve to the
 * wrong design system.
 */
export default function RoastingLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab");
  const onIndex = pathname === "/roasting";

  /**
   * `/roasting` now lands on Queue rather than Sessions — the one intentional
   * behaviour change in this stage, recorded in design.md. `?tab=requests` still
   * resolves to Queue so existing links and the Stage A baseline stay valid.
   */
  const tabs = [
    {
      label: "Queue",
      href: "/roasting?tab=requests",
      active: onIndex && (tab === "requests" || tab === null),
    },
    { label: "Sessions", href: "/roasting?tab=sessions", active: onIndex && tab === "sessions" },
    { label: "Roasted stock", href: "/roasting?tab=stock", active: onIndex && tab === "stock" },
    { label: "Batches", href: "/roasting/batches", active: pathname.startsWith("/roasting/batches") },
  ];

  return (
    <div className="flex flex-col min-h-full">
      <div className="px-6 pt-6 space-y-4">
        <div>
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontVariationSettings: "var(--display-settings)",
              fontWeight: "var(--display-weight)" as unknown as number,
              letterSpacing: "var(--display-tracking)",
              fontSize: "var(--fs-display)",
              textTransform: "uppercase",
              color: "var(--ink)",
              margin: 0,
            }}
          >
            Roasting
          </h1>
          <p style={{ ...sans, color: "var(--ink-muted)", marginTop: 6 }}>
            What the roast queue costs, and what it yields.
          </p>
        </div>

        <TabLinks tabs={tabs} />
      </div>

      {children}
    </div>
  );
}

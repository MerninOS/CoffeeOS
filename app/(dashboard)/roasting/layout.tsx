"use client";

import React from "react"

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const tabs = [
  { name: "Sessions", href: "/roasting" },
  { name: "Batches", href: "/roasting/batches" },
];

export default function RoastingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const isActiveTab = (href: string) => {
    if (href === "/roasting") {
      return pathname === "/roasting" || pathname.startsWith("/roasting/sessions");
    }
    return pathname.startsWith(href);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="min-w-0">
          <h1 className="text-xl font-bold md:text-2xl">Roasting</h1>
          <p className="text-sm text-muted-foreground md:text-base">
            Manage roasting sessions, batches, and roast requests.
          </p>
        </div>
      <div className="border-b">
        <nav className="-mb-px flex gap-4">
          {tabs.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "border-b-2 px-1 pb-3 text-sm font-medium transition-colors",
                isActiveTab(tab.href)
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:border-muted-foreground/30 hover:text-foreground"
              )}
            >
              {tab.name}
            </Link>
          ))}
        </nav>
      </div>

      {children}
    </div>
  );
}

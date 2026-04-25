"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Flame, ClipboardList, Package } from "lucide-react";

export default function RoastingLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab");

  const tabs = [
    {
      name: "Sessions",
      href: "/roasting",
      Icon: Flame,
      active: pathname === "/roasting" && tab !== "requests",
    },
    {
      name: "Requests",
      href: "/roasting?tab=requests",
      Icon: ClipboardList,
      active: pathname === "/roasting" && tab === "requests",
    },
    {
      name: "Batches",
      href: "/roasting/batches",
      Icon: Package,
      active: pathname.startsWith("/roasting/batches"),
    },
  ];

  return (
    <div className="flex flex-col min-h-full">
      <div className="px-6 pt-6 space-y-4">
        <div>
          <h1 className="text-[28px] md:text-[36px] font-extrabold uppercase tracking-tight leading-none text-espresso">
            Roasting
          </h1>
          <p className="text-[13px] text-espresso/60 font-medium mt-1">
            Track sessions, batches, and roast requests
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          {tabs.map(({ name, href, Icon, active }) => (
            <Link
              key={name}
              href={href}
              className={`inline-flex items-center gap-1 sm:gap-2 px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-[8px] sm:rounded-[10px] border-2 sm:border-[2.5px] font-extrabold text-[10px] sm:text-[12px] uppercase tracking-[.06em] sm:tracking-[.08em] transition-all duration-[120ms] cursor-pointer select-none whitespace-nowrap ${
                active
                  ? "bg-tomato text-cream border-espresso shadow-[2px_2px_0_#1C0F05] sm:shadow-[3px_3px_0_#1C0F05]"
                  : "bg-transparent text-espresso border-espresso hover:bg-fog/40"
              }`}
            >
              <Icon size={11} strokeWidth={2.2} className="sm:hidden" />
              <Icon size={13} strokeWidth={2.2} className="hidden sm:block" />
              {name}
            </Link>
          ))}
        </div>

        <div className="border-b-[2px] border-dashed border-fog" />
      </div>

      {children}
    </div>
  );
}

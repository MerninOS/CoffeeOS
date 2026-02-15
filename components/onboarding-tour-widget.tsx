"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CheckCircle2, Circle, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface OnboardingStatus {
  hasShopifyConnection: boolean;
  hasGreenCoffeeInventory: boolean;
  hasRoastingActivity: boolean;
  hasComponents: boolean;
  hasRoastedCoffeeComponent: boolean;
  hasProductCogs: boolean;
}

interface OnboardingTourWidgetProps {
  userId: string;
  initialStatus: OnboardingStatus;
}

interface TourStep {
  id: string;
  title: string;
  description: string;
  href: string;
  completed: boolean;
}

export function OnboardingTourWidget({ userId, initialStatus }: OnboardingTourWidgetProps) {
  const pathname = usePathname();
  const [status, setStatus] = useState(initialStatus);
  const [expanded, setExpanded] = useState(true);
  const [hidden, setHidden] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  const hiddenKey = `coffeeos:onboarding:${userId}:hidden`;
  const expandedKey = `coffeeos:onboarding:${userId}:expanded`;

  const steps: TourStep[] = useMemo(
    () => [
      {
        id: "shopify",
        title: "Connect your Shopify store",
        description: "Authorize Shopify so CoffeeOS can sync products and orders.",
        href: "/settings",
        completed: status.hasShopifyConnection,
      },
      {
        id: "inventory",
        title: "Add green coffee inventory",
        description: "Create your first lot in inventory with cost and quantity.",
        href: "/inventory",
        completed: status.hasGreenCoffeeInventory,
      },
      {
        id: "roasting",
        title: "Roast coffee",
        description: "Record at least one roasting batch to build roasted stock.",
        href: "/roasting",
        completed: status.hasRoastingActivity,
      },
      {
        id: "components",
        title: "Add cost components",
        description: "Create ingredient, labor, or packaging components.",
        href: "/components",
        completed: status.hasComponents,
      },
      {
        id: "roasted-component",
        title: "Add roasted coffee as a cost component",
        description: "Create an ingredient component named like \"Roasted Coffee\".",
        href: "/components",
        completed: status.hasRoastedCoffeeComponent,
      },
      {
        id: "cogs",
        title: "Calculate COGS for products",
        description: "Assign components to at least one product.",
        href: "/products",
        completed: status.hasProductCogs,
      },
    ],
    [status]
  );

  const completedCount = steps.filter((step) => step.completed).length;
  const progress = Math.round((completedCount / steps.length) * 100);
  const nextStep = steps.find((step) => !step.completed);
  const allComplete = completedCount === steps.length;

  useEffect(() => {
    setIsHydrated(true);
    const storedHidden = window.localStorage.getItem(hiddenKey) === "true";
    const storedExpanded = window.localStorage.getItem(expandedKey);
    setHidden(storedHidden);
    if (storedExpanded !== null) {
      setExpanded(storedExpanded === "true");
    }
  }, [expandedKey, hiddenKey]);

  useEffect(() => {
    let isActive = true;

    const refreshStatus = async () => {
      try {
        const response = await fetch("/api/onboarding/status", { cache: "no-store" });
        if (!response.ok) return;
        const data = (await response.json()) as { status?: OnboardingStatus };
        if (isActive && data.status) {
          setStatus(data.status);
        }
      } catch {
        // Keep existing status when polling fails.
      }
    };

    refreshStatus();
    const interval = window.setInterval(refreshStatus, 10000);

    return () => {
      isActive = false;
      window.clearInterval(interval);
    };
  }, []);

  const handleHide = () => {
    setHidden(true);
    if (!isHydrated) return;
    window.localStorage.setItem(hiddenKey, "true");
  };

  const handleShow = () => {
    setHidden(false);
    if (!isHydrated) return;
    window.localStorage.setItem(hiddenKey, "false");
  };

  const handleToggleExpanded = () => {
    setExpanded((prev) => {
      const next = !prev;
      if (isHydrated) {
        window.localStorage.setItem(expandedKey, String(next));
      }
      return next;
    });
  };

  if (hidden) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Button onClick={handleShow} size="sm" className="shadow-lg">
          Show Onboarding
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-[350px] max-w-[calc(100vw-2rem)]">
      <Card className="shadow-xl border-primary-foreground">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4 text-primary" />
                Onboarding Tour
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                {completedCount}/{steps.length} complete • {progress}%
              </p>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleToggleExpanded}>
                <span className="text-xs">{expanded ? "−" : "+"}</span>
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleHide}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="h-2 w-full rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
          </div>
        </CardHeader>

        {expanded ? (
          <CardContent className="space-y-2">
            {steps.map((step) => {
              const isCurrentRoute = pathname === step.href || pathname.startsWith(`${step.href}/`);

              return (
                <div key={step.id} className="rounded-lg border p-2.5">
                  <div className="flex items-start gap-2">
                    {step.completed ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                    ) : (
                      <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium leading-5">{step.title}</p>
                      <p className="text-xs text-muted-foreground">{step.description}</p>
                      {isCurrentRoute && !step.completed ? (
                        <p className="mt-1 text-[11px] font-medium text-primary">You are on this step.</p>
                      ) : null}
                    </div>
                    {!isCurrentRoute ? (
                      <Button asChild variant="outline" size="sm" className="h-7 px-2 text-xs">
                        <Link href={step.href}>Go</Link>
                      </Button>
                    ) : null}
                  </div>
                </div>
              );
            })}

            {allComplete ? (
              <p className="pt-1 text-xs font-medium text-green-700">All onboarding tasks are complete.</p>
            ) : nextStep ? (
              <p className="pt-1 text-xs text-muted-foreground">
                Next recommended step: <span className="font-medium text-foreground">{nextStep.title}</span>
              </p>
            ) : null}
          </CardContent>
        ) : null}
      </Card>
    </div>
  );
}

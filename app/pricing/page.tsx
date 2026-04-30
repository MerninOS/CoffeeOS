import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "@merninos/ui";

export const metadata: Metadata = {
  title: "Pricing | CoffeeOS",
  description: "Simple pricing for CoffeeOS.",
};

const plans = [
  {
    name: "Starter",
    price: "$49",
    cadence: "/month",
    description: "For early-stage roasters getting organized.",
    cta: "Start free",
    href: "/auth/sign-up",
    featured: false,
    features: ["Up to 2 team members", "Core inventory tracking", "Basic roasting workflows"],
  },
  {
    name: "Growth",
    price: "$129",
    cadence: "/month",
    description: "For growing brands with regular production volume.",
    cta: "Choose Growth",
    href: "/auth/sign-up",
    featured: true,
    features: [
      "Up to 10 team members",
      "Order, product, and component management",
      "Shopify sync",
      "Priority support",
    ],
  },
  {
    name: "Scale",
    price: "Custom",
    cadence: "",
    description: "For multi-site teams and advanced operational needs.",
    cta: "Contact sales",
    href: "/auth/login",
    featured: false,
    features: ["Unlimited team members", "Advanced controls and onboarding", "Dedicated success support"],
  },
];

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="relative overflow-hidden border-b">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(255,49,49,0.18),transparent_35%),radial-gradient(circle_at_90%_0%,rgba(255,49,49,0.12),transparent_30%)]" />
        <div className="relative mx-auto flex max-w-6xl flex-col gap-10 px-6 py-10 md:py-14">
          <header className="flex items-center justify-between">
            <Link href="/" className="inline-flex items-center gap-3">
              <Image alt="CoffeeOS logo" src="/coffee_os_logo.png" width={170} height={68} priority />
            </Link>
            <nav className="flex items-center gap-5 text-sm">
              <Link className="hover:text-primary" href="/">
                Home
              </Link>
              <Link className="hover:text-primary" href="/privacy-policy">
                Privacy
              </Link>
              <Button asChild size="sm">
                <Link href="/auth/login">Sign in</Link>
              </Button>
            </nav>
          </header>

          <div className="space-y-4 text-center">
            <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">Pricing that scales with your team</h1>
            <p className="mx-auto max-w-2xl text-base leading-7 text-muted-foreground">
              Start with the essentials, then upgrade when your production and fulfillment workflows
              get more complex.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid gap-5 lg:grid-cols-3">
          {plans.map((plan) => (
            <article
              key={plan.name}
              className={`rounded-2xl border p-6 ${plan.featured ? "border-primary bg-card shadow-sm" : "bg-card"}`}
            >
              <p className="text-sm font-medium text-muted-foreground">{plan.name}</p>
              <div className="mt-2 flex items-end gap-1">
                <span className="text-3xl font-semibold">{plan.price}</span>
                {plan.cadence ? <span className="pb-1 text-sm text-muted-foreground">{plan.cadence}</span> : null}
              </div>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{plan.description}</p>

              <Button asChild className="mt-5 w-full" variant={plan.featured ? "default" : "outline"}>
                <Link href={plan.href}>{plan.cta}</Link>
              </Button>

              <ul className="mt-5 space-y-2 text-sm">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-muted-foreground">
                    <Check className="mt-0.5 h-4 w-4 text-primary" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

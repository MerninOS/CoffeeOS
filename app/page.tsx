import { redirect } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="relative overflow-hidden border-b">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,49,49,0.18),transparent_40%),radial-gradient(circle_at_80%_0%,rgba(255,49,49,0.12),transparent_35%)]" />
        <div className="relative mx-auto flex max-w-6xl flex-col gap-10 px-6 py-10 md:py-14">
          <header className="flex items-center justify-between">
            <Link href="/" className="inline-flex items-center gap-3">
              <Image alt="CoffeeOS logo" src="/coffee_os_logo.png" width={170} height={68} priority />
            </Link>
            <nav className="flex items-center gap-5 text-sm">
              <Link className="hover:text-primary" href="/pricing">
                Pricing
              </Link>
              <Link className="hover:text-primary" href="/privacy-policy">
                Privacy
              </Link>
              <Button asChild size="sm">
                <Link href="/auth/login">Sign in</Link>
              </Button>
            </nav>
          </header>

          <div className="grid gap-8 md:grid-cols-2 md:items-center">
            <div className="space-y-6">
              <p className="inline-flex rounded-full border bg-background/80 px-3 py-1 text-xs font-medium text-muted-foreground">
                Built for modern coffee teams
              </p>
              <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
                Run your coffee operation in one system.
              </h1>
              <p className="max-w-xl text-base leading-7 text-muted-foreground">
                CoffeeOS centralizes inventory, roasting, products, and order workflows so your team
                can spend less time in spreadsheets and more time building the business.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button asChild size="lg">
                  <Link href="/auth/sign-up">Start free</Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link href="/pricing">View pricing</Link>
                </Button>
              </div>
            </div>
            <div className="rounded-2xl border bg-card p-5 shadow-sm">
              <div className="grid gap-3">
                <div className="rounded-xl border bg-background p-4">
                  <p className="text-xs text-muted-foreground">Inventory</p>
                  <p className="mt-2 text-sm font-medium">Green and roasted stock tracked in real time</p>
                </div>
                <div className="rounded-xl border bg-background p-4">
                  <p className="text-xs text-muted-foreground">Roasting</p>
                  <p className="mt-2 text-sm font-medium">
                    Batch planning and roast request fulfillment in one workflow
                  </p>
                </div>
                <div className="rounded-xl border bg-background p-4">
                  <p className="text-xs text-muted-foreground">Commerce</p>
                  <p className="mt-2 text-sm font-medium">
                    Sync products and orders with Shopify for cleaner operations
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-14">
        <div className="grid gap-5 md:grid-cols-3">
          <div className="rounded-2xl border p-6">
            <h2 className="text-lg font-semibold">Single source of truth</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Keep product, component, and order data connected across your team.
            </p>
          </div>
          <div className="rounded-2xl border p-6">
            <h2 className="text-lg font-semibold">Team-ready workflows</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Built-in role-aware access and process tracking for production teams.
            </p>
          </div>
          <div className="rounded-2xl border p-6">
            <h2 className="text-lg font-semibold">Fast onboarding</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Start with your current catalog and scale operations without adding complexity.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}

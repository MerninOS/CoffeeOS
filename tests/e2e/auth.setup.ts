import { test as setup, expect, type Browser } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { demoAccount, loadEnvLocal, roasterAccount } from './support/env'
import { hideOverlays } from './support/overlays'

/**
 * Logs in once per seeded account and saves the sessions, so specs don't each
 * pay the auth round-trip. Credentials come from this worktree's `.env.local`
 * via support/env; `scripts/seed-demo-account.mjs` reads the same variables and
 * is the source of truth for what those accounts contain.
 *
 * TWO states, not one. /settings renders differently for a role that can manage
 * the workspace and one that cannot, and a suite that only ever signs in as the
 * owner cannot see a role-gating regression (CoffeeOS#74 criterion 18). The
 * roaster comes from `node scripts/seed-demo-account.mjs --roaster-only`, which
 * is additive and does not re-seed.
 *
 * The saved states live in tests/e2e/.auth/, which is gitignored.
 *
 * WHY THIS IS A SETUP PROJECT AND NOT `globalSetup`
 *
 * It used to be `globalSetup`, which runs before ANY spec in the run regardless
 * of which spec you asked for — so when it threw, `playwright test
 * design-rulings.spec.ts` reported an auth error for a spec that reads files off
 * disk and never opens a browser. Nothing in the suite could execute while
 * anything about auth was broken.
 *
 * As a setup project it is a DEPENDENCY of the browser projects only. A failure
 * here still stops every spec that needs a session — that part was never wrong —
 * but the `static` project has no dependency on it and runs anyway.
 */
const AUTH_DIR = path.join(process.cwd(), 'tests/e2e/.auth')

const OWNER_STATE = path.join(AUTH_DIR, 'storageState.json')
const ROASTER_STATE = path.join(AUTH_DIR, 'storageState.roaster.json')

function accounts() {
  return [
    { ...demoAccount(), label: 'owner', state: OWNER_STATE },
    { ...roasterAccount(), label: 'roaster', state: ROASTER_STATE },
  ]
}

/**
 * Prove the billing bypass is live on the server we are about to drive.
 *
 * `playwright.config.ts` sets `SHOPIFY_BILLING_TEST: '1'` in `webServer.env`,
 * and the whole suite depends on it: `lib/supabase/proxy.ts` bounces any user
 * whose workspace lacks active billing to /settings, and the demo workspace has
 * `billing_status` null. The owner only survives that gate by the hardcoded
 * `isDemoUserEmail()` literal, which no per-worktree address matches, and the
 * roaster never had a bypass at all.
 *
 * But `reuseExistingServer: true` ADOPTS a dev server already on the port and
 * silently discards that entire env block — the same trap ORDERS_PAGE_LIMIT hit
 * in CoffeeOS#88. When that happens the roaster is gated to
 * /settings?error=billing_not_active&action=activate_billing, settings-client.tsx
 * auto-fires /api/shopify/billing/ensure, the Shopify Admin call 404s because
 * there is no real store, and the route lands on
 * /settings?error=billing_check_failed. What you SEE is a 30s `waitForURL`
 * timeout wrapped in "could not sign in" — an auth error for a billing config
 * problem, which is why this cost a day to find (CoffeeOS#119).
 *
 * So check it directly, before any login, and say what is actually wrong.
 * Unauthenticated, `/api/shopify/billing/ensure` is a two-valued oracle: with the
 * bypass it redirects to /dashboard?billing=active on its first line, without it
 * it falls through to the no-session branch and redirects to /auth/login.
 */
setup('the billing bypass is live on this server', async ({ request, baseURL }) => {
  const response = await request.get('/api/shopify/billing/ensure', { maxRedirects: 0 })
  const location = response.headers()['location'] ?? ''

  expect(
    location,
    `The dev server at ${baseURL} does not have SHOPIFY_BILLING_TEST enabled ` +
      `(GET /api/shopify/billing/ensure answered ${response.status()} -> ${location || '<no redirect>'}).\n\n` +
      `Almost always this is \`reuseExistingServer: true\` adopting a dev server you started ` +
      `by hand, which discards playwright.config.ts's whole webServer.env block. Kill it and ` +
      `let Playwright boot its own:\n` +
      `  lsof -ti:${new URL(baseURL ?? 'http://localhost:3000').port || 80} | xargs kill -9 2>/dev/null; pnpm test:e2e\n\n` +
      `If you do want to keep your own server, start it with the flag set:\n` +
      `  SHOPIFY_BILLING_TEST=1 SHOPIFY_FIXTURE_MODE=1 ORDERS_PAGE_LIMIT=3 pnpm dev\n\n` +
      `Without it every seeded account is bounced to /settings by the billing gate in ` +
      `lib/supabase/proxy.ts, and the failure surfaces as an auth timeout.`
  ).toContain('billing=active')
})

async function signIn(
  browser: Browser,
  admin: SupabaseClient,
  acct: ReturnType<typeof accounts>[number],
) {
  // A fresh CONTEXT per account, not a fresh page. Sharing one lets the second
  // login inherit the first's cookies, which writes the owner's session into the
  // roaster's state file — and then every role-gating assertion passes while
  // testing the wrong user, a failure indistinguishable from success.
  //
  // Built from the browser directly rather than taking the `page` fixture so it
  // cannot inherit `use.storageState` either — this project's whole job is to
  // produce that file, so reading it here would be circular.
  const context = await browser.newContext()
  const page = await context.newPage()

  try {
    await page.goto('/auth/login')

    // Every capability spec hides these before it touches anything; this file
    // was the one place that did not, and it is the worst place to skip it.
    // The Next.js dev overlay's `nextjs-portal` host can sit directly over the
    // "Sign in" button — confirmed with `document.elementFromPoint()` at the
    // button's own centre, which returned NEXTJS-PORTAL, not the button.
    //
    // Playwright's actionability check then retries the click until the test
    // times out. Because this is the `setup` project that every browser project
    // depends on, that single blocked click failed the whole run: 1 failed, 328
    // did not run. And it reports as "could not sign in as demo@coffeeos.io",
    // which points at the account — so the documented next step is to re-run
    // `seed-demo-account.mjs`, wiping a demo account shared by every worktree
    // on the machine to fix something that was never a data problem at all.
    await hideOverlays(page)

    await page.getByLabel(/email/i).fill(acct.email)
    await page.getByLabel(/password/i).fill(acct.password)
    await page.getByRole('button', { name: /sign in|log in|login/i }).click()

    // Leaving /auth/ is the only proof auth actually succeeded, and it is the
    // WHOLE proof — a failed login silently stays on /auth/login, and every
    // later spec would then screenshot the login page instead of failing here.
    //
    // Deliberately not `/(dashboard|orders)/`. That asserted a landing page
    // rather than a session, so any redirect away from the dashboard — the
    // billing gate, a future role gate — read as "could not sign in". Both
    // seeded roles do reach /dashboard today (lib/supabase/proxy.ts gates on
    // billing and connection, never on role), so nothing here is being papered
    // over; the setup test above is what fails when that stops being true.
    await page.waitForURL((url) => !url.pathname.startsWith('/auth/'), { timeout: 30_000 })

    /**
     * Dismiss the onboarding tour widget before saving the session.
     *
     * `components/onboarding-tour-widget.tsx` renders `fixed bottom-4 right-4
     * z-50 w-[350px]`, which sits over the bottom-right of every page — i.e.
     * over table row actions. Playwright reports the target as "visible,
     * enabled and stable" and then retries the click for the full timeout while
     * the widget eats every pointer event, so the failure reads as a missing
     * element rather than an overlay.
     *
     * It hides only when all six setup steps complete or when this key is set.
     * The long-lived demo account completes them via a real Shopify OAuth
     * connection, which a seeded per-worktree account cannot reproduce.
     *
     * The id comes from the admin API, NOT from localStorage: this app uses
     * @supabase/ssr, which keeps the session in COOKIES, so scanning
     * localStorage for an `sb-*-auth-token` finds nothing and quietly skips the
     * dismissal — which is exactly the silent no-op this comment exists to stop
     * anyone reintroducing.
     *
     * Done per ACCOUNT because the key is keyed on the user id: dismissing it
     * for the owner leaves the roaster's session with the widget still armed.
     */
    const { data: users } = await admin.auth.admin.listUsers()
    const userId = users.users.find((u) => u.email?.toLowerCase() === acct.email.toLowerCase())?.id
    if (!userId) throw new Error(`could not resolve a user id for ${acct.email}`)

    // Park on /settings before touching localStorage. It is the one authenticated
    // route `billingProtectedPaths` in lib/supabase/proxy.ts leaves open, so it
    // holds still for every role and every billing state, and a bare /settings
    // carries none of the query params that make settings-client.tsx auto-fire a
    // billing check and navigate out from under us mid-evaluate.
    await page.goto('/settings')
    await page.waitForURL(/\/settings/, { timeout: 30_000 })

    await page.evaluate((id) => {
      window.localStorage.setItem(`coffeeos:onboarding:${id}:hidden`, 'true')
    }, userId)
    await page.reload()

    await context.storageState({ path: acct.state })
  } catch (err) {
    throw new Error(
      `Auth setup failed — could not sign in as ${acct.email} (${acct.label}). ` +
        `Run \`node scripts/seed-demo-account.mjs\` to (re)create the demo account, ` +
        `or with --roaster-only for just the roaster. ` +
        `Underlying error: ${(err as Error).message}`
    )
  } finally {
    await context.close()
  }
}

setup('sign in as every seeded role', async ({ browser }) => {
  setup.setTimeout(180_000)
  mkdirSync(AUTH_DIR, { recursive: true })

  // Again here, not just in playwright.config.ts. Specs run in worker
  // PROCESSES; the config's call mutates the main process only, and a worker
  // that inherits a shell without these set would read the shared defaults and
  // sign in to an account this worktree never seeded.
  loadEnvLocal()

  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('auth setup needs SUPABASE_SERVICE_ROLE_KEY to dismiss the onboarding widget')
  }
  const admin = createClient(url, key, { auth: { persistSession: false } })

  // Sequential, not Promise.all — a dev server cold-starting under two
  // concurrent logins is how the 30s timeout above gets hit spuriously.
  for (const acct of accounts()) await signIn(browser, admin, acct)
})

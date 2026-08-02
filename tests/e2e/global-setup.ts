import { chromium, type Browser } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { demoAccount, loadEnvLocal, roasterAccount } from './support/env'

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
 */
const AUTH_DIR = path.join(process.cwd(), 'tests/e2e/.auth')

function accounts() {
  return [
    { ...demoAccount(), label: 'owner', state: path.join(AUTH_DIR, 'storageState.json') },
    { ...roasterAccount(), label: 'roaster', state: path.join(AUTH_DIR, 'storageState.roaster.json') },
  ]
}

async function signIn(
  browser: Browser,
  admin: SupabaseClient,
  acct: ReturnType<typeof accounts>[number],
) {
  // A fresh CONTEXT per account, not a fresh page. Sharing one lets the second
  // login inherit the first's cookies, which writes the owner's session into the
  // roaster's state file — and then every role-gating assertion passes while
  // testing the wrong user, a failure indistinguishable from success.
  const context = await browser.newContext()
  const page = await context.newPage()

  try {
    const port = process.env.PORT ?? '3000'
    await page.goto(`http://localhost:${port}/auth/login`)
    await page.getByLabel(/email/i).fill(acct.email)
    await page.getByLabel(/password/i).fill(acct.password)
    await page.getByRole('button', { name: /sign in|log in|login/i }).click()

    // Landing on the dashboard is the only proof auth actually succeeded — a
    // failed login silently stays on /auth/login, and every later spec would
    // then screenshot the login page instead of failing here.
    await page.waitForURL(/\/(dashboard|orders)/, { timeout: 30_000 })

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

export default async function globalSetup() {
  mkdirSync(AUTH_DIR, { recursive: true })

  loadEnvLocal()
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('global-setup needs SUPABASE_SERVICE_ROLE_KEY to dismiss the onboarding widget')
  }
  const admin = createClient(url, key, { auth: { persistSession: false } })

  const browser = await chromium.launch()
  try {
    // Sequential, not Promise.all — a dev server cold-starting under two
    // concurrent logins is how the 30s timeout above gets hit spuriously.
    for (const acct of accounts()) await signIn(browser, admin, acct)
  } finally {
    await browser.close()
  }
}

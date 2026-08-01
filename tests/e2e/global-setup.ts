import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { demoAccount, loadEnvLocal } from './support/env'

/**
 * Logs in once with the seeded demo account and saves the session, so specs
 * don't each pay the auth round-trip. Credentials come from the environment,
 * falling back to the values `scripts/seed-demo-account.mjs` prints — that
 * script is the source of truth for the demo account.
 *
 * The saved state lives in tests/e2e/.auth/, which is gitignored.
 */
const AUTH_DIR = path.join(process.cwd(), 'tests/e2e/.auth')
const STATE = path.join(AUTH_DIR, 'storageState.json')

export default async function globalSetup() {
  const { email, password } = demoAccount()

  mkdirSync(AUTH_DIR, { recursive: true })

  const browser = await chromium.launch()
  const page = await browser.newPage()

  try {
    await page.goto(`http://localhost:${process.env.PORT ?? '3000'}/auth/login`)
    await page.getByLabel(/email/i).fill(email)
    await page.getByLabel(/password/i).fill(password)
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
     */
    loadEnvLocal()
    const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) {
      throw new Error('global-setup needs SUPABASE_SERVICE_ROLE_KEY to dismiss the onboarding widget')
    }
    const admin = createClient(url, key, { auth: { persistSession: false } })
    const { data: users } = await admin.auth.admin.listUsers()
    const userId = users.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())?.id
    if (!userId) throw new Error(`could not resolve a user id for ${email}`)

    await page.evaluate((id) => {
      window.localStorage.setItem(`coffeeos:onboarding:${id}:hidden`, 'true')
    }, userId)
    await page.reload()

    await page.context().storageState({ path: STATE })
  } catch (err) {
    throw new Error(
      `Auth setup failed — could not sign in as ${email}. ` +
        `Run \`node scripts/seed-demo-account.mjs\` to (re)create the demo account. ` +
        `Underlying error: ${(err as Error).message}`
    )
  } finally {
    await browser.close()
  }
}

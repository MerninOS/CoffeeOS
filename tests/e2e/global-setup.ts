import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import path from 'node:path'

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
  const email = process.env.DEMO_EMAIL ?? 'demo@coffeeos.io'
  const password = process.env.DEMO_PASSWORD ?? 'DemoCoffeeOS!2026'

  mkdirSync(AUTH_DIR, { recursive: true })

  const browser = await chromium.launch()
  const page = await browser.newPage()

  try {
    await page.goto('http://localhost:3000/auth/login')
    await page.getByLabel(/email/i).fill(email)
    await page.getByLabel(/password/i).fill(password)
    await page.getByRole('button', { name: /sign in|log in|login/i }).click()

    // Landing on the dashboard is the only proof auth actually succeeded — a
    // failed login silently stays on /auth/login, and every later spec would
    // then screenshot the login page instead of failing here.
    await page.waitForURL(/\/(dashboard|orders)/, { timeout: 30_000 })

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

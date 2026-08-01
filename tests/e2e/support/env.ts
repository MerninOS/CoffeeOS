import fs from 'node:fs'
import path from 'node:path'

/**
 * Per-worktree test configuration, read from this worktree's `.env.local`.
 *
 * WHY THIS EXISTS
 *
 * This repo runs several git worktrees at once, and two of the e2e suite's
 * inputs are global by default:
 *
 *   1. The dev-server PORT. `playwright.config.ts` sets
 *      `reuseExistingServer: true`, so a run started in worktree A ADOPTS a
 *      server already listening on that port — which may be serving worktree B's
 *      source. The page renders perfectly and the failures read as assertion
 *      bugs, so this costs real time to diagnose (CoffeeOS#72).
 *   2. The DEMO ACCOUNT. `scripts/seed-demo-account.mjs` deletes and reinserts
 *      that user's data wholesale. Two worktrees sharing one account means each
 *      re-seed silently destroys the other's fixtures mid-run.
 *
 * Both are fixed the same way: give each worktree its own value in its own
 * (gitignored) `.env.local`, and default to today's values so an unconfigured
 * checkout and CI behave exactly as before.
 *
 * Existing process env always wins, so a one-off `PORT=3200 …` still overrides
 * the file.
 */
export function loadEnvLocal(cwd: string = process.cwd()): void {
  const envPath = path.join(cwd, '.env.local')
  if (!fs.existsSync(envPath)) return
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (!(key in process.env)) process.env[key] = value
  }
}

/**
 * The demo identity this worktree owns.
 *
 * Defaults to the shared account so nothing changes for a checkout that has not
 * opted in. `scripts/seed-demo-account.mjs` reads the same two variables and is
 * the source of truth for what the account contains — point both at the same
 * address or the suite will sign in to an account nobody seeded.
 */
export function demoAccount(): { email: string; password: string } {
  loadEnvLocal()
  return {
    email: process.env.DEMO_EMAIL ?? 'demo@coffeeos.io',
    password: process.env.DEMO_PASSWORD ?? 'DemoCoffeeOS!2026',
  }
}

/**
 * The roaster identity this worktree owns — a role that can manage nothing.
 *
 * /settings renders three ways by role, and a suite that only ever signs in as
 * the owner cannot see a role-gating regression (CoffeeOS#74 criterion 18).
 *
 * Derived from `demoAccount()` by sub-addressing rather than hard-coded, so it
 * inherits this worktree's isolation instead of reintroducing the shared
 * account that isolation exists to remove. `scripts/seed-demo-account.mjs`
 * derives it identically and is the source of truth for what the account
 * contains; change one and you must change the other.
 */
export function roasterAccount(): { email: string; password: string } {
  loadEnvLocal()
  const demo = demoAccount()
  return {
    email:
      process.env.DEMO_ROASTER_EMAIL ??
      demo.email.replace(/^([^@]+)@/, '$1+roaster@'),
    password: process.env.DEMO_ROASTER_PASSWORD ?? demo.password,
  }
}

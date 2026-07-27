import { test, expect, type Page } from '@playwright/test'

/**
 * Visual + console baselines for every route the instrument re-skin will touch,
 * and for every route it must NOT touch.
 *
 * Captured while the dashboard is still loud Mernin', so each later phase diffs
 * against the previous state and an unrelated page regressing shows up as a
 * failure rather than a post-merge surprise.
 */

// Routes being converted, phase by phase. Detail routes are excluded: they need
// seeded record IDs, which the seed script does not currently expose.
const DASHBOARD = [
  '/dashboard',
  '/orders',
  '/products',
  '/inventory',
  '/components',
  '/roasting',
  '/roasting/batches',
  '/roasting/settings',
  '/settings',
]

// Out of scope forever. These keep the loud Mernin' brand, so they are the
// canaries for token bleed — a leak shows up here as a screenshot diff.
const PUBLIC = [
  '/',
  '/pricing',
  '/auth/login',
  '/auth/sign-up',
  '/auth/error',
  '/auth/sign-up-success',
]

/**
 * Pre-existing console noise, allowlisted so the assertion still fails on
 * anything NEW. Keep this list short and each entry justified — every addition
 * is a small hole in the safety net.
 *
 * - App Bridge: app/layout.tsx loads Shopify's app-bridge.js unconditionally,
 *   so outside a Shopify embed (no `shop` query param) it errors on every page
 *   load. Pre-dates this work; worth fixing by loading it only when embedded.
 */
const KNOWN_NOISE = [/App Bridge Next: missing required configuration fields/]

function collectErrors(page: Page) {
  const errors: string[] = []
  const record = (text: string) => {
    if (!KNOWN_NOISE.some((re) => re.test(text))) errors.push(text)
  }
  page.on('console', (m) => m.type() === 'error' && record(m.text()))
  page.on('pageerror', (e) => record(e.message))
  return errors
}

const snapshotName = (route: string) =>
  `${route === '/' ? '_root' : route.replace(/\//g, '_')}.png`

test.describe('dashboard baselines (authenticated)', () => {
  for (const route of DASHBOARD) {
    test(`baseline ${route}`, async ({ page }) => {
      const errors = collectErrors(page)

      await page.goto(route)
      // A redirect to /auth/login means storageState did not apply; without this
      // the suite would happily baseline nine identical login screens.
      await expect(page).not.toHaveURL(/\/auth\//)
      await page.waitForLoadState('networkidle')

      await expect(page).toHaveScreenshot(snapshotName(route), { fullPage: true })
      expect(errors, `console errors on ${route}`).toEqual([])
    })
  }
})

test.describe('public baselines (logged out)', () => {
  // These must run unauthenticated — /auth/login redirects to the dashboard
  // when a session exists, so the authenticated context cannot reach them.
  test.use({ storageState: { cookies: [], origins: [] } })

  for (const route of PUBLIC) {
    test(`baseline ${route}`, async ({ page }) => {
      const errors = collectErrors(page)

      await page.goto(route)
      await page.waitForLoadState('networkidle')

      await expect(page).toHaveScreenshot(snapshotName(route), { fullPage: true })
      expect(errors, `console errors on ${route}`).toEqual([])
    })
  }
})

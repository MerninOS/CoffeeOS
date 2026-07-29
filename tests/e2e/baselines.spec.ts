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
//
// EXCEPTION: /products/[id] — see PRODUCT_DETAIL below. CoffeeOS#69 converts it,
// and Stage A's whole proof is "zero baseline movement", which asserts nothing
// for a route with no baseline. It is reached by clicking through /products by
// product NAME rather than by id, which the seed does fix.
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

/**
 * Two products, because the detail page branches hard on whether a recipe
 * exists: a costed product renders the COGS breakdown chart and a populated
 * calculator, an uncosted one renders two different empty states. A baseline of
 * only the first would let the refactor silently break the second.
 *
 * Titles, not ids — these are fixed by scripts/seed-demo-account.mjs. Clicking
 * through by name also keeps the baseline stable if row ORDER changes, which an
 * index-based `.first()` would not.
 */
const PRODUCT_DETAIL = [
  { name: 'Yirgacheffe Light Roast 12oz', slug: 'costed' },
  { name: 'Guatemala Huehuetenango 12oz', slug: 'uncosted' },
]

test.describe('product detail baselines (authenticated)', () => {
  for (const { name, slug } of PRODUCT_DETAIL) {
    test(`baseline /products/[id] (${slug})`, async ({ page }) => {
      await page.goto('/products')
      await expect(page).not.toHaveURL(/\/auth\//)

      // Read the href and navigate rather than clicking. Two reasons, both
      // learned the hard way:
      //   1. The onboarding widget (`fixed bottom-4 right-4 z-50`) covers the
      //      row at 375px and intercepts the click until it is dismissed. The
      //      orders specs hide it — but hiding it would also remove it from
      //      this screenshot, making these baselines inconsistent with the nine
      //      routes above that DO capture it.
      //   2. /products ships two renderings of every row (a desktop table and
      //      an `md:hidden` card list), so the name matches twice. Both copies
      //      point at the same product, so `.first()` is safe for reading an
      //      attribute even though it is not safe for clicking. CoffeeOS#69
      //      Criterion 21 deletes that duplication.
      const link = page.getByRole('link', { name, exact: false }).first()
      await link.waitFor({ timeout: 20_000 })
      const href = await link.getAttribute('href')

      // Prove the link resolves to a real detail route. Without this the test
      // would happily baseline the list page again if the lookup drifted.
      expect(href).toMatch(/^\/products\/[0-9a-f-]{36}$/)

      // Visit once to make `next dev` COMPILE the route, and only start
      // collecting console errors afterwards. The first hydration of a
      // freshly-compiled route emits a useId mismatch (`aria-controls`
      // `_R_2itmlb_` server vs `_R_6itmlb_` client, on the AppShell nav drawer)
      // that never recurs once warm and does not exist in a production build.
      // Verified: whichever detail test runs first in a cold run hits it, and
      // both pass repeatedly afterwards.
      //
      // Deliberately a warm-up rather than a KNOWN_NOISE entry — an allowlist
      // would suppress that same message for a genuine hydration bug introduced
      // by the Stage B rewrite, which is what these baselines exist to catch.
      await page.goto(href!)
      await page.waitForLoadState('networkidle')

      const errors = collectErrors(page)
      await page.goto(href!)
      await page.waitForLoadState('networkidle')

      // The costed product renders a recharts donut, whose animation is
      // JS-driven — `animations: 'disabled'` does not stop react-smooth. This
      // relies on toHaveScreenshot's own stabilisation (it reshoots until two
      // consecutive frames match) rather than a fixed sleep.
      await expect(page).toHaveScreenshot(`_products_detail_${slug}.png`, {
        fullPage: true,
      })
      expect(errors, `console errors on /products/[id] (${slug})`).toEqual([])
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

import { test, expect, type Page } from '@playwright/test'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

/**
 * Visual + console baselines for every route the instrument re-skin will touch,
 * and for every route it must NOT touch.
 *
 * Captured while the dashboard is still loud Mernin', so each later phase diffs
 * against the previous state and an unrelated page regressing shows up as a
 * failure rather than a post-merge surprise.
 */

// Routes being converted, phase by phase. Detail routes are excluded from this
// list: they need seeded record IDs, which the seed script does not expose.
//
// TWO EXCEPTIONS, both reached by reading a row's href rather than by id:
//   - /products/[id] — see PRODUCT_DETAIL below (CoffeeOS#69).
//   - /orders/[id]   — see ORDER_DETAIL below (CoffeeOS#70).
// In both cases Stage A's whole proof is "zero baseline movement", which asserts
// nothing for a route with no baseline.
const DASHBOARD = [
  '/dashboard',
  '/orders',
  '/products',
  '/inventory',
  '/components',
  '/roasting',
  '/roasting?tab=requests',
  '/roasting?tab=sessions',
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

      // The requests tab is reached by query param, so a dropped param would
      // silently baseline the sessions tab a second time.
      if (route.includes('tab=requests')) {
        await expect(page.getByRole('heading', { name: 'Roast Requests' })).toBeVisible()
      }
      await page.waitForLoadState('networkidle')

      // The sidebar/top-bar identity chrome renders the signed-in EMAIL —
      // initials, display name, and `<local-part>.myshopify.com`. Each worktree
      // now owns its own demo account (tests/e2e/support/env.ts), so that region
      // differs per worktree and would fail every authenticated baseline for a
      // reason that has nothing to do with the page under test. Masking it keeps
      // these snapshots identity-independent; it is chrome, not a converted
      // surface, and no conversion ticket asserts anything about it.
      await expect(page).toHaveScreenshot(snapshotName(route), {
        fullPage: true,
        mask: [page.locator('[data-testid="identity-chrome"]')],
      })
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
        // Identity chrome renders the signed-in email — masked so these stay
        // account-independent under per-worktree demo accounts. See the dashboard
        // loop above for the full reasoning.
        mask: [page.locator('[data-testid="identity-chrome"]')],
        fullPage: true,
      })
      expect(errors, `console errors on /products/[id] (${slug})`).toEqual([])
    })
  }
})

/**
 * Three orders, because the detail page branches hard on COSTABILITY and each
 * branch renders structurally different content. CoffeeOS#100 made those
 * branches real; CoffeeOS#70 rebuilds the page around them, and Stage A's proof
 * is that none of them moved.
 *
 *   costed    a margin figure, a profit figure, an ink COGS total
 *   unlinked  both figures withheld, COGS "not set", copy NAMING the item
 *   empty     no line items at all — a different sentence again, and the only
 *             state where the worksheet can show a real cost while the margin
 *             stays withheld (CoffeeOS#81)
 *
 * A baseline of only the first would let the rebuild silently break the two
 * states that 240 of 316 production orders are actually in.
 *
 * Order names, not ids — scripts/seed-demo-account.mjs fixes these deliberately
 * and its comments name each state.
 */
const ORDER_DETAIL = [
  { name: '#1002', slug: 'costed' },
  { name: '#1007', slug: 'unlinked' },
  { name: '#1004', slug: 'empty' },
]

/**
 * These navigate by id, NOT by clicking through /orders — the one place this
 * suite deviates from the /products/[id] precedent above, and not by preference.
 *
 * `playwright.config.ts` pins ORDERS_PAGE_LIMIT to 3 deliberately, so /orders'
 * criterion 5 can detect its pagination bug. That makes the list permanently the
 * newest three orders, and two of the three states below are older than that BY
 * DESIGN: #1007 is 4th newest and #1004 is 6th. No period reaches them (they are
 * in range, just not on the page) and no search does either, because search
 * filters the fetched page rather than the range.
 *
 * So the ids come from a fixture the seed emits. It is generated, not committed,
 * because ids do not survive a reseed — the same contract as
 * tests/e2e/.auth/storageState.json.
 */
function seededOrderIds(): Record<string, string> {
  const file = path.join(__dirname, '..', 'fixtures', 'seeded-orders.json')
  if (!existsSync(file)) {
    throw new Error(
      `Missing ${file}. Run \`node scripts/seed-demo-account.mjs\` to (re)create ` +
        `the demo account — it writes this fixture on the way out.`,
    )
  }
  return JSON.parse(readFileSync(file, 'utf8'))
}

test.describe('order detail baselines (authenticated)', () => {
  for (const { name, slug } of ORDER_DETAIL) {
    test(`baseline /orders/[id] (${slug})`, async ({ page }) => {
      const id = seededOrderIds()[name]
      expect(id, `${name} is missing from tests/fixtures/seeded-orders.json — re-run the seed`).toBeTruthy()

      const href = `/orders/${id}`
      expect(href).toMatch(/^\/orders\/[0-9a-f-]{36}$/)

      // A stale fixture points at a deleted order, which renders notFound() —
      // and a 404 page screenshots perfectly happily. Assert we are on the real
      // detail route before baselining anything.
      await page.goto(href)
      await expect(page).not.toHaveURL(/\/auth\//)
      await expect(
        page.getByRole('heading', { name, exact: false }),
        `${name} did not render — the id fixture is probably stale; re-run the seed`,
      ).toBeVisible({ timeout: 20_000 })

      // Warm the route before collecting console errors — see the note on
      // /products/[id] above. Deliberately not a KNOWN_NOISE entry: an allowlist
      // would suppress that message for a genuine hydration bug introduced by
      // the Stage B rewrite, which is exactly what this baseline exists to catch.
      await page.goto(href!)
      await page.waitForLoadState('networkidle')

      const errors = collectErrors(page)
      await page.goto(href!)
      await page.waitForLoadState('networkidle')

      await expect(page).toHaveScreenshot(`_orders_detail_${slug}.png`, {
        // Identity chrome renders the signed-in email — masked so these stay
        // account-independent under per-worktree demo accounts. See the dashboard
        // loop above for the full reasoning.
        mask: [page.locator('[data-testid="identity-chrome"]')],
        fullPage: true,
      })
      expect(errors, `console errors on /orders/[id] (${slug})`).toEqual([])
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

      // The sidebar/top-bar identity chrome renders the signed-in EMAIL —
      // initials, display name, and `<local-part>.myshopify.com`. Each worktree
      // now owns its own demo account (tests/e2e/support/env.ts), so that region
      // differs per worktree and would fail every authenticated baseline for a
      // reason that has nothing to do with the page under test. Masking it keeps
      // these snapshots identity-independent; it is chrome, not a converted
      // surface, and no conversion ticket asserts anything about it.
      await expect(page).toHaveScreenshot(snapshotName(route), {
        fullPage: true,
        mask: [page.locator('[data-testid="identity-chrome"]')],
      })
      expect(errors, `console errors on ${route}`).toEqual([])
    })
  }
})

/**
 * /settings as a ROASTER — the role that can manage nothing.
 *
 * Every other authenticated baseline in this file is an owner's view, so a
 * regression in role gating would ship invisibly. /settings gates three of its
 * four jobs on owner-or-admin, which makes it the route where that matters most.
 *
 * The assertions are DOM ABSENCE, not visibility. An element that is present but
 * CSS-hidden still ships its content in the HTML, and a member count is exactly
 * the sort of thing that should not reach a role with no team section — that was
 * a real leak in the design review, where the stat strip showed team figures to
 * a roaster who had no team list to go with them.
 */
test.describe('/settings as a roaster', () => {
  test.use({ storageState: 'tests/e2e/.auth/storageState.roaster.json' })

  test('baseline /settings (roaster)', async ({ page }) => {
    const errors = collectErrors(page)

    await page.goto('/settings')
    await expect(page).not.toHaveURL(/\/auth\//)
    await page.waitForLoadState('networkidle')

    // Nothing that manages the workspace.
    await expect(page.getByRole('button', { name: /send invite|^invite$/i })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /disconnect/i })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /connect store/i })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /refresh billing status/i })).toHaveCount(0)
    await expect(page.getByTestId('member-row')).toHaveCount(0)
    await expect(page.getByTestId('invitation-row')).toHaveCount(0)

    // And no team figures in the markup at all, hidden or otherwise.
    const html = await page.content()
    expect(html, 'the stat strip leaked team counts to a roaster').not.toMatch(/>\s*Members\s*</i)
    expect(html, 'the role legend came back').not.toMatch(/Role Permissions/i)

    await expect(page).toHaveScreenshot('_settings_roaster.png', {
      fullPage: true,
      mask: [page.locator('[data-testid="identity-chrome"]')],
    })
    expect(errors, 'console errors on /settings as a roaster').toEqual([])
  })
})

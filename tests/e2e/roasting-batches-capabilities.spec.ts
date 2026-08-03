import { test, expect, type Page } from '@playwright/test'
import { hideOverlays } from './support/overlays'

/**
 * ── What this spec is for ─────────────────────────────────────────────────
 *
 * `/roasting/batches` is being restyled to Instrument (CoffeeOS#71, stage 3).
 * A restyle rewrites every class, every wrapper and most of the markup, so the
 * only coverage worth having is coverage that survives that: assert what the
 * page DOES, located by `data-testid`, and never by class, tag nesting or copy.
 *
 * Batches is its own route, not a `?tab=` of `/roasting` — see the nav note in
 * the plan. Both viewports render from the same `filteredBatches` array, so
 * unlike the sessions tab there is no desktop-only stat here: the mobile
 * `batch-card` carries `row-green`/`row-roasted`/`row-loss`/`row-sellable`
 * exactly like the desktop `batch-row`. That is why `expectRowStats` below
 * does not branch on viewport the way its sessions counterpart has to.
 *
 * ── What this spec deliberately does NOT cover ────────────────────────────
 *
 * The two mutations on this page — deleting a batch, and the create-component
 * dialog (`createComponentFromBatch` / `addToExistingComponent`) — are NOT
 * covered here, for one reason: this worktree has no `DEMO_EMAIL` in
 * `.env.local`, so `demoAccount()` falls back to the shared `demo@coffeeos.io`
 * that every worktree on the machine signs into.
 *
 *   - Deleting a batch destroys seeded fixture data that nothing restores, and
 *     this page has no create-batch capability to build a disposable one with.
 *   - Creating a component leaves a real row in shared inventory, which the
 *     products and orders specs count.
 *
 * Covering them safely needs a batch the spec owns, which means creating one
 * through the session-detail page — and that page carries no testids at all
 * until stage 4 converts it. Writing those locators now means writing them
 * twice. So they are deferred to stage 4, where the fixture becomes cheap and
 * the contract is stable. Stated here rather than left as a silent hole.
 */

const ROUTE = '/roasting/batches'

/**
 * Both layouts are in the DOM at once and hidden by CSS (`md:hidden` /
 * `hidden md:block`), so a plain selector matches twice on every viewport.
 * `.filter({ visible: true })` picks the one the current viewport actually
 * shows.
 *
 * Written as ONE comma selector on purpose. The `.or()` form of this union
 * silently resolved to zero once a `.filter({ hasText })` was chained onto it,
 * which turns a `toHaveCount(0)` assertion into a false pass — the exact
 * failure mode that let a sabotaged handler through in the requests spec.
 */
const batchRows = (page: Page) =>
  page.locator('[data-testid="batch-row"], [data-testid="batch-card"]').filter({ visible: true })

async function openBatches(page: Page) {
  await page.goto(ROUTE)
  await page.waitForLoadState('networkidle')
  await hideOverlays(page)
  await expect(batchRows(page).first()).toBeVisible()
}

/**
 * Weights are asserted as the literal strings the page renders, not computed
 * from the gram values in the fixture.
 *
 * That is the point. `units.ts` converts grams to pounds for display, and a
 * spec that recomputed the conversion would agree with the page no matter
 * which unit it switched to. Literals mean a unit change has to come here and
 * be made deliberately — which is exactly how the sessions tab's grams→pounds
 * move got caught.
 */
async function expectRowStats(
  row: ReturnType<typeof batchRows>,
  expected: {
    lot: string
    green: string
    roasted: string
    loss: string
    sellable: string
  }
) {
  /**
   * The session date is asserted by SHAPE, not by value — the one field here
   * that deliberately is not a literal.
   *
   * `seed-demo-account.mjs` derives session dates relative to the day it runs,
   * so the seeded batch renders "Jul 28, 2026" before a re-seed and
   * "Jul 29, 2026" after one. Pinning the value makes a green suite depend on
   * when the fixture was last rebuilt, and it fails for a reason that has
   * nothing to do with the page — which is exactly what happened here.
   *
   * The weights below stay literal on purpose. They are fixture CONSTANTS, and
   * writing them out is what forces a unit change to be made deliberately.
   * A relative date is not a constant, so it does not get that treatment.
   */
  await expect(row.locator('[data-testid="row-session"]')).toHaveText(
    /^[A-Z][a-z]{2} \d{1,2}, \d{4}$/
  )
  await expect(row.locator('[data-testid="row-lot"]')).toContainText(expected.lot)
  await expect(row.locator('[data-testid="row-green"]')).toContainText(expected.green)
  await expect(row.locator('[data-testid="row-roasted"]')).toContainText(expected.roasted)
  await expect(row.locator('[data-testid="row-loss"]')).toContainText(expected.loss)
  await expect(row.locator('[data-testid="row-sellable"]')).toContainText(expected.sellable)
}

// The two seeded batches, as the page renders them today. Weights are pounds.
const ETHIOPIA = {
  coffee: 'Ethiopia Yirgacheffe',
  lot: 'ETH-YIR-2026-01',
  green: '11.9',
  roasted: '10.0',
  loss: '15.9%',
  sellable: '9.7',
}
const GUATEMALA = {
  coffee: 'Guatemala Huehuetenango',
  lot: 'GUA-HUE-2026-02',
  green: '11.5',
  roasted: '9.7',
  loss: '17.5%',
  sellable: '9.5',
}

test.describe('roasting batches capabilities', () => {
  // ── 1. observe ─────────────────────────────────────────────────────────
  test('observe: each batch shows its session, lot, and four weights', async ({ page }) => {
    await openBatches(page)

    await expect(batchRows(page)).toHaveCount(2)

    for (const b of [ETHIOPIA, GUATEMALA]) {
      const row = batchRows(page).filter({ hasText: b.coffee })
      await expect(row, `no row for ${b.coffee}`).toHaveCount(1)
      await expectRowStats(row, b)
    }
  })

  // ── 2. observe: sellable is not roasted ────────────────────────────────
  test('observe: sellable weight is tracked separately from roasted weight', async ({ page }) => {
    await openBatches(page)

    // Worth its own test because the two are adjacent columns of similar
    // magnitude: 10.0 roasted vs 9.7 sellable. A restyle that duplicated one
    // cell's binding into the other would still look completely plausible,
    // and `observe` above would keep passing if BOTH went to the same value
    // only if that value happened to match — this pins that they differ.
    const row = batchRows(page).filter({ hasText: ETHIOPIA.coffee })
    const roasted = await row.locator('[data-testid="row-roasted"]').innerText()
    const sellable = await row.locator('[data-testid="row-sellable"]').innerText()

    expect(roasted.trim(), 'roasted and sellable must not render the same binding').not.toBe(
      sellable.trim()
    )
  })

  // ── 3. search by coffee name ───────────────────────────────────────────
  test('search: filtering by coffee name narrows the list to that batch', async ({ page }) => {
    await openBatches(page)

    await page.locator('[data-testid="batches-search"]').fill('Yirgacheffe')

    await expect(batchRows(page)).toHaveCount(1)
    await expect(batchRows(page).first()).toContainText(ETHIOPIA.coffee)

    // Clearing restores both — proves the filter is reversible state, not a
    // one-way mutation of the list.
    await page.locator('[data-testid="batches-search"]').fill('')
    await expect(batchRows(page)).toHaveCount(2)
  })

  // ── 4. search by lot code ──────────────────────────────────────────────
  test('search: filtering by lot code narrows the list to that batch', async ({ page }) => {
    await openBatches(page)

    // A separate branch of the same predicate (`coffee_name || lot_code`), and
    // the one more easily lost: a restyle that rebuilt the filter around the
    // visible coffee-name column alone would still pass test 3.
    await page.locator('[data-testid="batches-search"]').fill('GUA-HUE')

    await expect(batchRows(page)).toHaveCount(1)
    await expect(batchRows(page).first()).toContainText(GUATEMALA.coffee)
  })

  // ── 5. search is case-insensitive ──────────────────────────────────────
  test('search: matching ignores case', async ({ page }) => {
    await openBatches(page)

    // `searchQuery.toLowerCase()` is compared against lowercased fields; the
    // seeded lot codes are uppercase, so a dropped `.toLowerCase()` on either
    // side fails here and nowhere else.
    await page.locator('[data-testid="batches-search"]').fill('gua-hue')

    await expect(batchRows(page)).toHaveCount(1)
    await expect(batchRows(page).first()).toContainText(GUATEMALA.coffee)
  })

  // ── 6. search with no matches ──────────────────────────────────────────
  test('search: a query matching nothing empties the list (and says nothing — see note)', async ({
    page,
  }) => {
    await openBatches(page)

    await page.locator('[data-testid="batches-search"]').fill('zzz-no-such-batch')
    await expect(batchRows(page)).toHaveCount(0)

    /**
     * Pinning a GAP, not endorsing it.
     *
     * `batches-client.tsx` gates its `EmptyState` on `batches.length === 0` —
     * the unfiltered array — so a search that matches nothing renders the
     * table frame with zero rows inside it and no message at all. The operator
     * gets a blank box.
     *
     * Not fixed here: this branch is a restyle, and the two-stage split only
     * holds if behaviour changes stay out of it. Filed separately. Asserting
     * the current behaviour means the fix, when it lands, has to come through
     * this line and be deliberate.
     */
    await expect(page.locator('[data-testid="batches-table"]')).toBeAttached()
    await expect(page.getByText('No Batches Yet')).toHaveCount(0)
  })

  // ── 7. navigate ────────────────────────────────────────────────────────
  test('navigate: a batch links to the session that produced it', async ({ page }) => {
    await openBatches(page)

    const row = batchRows(page).filter({ hasText: ETHIOPIA.coffee })

    // `row-session` is a `<Link>` on both layouts when the batch has a session,
    // so this one locator drives both viewports without branching. The
    // dropdown's `menu-view-session` points at the same href; the visible link
    // is the path an operator actually takes.
    await row.locator('[data-testid="row-session"] a, a[data-testid="row-session"]').first().click()

    await expect(page).toHaveURL(/\/roasting\/sessions\/[0-9a-f-]+$/)
  })
})

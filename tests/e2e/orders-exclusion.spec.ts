import { test, expect, type Page } from '@playwright/test'

/**
 * CoffeeOS#79 — uncostable orders leave the margin aggregate.
 *
 * The defect these guard is the one the whole page exists to prevent: an order
 * whose cost is unknown contributes full revenue and zero cost, so it reads as
 * 100% profit. On production that took the margin figure across 309 orders when
 * only 44 of them were costed.
 *
 * ASSERTIONS ARE EXACT, never "not equal to the naive value". A range assertion
 * passes for any wrong number, and `orders-capabilities.spec.ts:59` already
 * records how a lenient parse silently reads a sentinel as 0 and passes.
 *
 * FIXTURE DEPENDENCE. Three cases need orders that only exist once
 * `scripts/seed-demo-account.mjs` has been re-run (#1006 mixed, #1007 unlinked
 * with a named item). Those tests SKIP with a message naming the fixture rather
 * than passing vacuously — a green run that proved nothing is worse than a
 * visible skip. Everything else runs against the account as it stands.
 */

const money = (t: string) => Number(t.replace(/[^0-9.-]/g, ''))

const row = (page: Page, name: string) =>
  page.getByTestId('order-row').filter({ hasText: name })

/**
 * The onboarding tour widget is `fixed bottom-4 right-4 z-50` and swallows clicks
 * meant for the rows beneath it — on the mobile viewport it covers most of the
 * list. Hidden with injected CSS rather than dismissed through its own X, which
 * persists to localStorage and would drift the /orders baseline screenshot in a
 * way nobody would trace back here. Same approach, and same reasoning, as
 * orders-capabilities.spec.ts:162.
 */
async function hideOnboardingWidget(page: Page) {
  await page.addStyleTag({
    content: 'div.fixed.bottom-4.right-4.z-50 { display: none !important; }',
  })
}

async function load(page: Page, period = '30') {
  await page.goto(`/orders?period=${period}`)
  await page.getByTestId('order-row').first().waitFor({ timeout: 20000 })
  await hideOnboardingWidget(page)
}

/** Skips — loudly — when a seeded fixture is absent. */
async function requireOrder(page: Page, name: string) {
  const present = await row(page, name).count()
  test.skip(
    present === 0,
    `${name} is not on the rendered page — either the seed fixture is missing ` +
      `(run \`pnpm seed:demo\`, which DELETES and recreates the demo account) or the ` +
      `order falls outside ORDERS_PAGE_LIMIT. Not a pass: this case went unverified.`
  )
}

test.describe('Criteria 1-3 — only fully costed orders reach the aggregate', () => {
  test('a costed order keeps its derived figures', async ({ page }) => {
    await load(page)
    const costed = row(page, '#1002')
    await expect(costed.getByTestId('row-excluded')).toHaveCount(0)
    await expect(costed.getByTestId('row-profit')).toHaveText('$3.26')
    await expect(costed.getByTestId('row-margin')).toHaveText('4.2%')
  })

  test('an uncosted order is excluded and withholds profit and margin', async ({ page }) => {
    await load(page)
    const excluded = row(page, '#1003')

    await expect(excluded.getByTestId('row-excluded')).toHaveAttribute(
      'data-status',
      'uncosted'
    )

    // Revenue and COGS are real as far as they go and MUST survive. Profit and
    // margin are derived from the missing number, so a figure there would be
    // invented — asserting the em dash is asserting that we admit ignorance.
    await expect(excluded.getByTestId('row-revenue')).toHaveText('$246.00')
    await expect(excluded.getByTestId('row-profit')).toHaveText('—')
    await expect(excluded.getByTestId('row-margin')).toHaveText('—')
  })

  test('a mixed order is excluded, not given partial credit', async ({ page }) => {
    await load(page)
    await requireOrder(page, '#1006')
    const mixed = row(page, '#1006')

    // The whole point of #1006: total COGS is NON-ZERO ($11.96 from the costed
    // sibling), so the predicate this replaced passed it unflagged. Partial
    // credit and exclusion are numerically distinguishable only because the
    // costed sibling costs something.
    await expect(mixed.getByTestId('row-excluded')).toHaveAttribute('data-status', 'uncosted')
    await expect(mixed.getByTestId('row-profit')).toHaveText('—')
    await expect(mixed.getByTestId('row-margin')).toHaveText('—')
  })

  test('excluded revenue is absent from the aggregate, exactly', async ({ page }) => {
    await load(page)

    // Reads RANGE-scoped excluded revenue, not the excluded rows visible on the
    // page.
    //
    // The page-scoped version of this test was unsound: `covered` and `period`
    // are both server-computed over the whole range, so summing only the excluded
    // rows that happen to be rendered compares two different scopes. It passed
    // only while the page held every excluded order — with the seed fixtures and
    // ORDERS_PAGE_LIMIT=3 it is off by $277, and would have failed as a
    // "regression" with nothing regressed.
    const stats = page.getByTestId('strip-column')
    const covered = money(await page.getByTestId('stat-revenue').innerText())
    const period = Number(await stats.getAttribute('data-period-revenue'))
    const excluded = Number(await stats.getAttribute('data-excluded-revenue'))

    // Pins the arithmetic rather than asserting covered < period: an
    // implementation that drops the right COUNT of orders but the wrong revenue
    // still fails here.
    expect(
      covered + excluded,
      'covered revenue plus excluded revenue must reconcile to the period total'
    ).toBeCloseTo(period, 2)

    // And the split must be real, not zero-on-both-sides.
    expect(excluded, 'this fixture should have something excluded').toBeGreaterThan(0)
  })
})

test.describe('Criteria 4 & 6 — the figures state their scope', () => {
  test('the qualifier names covered and total revenue when orders are excluded', async ({ page }) => {
    await load(page)

    const covered = money(await page.getByTestId('stat-revenue').innerText())
    const period = Number(
      await page.getByTestId('strip-column').getAttribute('data-period-revenue')
    )

    expect(period).toBeGreaterThan(covered)

    // Assert BOTH figures, not merely that the cell contains "of" — that would
    // pass on unrelated copy, and on a qualifier naming the wrong number.
    const cell = page.getByTestId('stat-revenue').locator('xpath=../..')
    await expect(cell).toContainText(`$${covered.toFixed(2)}`)
    await expect(cell).toContainText(`$${period.toFixed(2)}`)
  })

  test('no qualifier and no banner when nothing is excluded', async ({ page }) => {
    // The 7-day window on the demo account excludes nothing. An unconditional
    // "on $192.00 of $192.00" is noise; this is the other half of Criterion 4.
    await page.goto('/orders?period=7')
    await page.waitForLoadState('networkidle')
    await hideOnboardingWidget(page)

    await expect(page.getByTestId('missing-cogs-banner')).toHaveCount(0)
    const cell = page.getByTestId('stat-revenue').locator('xpath=../..')
    await expect(cell).not.toContainText(' of $')
  })
})

test.describe('Criterion 5 — the two populations stay distinct', () => {
  test('repairable and unrepairable are separate counts with different remedies', async ({ page }) => {
    await load(page, '365')
    await requireOrder(page, '#1007')

    const uncosted = page.getByTestId('excluded-uncosted-count')
    const unlinked = page.getByTestId('excluded-unlinked-count')

    await expect(uncosted).toContainText('recipe')
    await expect(unlinked).toContainText('catalogue')

    // The remedies must differ. A single combined count, or the same sentence
    // twice, is the conflation the per-line-item labels were split to undo.
    expect(await uncosted.innerText()).not.toBe(await unlinked.innerText())
  })
})

test.describe('Criteria 7 & 8 — excluded stays visible and actionable', () => {
  test('an excluded order remains in the list, by name', async ({ page }) => {
    await load(page)
    // By NAME, never by row count: a count assertion passes if one excluded
    // order is dropped and one costed order is duplicated.
    await expect(row(page, '#1003')).toHaveCount(1)
    await expect(row(page, '#1003').getByTestId('row-revenue')).toHaveText('$246.00')
  })

  test('an uncosted order names its blocking product and links to it', async ({ page }) => {
    await load(page)
    await row(page, '#1003').click()

    const link = page.getByTestId('blocking-product')
    await expect(link).toHaveText('Guatemala Huehuetenango 12oz')

    // The href must resolve to that product's real id. A badge naming the right
    // product while linking to the wrong one is what an operator actually hits,
    // and a text-only assertion cannot see it.
    const href = await link.getAttribute('href')
    expect(href).toMatch(/^\/products\/[0-9a-f-]{36}$/)

    await link.click()
    await expect(page).toHaveURL(href!)
    await expect(page.getByText('Guatemala Huehuetenango 12oz').first()).toBeVisible()
  })

  test('an unlinked order names the line item and offers no link', async ({ page }) => {
    await load(page, '365')
    await requireOrder(page, '#1007')
    await row(page, '#1007').click()

    const banner = page.getByTestId('expanded-excluded-unlinked')
    await expect(banner).toContainText('Sunrise Blend (discontinued)')

    // No link, deliberately: there is no product to navigate to, and offering
    // one would promise a fix that does not exist.
    await expect(banner.locator('a')).toHaveCount(0)
    await expect(page.getByTestId('blocking-product')).toHaveCount(0)
  })

  test('an order with no line items says so rather than naming nothing', async ({ page }) => {
    await load(page, '365')

    // Usually SKIPS, and the reason matters more than the test.
    //
    // #1004/#1005/#0902 are the empty orders, and they are the 4th, 5th and 6th
    // newest. The suite runs with ORDERS_PAGE_LIMIT=3 — needed so Criterion 5 can
    // detect a paginated-sum bug at all — so they are never on the rendered page
    // and this copy cannot be reached here.
    //
    // The CLASSIFICATION is what actually matters and it is covered without a
    // browser: tests/unit/cogs.spec.ts asserts an empty order is `unlinked` and
    // never `costed`, and proves the guard load-bearing by mutation. This test
    // exists for the copy, and runs whenever the limit is raised.
    await requireOrder(page, '#1005')
    await row(page, '#1005').click()
    await expect(page.getByTestId('expanded-excluded-unlinked')).toContainText(
      'no line items'
    )
  })
})

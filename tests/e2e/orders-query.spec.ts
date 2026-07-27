import { test, expect } from '@playwright/test'

/**
 * Spec Criteria 5, 6 and 7 — the bounded orders query.
 *
 * The defect these guard against is unusually easy to introduce and impossible
 * to see: `orders-client.tsx` used to compute the page totals with
 * `orders.reduce(...)`, which was CORRECT while the query was unbounded. Adding
 * a `.limit()` in a different file made those lines wrong without anyone editing
 * them — summing a page while the labels say a period. No error, just a
 * plausible smaller number.
 */

const LIMIT = Number(process.env.ORDERS_PAGE_LIMIT ?? 100)
const money = (s: string) => Number(s.replace(/[^0-9.-]/g, ''))

const rows = (page: import('@playwright/test').Page) =>
  page.locator('[data-testid="order-row"]')

test.describe('Criterion 6 — the query is bounded', () => {
  test('a narrow period returns fewer rows than a wide one', async ({ page }) => {
    await page.goto('/orders?period=365')
    await page.waitForLoadState('networkidle')
    const wide = await rows(page).count()

    await page.goto('/orders?period=7')
    await page.waitForLoadState('networkidle')
    const narrow = await rows(page).count()

    // Without the seed spreading dates across presets, these are equal and the
    // assertion proves nothing — so state that requirement in the failure.
    expect(
      wide,
      'the seed must span the presets (see scripts/seed-demo-account.mjs) or this proves nothing'
    ).toBeGreaterThan(narrow)
  })

  test('never returns more rows than the limit', async ({ page }) => {
    await page.goto('/orders?period=365')
    await page.waitForLoadState('networkidle')
    expect(await rows(page).count()).toBeLessThanOrEqual(LIMIT)
  })

  test('the longest preset still excludes something', async ({ page }) => {
    // The seed holds one order at 500 days. If "1 year" returned it, the filter
    // would be inert on the widest preset and nobody would notice.
    await page.goto('/orders?period=365')
    await page.waitForLoadState('networkidle')
    await expect(page.getByText('#0902')).toHaveCount(0)
  })
})

test.describe('Criterion 5 — aggregates cover the range, not the page', () => {
  test('revenue exceeds the sum of the visible page', async ({ page }) => {
    await page.goto('/orders?period=365')
    await page.waitForLoadState('networkidle')

    const rowCount = await rows(page).count()

    // THE PRECONDITION: the limit must be BINDING.
    //
    // Note it cannot be `rowCount > LIMIT` — rowCount is what the query
    // returned, so it is capped at LIMIT by construction and that assertion is
    // unsatisfiable. What proves the fixture is big enough is the page coming
    // back saturated: exactly LIMIT rows means the query hit its ceiling and
    // there is more in range than is shown.
    //
    // Without this, page and range are the same set, a broken implementation
    // returns identical numbers to a correct one, and the assertion below
    // passes while proving nothing. Run with ORDERS_PAGE_LIMIT=3.
    expect(
      rowCount,
      `the page limit (${LIMIT}) must be binding for this test to detect the bug — ` +
        `got ${rowCount} rows, so the fixture fits in one page. Re-run with ORDERS_PAGE_LIMIT=3`
    ).toBe(LIMIT)

    const aggregate = money(
      await page.locator('[data-testid="stat-revenue"]').first().innerText()
    )
    const visible = (await page.locator('[data-testid="row-revenue"]').allInnerTexts())
      .reduce((sum, t) => sum + money(t), 0)

    // Strictly greater. Equality is the signature of the defect: it means the
    // aggregate was summed from the rows that happened to be fetched.
    expect(
      aggregate,
      'aggregate equals the visible page — it is being summed from the page, not the range'
    ).toBeGreaterThan(visible)
  })

  test('aggregates grow with the period', async ({ page }) => {
    // Cheap companion that needs no limit override, so there is still coverage
    // when the suite runs with production settings.
    const revenueFor = async (period: string) => {
      await page.goto(`/orders?period=${period}`)
      await page.waitForLoadState('networkidle')
      return money(await page.locator('[data-testid="stat-revenue"]').first().innerText())
    }
    expect(await revenueFor('365')).toBeGreaterThan(await revenueFor('7'))
  })
})

test.describe('Criterion 7 — the period lives in the URL', () => {
  test('survives a reload', async ({ page }) => {
    await page.goto('/orders?period=7')
    await page.waitForLoadState('networkidle')
    const before = await rows(page).count()

    await page.reload()
    await page.waitForLoadState('networkidle')

    expect(page.url()).toContain('period=7')
    expect(await rows(page).count()).toBe(before)
  })

  test('an unrecognised period falls back instead of erroring', async ({ page }) => {
    // `?period=` is user-editable. A 500 on `?period=banana` would be a
    // self-inflicted outage.
    const res = await page.goto('/orders?period=banana')
    expect(res?.status()).toBe(200)
    await expect(rows(page).first()).toBeVisible()
  })
})

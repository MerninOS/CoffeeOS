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

// Runs on BOTH projects. The duplicate `md:hidden` mobile rendering these tests
// used to skip around is gone (CoffeeOS#65): OrdersWorksheetTable is one DOM
// that restacks at 1180px, so `order-row` is genuinely visible on mobile rather
// than present-but-CSS-hidden, and the mobile project now covers the stacked
// worksheet for free.
test.describe.configure({ mode: 'default' })

// Must match playwright.config.ts's webServer env, which sets this low so the
// limit is binding (see the comment there).
const LIMIT = Number(process.env.ORDERS_PAGE_LIMIT ?? 3)
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

/**
 * The same defect as Criterion 5, one layer up: copy and controls that SPEAK
 * about the period while READING the page.
 *
 * Both tests below need the page limit to be binding, which is why they run at
 * ?period=365 with ORDERS_PAGE_LIMIT=3 — the range holds more orders than the
 * page returns, so page-derived and range-derived figures actually differ. With
 * a non-binding limit they are the same set and a broken implementation reads
 * identically to a correct one.
 */
test.describe('page-scoped UI must not claim period scope', () => {
  /** Asserts the limit is binding, then returns the visible row count. */
  async function loadSaturatedPage(page: import('@playwright/test').Page) {
    await page.goto('/orders?period=365')
    await page.waitForLoadState('networkidle')
    // The onboarding tour widget is `fixed bottom-4 right-4 z-50`. On the mobile
    // viewport it lands on top of the banner's action and swallows the click —
    // same interception orders-capabilities.spec.ts hides it for, and hidden the
    // same way (injected CSS, not its own X, which persists to localStorage and
    // would then change the /orders baseline screenshot).
    await page.addStyleTag({
      content: 'div.fixed.bottom-4.right-4.z-50 { display: none !important; }',
    })

    const rowCount = await rows(page).count()
    expect(
      rowCount,
      `the page limit (${LIMIT}) must be binding for this test to detect the bug — ` +
        `got ${rowCount} rows, so the fixture fits in one page. Re-run with ORDERS_PAGE_LIMIT=3`
    ).toBe(LIMIT)
    return rowCount
  }

  test('the footer does not report the page as the period total', async ({ page }) => {
    const rowCount = await loadSaturatedPage(page)

    const footer = await page.getByTestId('orders-footer-count').innerText()

    // The sentence names the period ("last year"), so the largest figure in it
    // must be a period figure. The defect reads "3 of 3 orders shown · last
    // year" — every number equals the page size, which asserts the period holds
    // only what this page happens to have fetched.
    //
    // "year" is used rather than a numeric preset precisely so the period label
    // contributes no digits of its own.
    const figures = [...footer.matchAll(/\d+/g)].map((m) => Number(m[0]))
    expect(
      Math.max(...figures),
      `"${footer}" names the period but its largest figure is the page size (${rowCount}) — ` +
        `it is reporting a page count as a period count`
    ).toBeGreaterThan(rowCount)
  })

  test('the missing-COGS banner cannot contradict its own action', async ({ page }) => {
    await loadSaturatedPage(page)

    const banner = page.getByTestId('missing-cogs-banner')
    await expect(
      banner,
      'the seed must leave uncosted orders in range or this proves nothing'
    ).toBeVisible()

    const bannerText = await banner.innerText()
    const action = banner.getByTestId('missing-cogs-show')

    // No action is a legitimate outcome: when none of the uncosted orders are on
    // this page there is nothing a page-scoped filter could reveal, and offering
    // the button would land the operator on "No orders match" with this banner
    // still overhead.
    if ((await action.count()) === 0) return

    await action.click()

    const shown = await rows(page).count()
    expect(shown, 'the banner action emptied the table while the banner is showing').toBeGreaterThan(0)

    // The banner counts the RANGE; the action filters the PAGE. It may only
    // offer the action if it has also told the operator how many it can
    // actually reach — otherwise a banner reading "3 orders have no product
    // COGS" hands back 1 row and explains nothing.
    expect(
      [...bannerText.matchAll(/\d+/g)].map((m) => Number(m[0])),
      `the banner never states the ${shown} uncosted order(s) its action can reach: "${bannerText}"`
    ).toContain(shown)
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

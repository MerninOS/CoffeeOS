import { test, expect } from '@playwright/test'

/**
 * Missing cost data must never render as a confident zero.
 *
 * A product's COGS comes from its component recipe, which nothing syncs — only
 * the roaster can say what a product is made of, and Shopify has no concept of
 * a bill of materials. So an uncosted product is the NORMAL state of a new
 * account, not an edge case.
 *
 * The expanded line-item table used to print "$0.00" for those, because the
 * condition tested `item.product_id` — which only catches a line item with no
 * product at all. A linked product with no recipe still has a map entry
 * (page.tsx assigns every product a total, so uncosted is 0, not undefined),
 * so it fell through to the money formatter.
 *
 * "$0.00" is a claim about the product: it costs nothing, so the margin is
 * real. "not set" is a claim about the data: nobody has told us yet. Only the
 * second is true, and the difference is a 94.9% gross margin that looks
 * plausible enough to act on.
 */

test.describe.configure({ mode: 'default' })

/**
 * The onboarding tour widget is `fixed bottom-4 right-4 z-50` and sits over the
 * bottom of the list, so at 375px it intercepts the row click and the test times
 * out rather than failing on the assertion.
 *
 * Hidden with CSS rather than dismissed by clicking its X: dismissal persists to
 * localStorage, and the widget is part of the visual baselines, so clicking it
 * away here would silently change what the baseline suite captures.
 */
async function hideTourWidget(page: import('@playwright/test').Page) {
  await page.addStyleTag({
    content: '[class*="fixed"][class*="bottom-4"][class*="right-4"]{display:none !important}',
  })
}

test('an uncosted line item says "not set", never "$0.00"', async ({ page }) => {
  await page.goto('/orders?period=365')
  await page.waitForLoadState('networkidle')
  await hideTourWidget(page)

  // The worksheet marks uncosted orders in its COGS column; expand one and the
  // line items beneath must tell the same story.
  const uncosted = page
    .locator('[data-testid="order-row"]')
    .filter({ has: page.locator('[data-testid="row-cogs"]', { hasText: 'not set' }) })
    .first()

  const found = await uncosted.count()
  expect(
    found,
    'no uncosted order in the fixture — seed one, or this proves nothing'
  ).toBeGreaterThan(0)

  await uncosted.click()

  const cells = page.locator('[data-testid="line-item-cogs"]')
  await expect(cells.first()).toBeVisible()

  const values = await cells.allInnerTexts()
  expect(values.length).toBeGreaterThan(0)

  // The whole point: a zero-cost rendering is indistinguishable from a real
  // zero, so it must not appear at all for uncosted products.
  for (const value of values) {
    expect(
      value.trim(),
      `an uncosted line item rendered "${value.trim()}" — a figure asserts the ` +
        `product costs that much, when the truth is that no recipe exists yet`
    ).toBe('not set')
  }
})

test('a costed line item still shows its figure', async ({ page }) => {
  // The guard against over-correcting: if everything said "not set", the test
  // above would pass while the page had stopped reporting costs entirely.
  await page.goto('/orders?period=365')
  await page.waitForLoadState('networkidle')
  await hideTourWidget(page)

  const costed = page
    .locator('[data-testid="order-row"]')
    .filter({ has: page.locator('[data-testid="row-cogs"]') })
    .filter({ hasNot: page.locator('[data-testid="row-cogs"]', { hasText: 'not set' }) })
    .first()

  expect(
    await costed.count(),
    'no costed order in the fixture — seed one, or this proves nothing'
  ).toBeGreaterThan(0)

  await costed.click()

  const cells = page.locator('[data-testid="line-item-cogs"]')
  await expect(cells.first()).toBeVisible()

  const values = await cells.allInnerTexts()
  expect(
    values.some((v) => /^\$\d/.test(v.trim())),
    `a costed order showed no unit COGS figure at all (${values.join(', ')}) — ` +
      `the "not set" rule has swallowed real data`
  ).toBe(true)
})

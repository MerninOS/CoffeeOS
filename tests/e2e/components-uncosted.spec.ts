import { test, expect, type Page } from '@playwright/test'

/**
 * A component nobody has priced must never render as a confident zero.
 *
 * `components.cost_per_unit` is `numeric NOT NULL DEFAULT 0`, so the column
 * fills itself in and 0 is the only reachable "nobody has set this" state. The
 * page this replaces rendered that as `$0.00000000/hour` — a claim about the
 * COMPONENT, that it is free and therefore that the margin on everything built
 * from it is real. `not set` is a claim about the DATA: nobody has told us yet.
 * Only the second is true, and the difference propagates through
 * product_components into product cost and through order_components into order
 * margin.
 *
 * Same ruling /orders adopted in CoffeeOS#68, applied in the opposite direction
 * on purpose: there the zero is computed from real recipe rows and IS the cost,
 * here it is what the column does when nobody types anything.
 *
 * CoffeeOS#73 Stage B, criteria 1, 3 and 9.
 */

const UNCOSTED = 'Cupping / QC'

async function openList(page: Page) {
  await page.goto('/components')
  await page.waitForLoadState('networkidle')
  await page.addStyleTag({
    content: [
      // The onboarding tour widget, collapsed or expanded — both roots are
      // `fixed bottom-4 right-4 z-50` and it covers the bottom of the list.
      '[class*="fixed"][class*="bottom-4"][class*="right-4"]{display:none !important}',
      // The Next.js dev-tools overlay. It does not exist in production, and at
      // 375px it sits over the bottom of the viewport where a row scrolled into
      // view lands — Playwright reported it intercepting pointer events on a
      // row action that was otherwise the topmost element at its own centre.
      'nextjs-portal{display:none !important}',
    ].join(''),
  })
  await expect(page.locator('[data-testid="component-row"]').first()).toBeVisible()
}

const rowFor = (page: Page, name: string) =>
  page
    .locator('[data-testid="component-row"]')
    .filter({ has: page.locator(`[data-testid="row-name"]:text-is("${name}")`) })

test.describe.configure({ mode: 'serial' })

test('the fixture actually contains an uncosted component', async ({ page }) => {
  // Criterion 9, and the guard for every assertion below. Without a
  // cost_per_unit = 0 row, "no cell says $0.00" is vacuously true and this whole
  // file passes while proving nothing — exactly the trap
  // tests/e2e/orders-uncosted.spec.ts names.
  //
  // Asserts the PROPERTY, not the name. A first version checked only that a row
  // called "Cupping / QC" existed; pricing that row left the guard green and
  // pushed the failure into the next test as a bare `expected "not set"`, which
  // is precisely the confusing outcome this guard exists to pre-empt. Verified
  // by setting its cost to 5 and watching the wrong test fail.
  await openList(page)

  const notSet = page.locator('[data-testid="row-cost"]', { hasText: /^not set$/ })
  await expect(
    notSet,
    'no uncosted component in the fixture — seed one (scripts/seed-demo-account.mjs seeds "Cupping / QC" at cost_per_unit 0), or nothing below proves anything',
  ).not.toHaveCount(0)

  // And the seeded row is the one we expect, so the specs below can name it.
  await expect(rowFor(page, UNCOSTED)).toHaveCount(1)
})

test('an uncosted component reads "not set", never a dollar figure', async ({ page }) => {
  await openList(page)
  const cell = rowFor(page, UNCOSTED).locator('[data-testid="row-cost"]')

  await expect(cell).toHaveText('not set')

  // The whole point: a zero-cost rendering is indistinguishable from a real
  // zero, so it must not appear at all.
  await expect(cell).not.toContainText('$')

  // And it is rendered in danger, not in the muted colour absence usually takes.
  // --danger is #B42318; asserted as a computed value so a token rename cannot
  // quietly turn the signal off.
  const color = await cell.evaluate((el) => getComputedStyle(el).color)
  expect(color, 'the uncosted cell is not rendered in --danger').toBe('rgb(180, 35, 24)')
})

test('every costed component still renders a real figure', async ({ page }) => {
  // The other half of criterion 1. A rule that rendered EVERYTHING as "not set"
  // would satisfy the test above, so this is its counterweight.
  await openList(page)
  const costed = ['Roasted Coffee', '12oz Valve Bag', 'Roastery Labor']
  for (const name of costed) {
    await expect(
      rowFor(page, name).locator('[data-testid="row-cost"]'),
      `${name} has a cost and must show it`,
    ).toContainText('$')
  }
})

test('the hero counts the uncosted components, in brand red', async ({ page }) => {
  // Criterion 3. The count is derived from the same rows the worksheet renders,
  // so it is asserted against the number of `not set` cells actually on screen
  // rather than a constant — a hardcoded 1 would pass forever.
  await openList(page)

  const notSetCells = page.locator('[data-testid="row-cost"]', { hasText: /^not set$/ })
  const expected = await notSetCells.count()
  expect(expected, 'fixture guard: expected at least one uncosted row').toBeGreaterThan(0)

  const hero = page.locator('[data-testid="uncosted-count"]')
  await expect(hero).toHaveText(String(expected))

  const color = await hero.evaluate((el) => getComputedStyle(el).color)
  expect(color, 'the hero figure is not --brand').toBe('rgb(250, 59, 48)')

  // The zero-state confirmation must NOT be showing at the same time.
  await expect(page.locator('[data-testid="uncosted-none"]')).toHaveCount(0)
})

test('the group band names how many of its rows are unpriced', async ({ page }) => {
  await openList(page)
  // "Cupping / QC" is labor, so the labor band must own the count.
  await expect(page.locator('[data-testid="group-uncosted"]').first()).toContainText('not set')
})

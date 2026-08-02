import { test, expect, type Page } from '@playwright/test'

/**
 * Deleting a component is not a local act.
 *
 * Every foreign key into `components` is ON DELETE CASCADE (`roasting_batches`
 * is SET NULL), and `lib/orders/cogs.ts` sums order COGS live from
 * `order_components` — nothing is snapshotted at fulfilment. So removing a
 * component silently deletes its cost lines from orders that already shipped,
 * and their recorded margin improves.
 *
 * Before CoffeeOS#73 Stage C the guard checked `product_components` ALONE, so a
 * component used only in a VARIANT recipe, or only on past orders, deleted
 * cleanly and took those rows with it.
 *
 * THE FIRST TEST HERE FAILS AGAINST main. That is the point of it: if it passes
 * on main, the hole this stage exists to close does not exist as described and
 * the change should be reconsidered rather than shipped.
 *
 * Three states, seeded in scripts/seed-demo-account.mjs because none of them
 * occurred naturally in the fixture:
 *
 *   5lb Bulk Bag   0 recipes · 1 variant recipe · 0 orders   -> BLOCKED
 *   Shipping Box   0 recipes · 0 variants · 2 orders $3.54   -> WARNED, allowed
 *   (created here) nothing at all                            -> deletes cleanly
 */

const VARIANT_ONLY = '5lb Bulk Bag'
const ORDER_ONLY = 'Shipping Box'
const ORDER_COST = '$3.54'

const probeName = (testInfo: { project: { name: string } }) =>
  `E2E Delete Guard Probe ${testInfo.project.name}`

async function openList(page: Page) {
  await page.goto('/components')
  await page.waitForLoadState('networkidle')
  await page.addStyleTag({
    content: [
      '[class*="fixed"][class*="bottom-4"][class*="right-4"]{display:none !important}',
      'nextjs-portal{display:none !important}',
    ].join(''),
  })
  await expect(page.locator('[data-testid="component-row"]').first()).toBeVisible()
}

const rowFor = (page: Page, name: string) =>
  page
    .locator('[data-testid="component-row"]')
    .filter({ has: page.locator(`[data-testid="row-name"]:text-is("${name}")`) })

/** The confirm resolves its usage asynchronously; wait for the verdict. */
async function openDeleteDialog(page: Page, name: string) {
  await rowFor(page, name).locator('[data-testid="row-delete"]').click()
  await expect(page.locator('[data-testid="delete-dialog"]')).toBeVisible()
  await expect(
    page.locator('[data-testid="delete-order-warning"], [data-testid="delete-no-usage"]'),
  ).toBeVisible()
}

test.describe.configure({ mode: 'serial' })

test.describe('/components delete guard', () => {
  test('the fixture carries the three states this spec needs', async ({ page }) => {
    // Guard first, in the style of components-uncosted.spec.ts: without these
    // rows every assertion below is vacuous, and the failure would otherwise
    // surface as a confusing missing-row error three tests later.
    await openList(page)
    await expect(
      rowFor(page, VARIANT_ONLY),
      `${VARIANT_ONLY} is missing — re-run scripts/seed-demo-account.mjs`,
    ).toHaveCount(1)
    await expect(
      rowFor(page, ORDER_ONLY),
      `${ORDER_ONLY} is missing — re-run scripts/seed-demo-account.mjs`,
    ).toHaveCount(1)
  })

  test('a component used only in a VARIANT recipe cannot be deleted', async ({ page }) => {
    // ── This is the test that must fail on main. ──
    await openList(page)
    const before = await page.locator('[data-testid="component-row"]').count()

    await openDeleteDialog(page, VARIANT_ONLY)
    await page.locator('[data-testid="delete-confirm"]').click()

    // Refused, and the message says which kind of recipe — "remove it from
    // products" would send the operator to a page that does not list it.
    const message = page.getByText(/variant recipe/i)
    await expect(message).toBeVisible()

    // And it is still there afterwards, read back from the database rather than
    // from React state.
    await openList(page)
    await expect(rowFor(page, VARIANT_ONLY)).toHaveCount(1)
    await expect(page.locator('[data-testid="component-row"]')).toHaveCount(before)
  })

  test('a component on past orders warns with the count and the cost, and still deletes', async ({
    page,
  }) => {
    await openList(page)
    await openDeleteDialog(page, ORDER_ONLY)

    const warning = page.locator('[data-testid="delete-order-warning"]')
    await expect(warning).toBeVisible()

    // The count is ORDERS, not rows: the fixture attaches this component to two
    // rows across two different orders, so a row count would also read "2" and
    // the two could not be told apart. The dollar figure is what distinguishes
    // them — 1 x $1.18 + 2 x $1.18.
    await expect(page.getByText(/2 past orders carry/i)).toBeVisible()
    await expect(page.getByText(new RegExp(ORDER_COST.replace('$', '\\$')))).toBeVisible()

    // Warned, NOT blocked — a shipped order cannot be edited, so blocking would
    // make this component permanently undeletable.
    await expect(page.locator('[data-testid="delete-confirm"]')).toBeEnabled()
  })

  test('a component nothing references says so, and deletes cleanly', async ({
    page,
  }, testInfo) => {
    const probe = probeName(testInfo)
    await openList(page)

    await page.locator('[data-testid="add-component"]').click()
    await page.locator('[data-testid="field-name"]').fill(probe)
    await page.locator('[data-testid="field-type"]').selectOption('other')
    await page.locator('[data-testid="field-unit"]').selectOption('each')
    await page.locator('[data-testid="field-cost"]').fill('0.25')
    await page.locator('[data-testid="dialog-save"]').click()
    await expect(rowFor(page, probe)).toHaveCount(1)

    await openDeleteDialog(page, probe)
    await expect(page.locator('[data-testid="delete-no-usage"]')).toBeVisible()

    await page.locator('[data-testid="delete-confirm"]').click()
    await expect(rowFor(page, probe)).toHaveCount(0)

    // Gone from the database, not just from local state.
    await openList(page)
    await expect(rowFor(page, probe)).toHaveCount(0)
  })

  test.afterAll(async ({ browser }, testInfo) => {
    const page = await browser.newPage()
    try {
      await openList(page)
      const probe = rowFor(page, probeName(testInfo))
      while ((await probe.count()) > 0) {
        await probe.first().locator('[data-testid="row-delete"]').click()
        await page.locator('[data-testid="delete-confirm"]').click()
        await expect(rowFor(page, probeName(testInfo))).toHaveCount(0)
      }
    } catch {
      /* best effort — a failed run must not also fail its own cleanup */
    }
    await page.close()
  })
})

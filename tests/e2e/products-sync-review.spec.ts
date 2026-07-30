import { test, expect, type Page } from '@playwright/test'
import { resetSyncFixture } from './support/reset-sync-fixture'

/**
 * CoffeeOS#90 — the review step between "Sync Shopify" and anything being
 * written.
 *
 * ⚠ READ BEFORE DEBUGGING A FAILURE HERE.
 *
 * These depend on SHOPIFY_FIXTURE_MODE reaching the server, set in
 * playwright.config.ts's `webServer.env`. `reuseExistingServer: true` means a
 * dev server already listening on :3000 is ADOPTED and that env block is
 * silently dropped — the sync then calls the real Shopify API and fails with a
 * 401 that points at the store rather than at the setup. Kill it first:
 *
 *   lsof -ti:3000 | xargs kill -9 2>/dev/null; pnpm test:e2e
 *
 * The first test asserts a fixture-only product is on screen precisely so that
 * misconfiguration fails as "the fixture never arrived" rather than as a
 * misleading auth error.
 *
 * THESE SPECS WRITE, unlike the rest of the suite — see support/reset-sync-fixture.
 * Two viewport projects run this file against one database, so without the reset
 * the mobile pass inherits everything the desktop pass imported.
 *
 * THEY NEVER IMPORT A SEEDED PRODUCT. Importing one would overwrite the values
 * that make it read as CHANGED, and the Changed group would be empty on every
 * later run — a suite that passes once. Every import below unchecks the Changed
 * group first. If that ever has to change, the reset helper needs a restore step.
 *
 * FIXTURE PAIRING. tests/fixtures/shopify-catalog.json pairs with
 * scripts/seed-demo-account.mjs: ids 10000000xx exist in the seed and must read
 * CHANGED, 90000000xx are absent and must read NEW. Re-seeding with different
 * ids would leave every test here passing while proving nothing, which is why
 * the pairing itself is asserted.
 */

const FIXTURE_ONLY_PRODUCT = 'Panama Geisha Reserve'
const DECLINED_PRODUCT = 'Decaf Swiss Water Blend'
const ADVENT_PRODUCT = 'Single Origin Advent Calendar'

/**
 * The onboarding tour widget is `fixed bottom-4 right-4 z-50` and swallows
 * clicks meant for the dialog footer beneath it. Hidden with injected CSS, the
 * same approach orders-exclusion.spec.ts takes and for the same reason.
 */
async function hideTourWidget(page: Page) {
  await page.addStyleTag({
    content: '[data-tour-widget], .fixed.bottom-4.right-4 { display: none !important; }',
  })
}

async function openReview(page: Page) {
  await page.goto('/products')
  await hideTourWidget(page)
  await page.getByRole('button', { name: 'Sync Shopify' }).click()
  const dialog = page.getByTestId('sync-review-dialog')
  await expect(dialog).toBeVisible({ timeout: 30_000 })
  return dialog
}

const candidate = (page: Page, title: string) =>
  page.getByTestId('sync-candidate').filter({ hasText: title })

/**
 * Instrument's Checkbox renders the native input visually hidden inside a
 * <label>, with a styled span doing the drawing. Playwright resolves the input
 * by role but cannot click it — "element is not visible". The label is both the
 * clickable surface and what a real user actually hits.
 */
async function setChecked(page: Page, ariaLabel: string, want: boolean) {
  const input = page.getByRole('checkbox', { name: ariaLabel })
  await expect(input).toHaveCount(1)
  if ((await input.isChecked()) !== want) {
    await page.locator(`label:has(input[aria-label="${ariaLabel}"])`).click()
    await expect(input).toBeChecked({ checked: want })
  }
}

/** Leaves the seeded products untouched. See the header note. */
async function deselectChangedGroup(page: Page) {
  await setChecked(page, 'Select all Changed', false)
}

// Serial: the "remembered" test reads the state the import test wrote. That
// dependency is real and stating it is better than each test re-importing.
test.describe.configure({ mode: 'serial' })

test.describe('Shopify sync review', () => {
  test.beforeAll(async () => {
    await resetSyncFixture()
  })

  test('the preview opens the dialog and writes nothing', async ({ page }) => {
    const dialog = await openReview(page)

    // Fixture data actually arrived. Without this the whole file could pass
    // against an empty dialog, or fail confusingly against a live-API 401.
    await expect(candidate(page, FIXTURE_ONLY_PRODUCT)).toBeVisible()

    // Classified, not imported.
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(page.getByText(FIXTURE_ONLY_PRODUCT)).toHaveCount(0)
  })

  test('the fixture pairing holds, or nothing below proves anything', async ({ page }) => {
    await openReview(page)

    await expect(page.getByTestId('sync-group-changed')).toBeVisible()
    await expect(
      page.getByTestId('sync-group-new').getByText(FIXTURE_ONLY_PRODUCT)
    ).toBeVisible()
  })

  test('a changed product names the fields that would be overwritten', async ({ page }) => {
    await openReview(page)

    const changed = page.getByTestId('sync-group-changed').getByTestId('sync-candidate').first()
    await changed.getByRole('button', { name: /Show \d+ change/ }).click()

    // The diff is the point of the dialog: it must name fields and show
    // `current → incoming`, not merely say "changed".
    await expect(changed.getByTestId('field-diffs')).toBeVisible()
    await expect(changed.getByTestId('field-diffs')).toContainText('→')
  })

  test('cancelling writes nothing at all', async ({ page }) => {
    const dialog = await openReview(page)

    // Toggle boxes first — a cancel that only works from an untouched dialog is
    // not the case anyone actually hits. Named rather than positional: nth()
    // silently follows whatever the group ordering happens to be.
    await setChecked(page, `Import ${FIXTURE_ONLY_PRODUCT}`, false)
    await setChecked(page, `Import ${DECLINED_PRODUCT}`, false)

    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(dialog).toBeHidden()

    await page.reload()
    await hideTourWidget(page)
    await expect(page.getByText(FIXTURE_ONLY_PRODUCT)).toHaveCount(0)
    await expect(page.getByText(DECLINED_PRODUCT)).toHaveCount(0)
  })

  test('only the selected products are imported, and a declined one stays out', async ({
    page,
  }) => {
    const dialog = await openReview(page)

    await deselectChangedGroup(page)
    await setChecked(page, `Import ${DECLINED_PRODUCT}`, false)

    await page.getByRole('button', { name: /^Import \d+$/ }).click()
    await expect(dialog).toBeHidden({ timeout: 60_000 })

    // The selected ones landed...
    await expect(page.getByText(FIXTURE_ONLY_PRODUCT).first()).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText(ADVENT_PRODUCT).first()).toBeVisible()
    // ...and the declined one did not.
    await expect(page.getByText(DECLINED_PRODUCT)).toHaveCount(0)
  })

  test('a declined product is remembered, and stays reachable to un-decline', async ({ page }) => {
    await openReview(page)

    // Absent from the default list (AC6). Asserting the exclusion ROW would
    // prove storage; asserting the next preview proves the behaviour.
    await expect(page.getByTestId('sync-group-new').getByText(DECLINED_PRODUCT)).toHaveCount(0)

    // Reachable behind the reveal, and re-importable (AC7).
    const reveal = page.getByTestId('reveal-ignored')
    await expect(reveal).toBeVisible()
    await reveal.click()
    await expect(page.getByTestId('sync-group-ignored').getByText(DECLINED_PRODUCT)).toBeVisible()
  })

  test('an imported product with 120 variants keeps all of them', async ({ page }) => {
    // Imported by the selection test above. Before the variant-page fix,
    // everything past the first 100 was deleted on write.
    await page.goto('/products')
    await hideTourWidget(page)
    await page.getByText(ADVENT_PRODUCT).first().click()

    await expect(page.getByText(/Day 120/).first()).toBeVisible({ timeout: 30_000 })
  })
})

import { test, expect, type Page } from '@playwright/test'

/**
 * The four editing capabilities of /components, asserted by their EFFECT ON THE
 * RENDERED COST TABLE rather than by the presence of a control.
 *
 * CoffeeOS#73 Stage A.5. These exist to survive Stage B: the page is about to be
 * rebuilt from loud Mernin' onto instrument — every class string replaced, the
 * duplicate mobile rendering deleted, the eight-decimal figure reformatted. A
 * test that asserts "the Save button is there" would pass through a rewrite that
 * quietly stopped saving. A test that asserts "a row now exists whose cost cell
 * reads exactly $0.55000000/each" cannot.
 *
 * That is why they are written NOW, against the pre-restyle markup, and are
 * green on this commit's parent. Written after the rewrite they would only
 * assert whatever the rewrite happened to do.
 *
 * Everything is selected by `data-testid`, never by class or copy — those are
 * exactly what Stage B changes. The testids are the contract.
 *
 * The page renders every row TWICE today (a `md:hidden` card list and a
 * `hidden md:block` table), so every row query is `:visible`-filtered. That
 * survives Stage B, which deletes the duplicate.
 */

/**
 * Scoped to the PROJECT, because desktop and mobile run against ONE shared
 * database (playwright.config.ts says so explicitly). With a single shared name,
 * mobile's beforeAll cleanup deletes the row desktop's later tests still depend
 * on — exactly what happened the first time all three component specs ran
 * together, and it surfaced as a baseline failure two files away.
 */
const probeName = (testInfo: { project: { name: string } }) =>
  `E2E Capability Probe ${testInfo.project.name}`

/**
 * The exact strings the cost cell must render, written out rather than computed.
 *
 * Deliberately NOT `fmtCost(0.55)`: importing the function under test would make
 * this assertion agree with any rule the function happens to implement, which is
 * no assertion at all. These are the values a human decided are correct.
 *
 * They CHANGED at Stage B, from `$0.55000000/each` to `$0.5500/each`, and that
 * is the guard working as intended — the spec was written at A.5 asserting
 * toFixed(8) precisely so a reformat could not slip through unremarked. The new
 * values are criterion 2: two decimals at or above a dollar, four below it.
 */
const COST_055 = '$0.5500/each'
const COST_125 = '$1.25/each'

/**
 * Two overlays that sit over the bottom of the list and intercept clicks at
 * narrow widths. Hidden with CSS rather than dismissed: dismissal persists to
 * localStorage and the tour widget is part of the visual baselines, so clicking
 * it away here would silently change what the baseline suite captures.
 */
async function hideOverlays(page: Page) {
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
}

const rows = (page: Page) => page.locator('[data-testid="component-row"]:visible')
const rowFor = (page: Page, name: string) =>
  rows(page).filter({ has: page.locator(`[data-testid="row-name"]:text-is("${name}")`) })

async function openList(page: Page) {
  await page.goto('/components')
  await page.waitForLoadState('networkidle')
  await hideOverlays(page)
  await expect(rows(page).first()).toBeVisible()
}

/**
 * Stage B replaced the two Radix Selects with instrument's, which is a native
 * `<select>` — so this DRIVER changed from click-trigger-then-click-option to
 * `selectOption`.
 *
 * That is the allowed kind of change: nothing this spec ASSERTS moved. Drivers
 * describe how you operate the control and may follow the markup; assertions
 * describe what must be true afterwards and may not, or the spec stops being
 * evidence and starts being a description of whatever was built.
 */
async function pickOption(page: Page, testId: string, value: string) {
  await page.locator(`[data-testid="${testId}"]`).selectOption(value)
}

/** Leftovers from an interrupted run would make `create` fail on a duplicate. */
async function removeProbeIfPresent(page: Page, probe: string) {
  await openList(page)
  const existing = rowFor(page, probe)
  while ((await existing.count()) > 0) {
    await existing.first().locator('[data-testid="row-delete"]').click()
    await page.locator('[data-testid="delete-confirm"]').click()
    await expect(rowFor(page, probe)).toHaveCount(0)
  }
}

test.describe.configure({ mode: 'serial' })

test.describe('/components editing capabilities', () => {
  test.beforeAll(async ({ browser }, testInfo) => {
    const page = await browser.newPage()
    await removeProbeIfPresent(page, probeName(testInfo))
    await page.close()
  })

  // Also AFTER, and unconditionally. Cleaning up only on the way in means a
  // mid-run failure leaves the probe in the shared fixture, where it shifts the
  // row count for the baselines and every other spec — observed once, and it
  // took three specs to explain.
  test.afterAll(async ({ browser }, testInfo) => {
    const page = await browser.newPage()
    await removeProbeIfPresent(page, probeName(testInfo)).catch(() => {})
    await page.close()
  })

  test('create adds a row carrying the cost that was entered', async ({ page }, testInfo) => {
    const probe = probeName(testInfo)
    await openList(page)
    const before = await rows(page).count()

    await page.locator('[data-testid="add-component"]').click()
    await expect(page.locator('[data-testid="component-dialog"]')).toBeVisible()

    await page.locator('[data-testid="field-name"]').fill(probe)
    await pickOption(page, 'field-type', 'packaging')
    await pickOption(page, 'field-unit', 'each')
    await page.locator('[data-testid="field-cost"]').fill('0.55')
    await page.locator('[data-testid="dialog-save"]').click()

    // The effect, not the control: one more row, and it carries the figure.
    await expect(rows(page)).toHaveCount(before + 1)
    await expect(rowFor(page, probe).locator('[data-testid="row-cost"]')).toHaveText(
      COST_055
    )

    // Then survive a reload. `handleSubmit` appends to local state on success,
    // so the assertions above hold even if createComponent was never called —
    // verified by removing the server call, at which point this test still
    // passed and only the (incidentally reloading) edit test caught it. Reading
    // the row back from the database is what makes this assert persistence.
    await openList(page)
    await expect(rowFor(page, probe).locator('[data-testid="row-cost"]')).toHaveText(
      COST_055
    )
  })

  test('edit re-renders the row with the new cost', async ({ page }, testInfo) => {
    const probe = probeName(testInfo)
    await openList(page)
    await rowFor(page, probe).locator('[data-testid="row-edit"]').click()
    await expect(page.locator('[data-testid="component-dialog"]')).toBeVisible()

    // Pre-filled from the row — if this is empty the dialog is not reading the
    // component, and a save would silently blank the cost.
    await expect(page.locator('[data-testid="field-cost"]')).toHaveValue('0.55')

    await page.locator('[data-testid="field-cost"]').fill('1.25')
    await page.locator('[data-testid="dialog-save"]').click()

    await expect(rowFor(page, probe).locator('[data-testid="row-cost"]')).toHaveText(
      COST_125
    )

    // Same reason as create: the optimistic local update would satisfy the
    // assertion above on its own.
    await openList(page)
    await expect(rowFor(page, probe).locator('[data-testid="row-cost"]')).toHaveText(
      COST_125
    )
  })

  test('search narrows the list to matching rows', async ({ page }, testInfo) => {
    const probe = probeName(testInfo)
    await openList(page)
    const all = await rows(page).count()
    expect(all, 'fixture has no components — nothing to narrow').toBeGreaterThan(1)

    await page.locator('[data-testid="component-search"]').fill(probe)
    await expect(rows(page)).toHaveCount(1)
    await expect(rows(page).first().locator('[data-testid="row-name"]')).toHaveText(probe)

    // And it restores — a filter that cannot be cleared is a broken filter.
    await page.locator('[data-testid="component-search"]').fill('')
    await expect(rows(page)).toHaveCount(all)
  })

  test('delete removes the row', async ({ page }, testInfo) => {
    const probe = probeName(testInfo)
    await openList(page)
    const before = await rows(page).count()

    await rowFor(page, probe).locator('[data-testid="row-delete"]').click()
    await expect(page.locator('[data-testid="delete-dialog"]')).toBeVisible()
    await page.locator('[data-testid="delete-confirm"]').click()

    await expect(rowFor(page, probe)).toHaveCount(0)
    await expect(rows(page)).toHaveCount(before - 1)

    // Survives a reload: the row is gone from the database, not just from React
    // state. `handleDelete` updates local state on success, so an assertion that
    // never reloads would pass even if the server action had failed.
    await openList(page)
    await expect(rowFor(page, probe)).toHaveCount(0)
  })
})

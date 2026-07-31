import { test, expect, type Page } from '@playwright/test'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

/**
 * The order-detail editing capabilities, asserted by COGS DELTA.
 *
 * Written against the un-extracted page (CoffeeOS#70 Stage 0) so that Stage A's
 * extraction and Stage B's restyle both have something that can prove they
 * preserved behaviour.
 *
 * The visual baselines in baselines.spec.ts catch appearance and nothing else.
 * A control that renders perfectly and silently no-ops is pixel-identical to one
 * that works — that is the realistic failure mode of an extraction, and six
 * screenshots cannot see it. Without this file, Stage A's gate passes on a page
 * whose every handler is dead.
 *
 * So every test drives the real UI and asserts the money MOVED by exactly the
 * expected amount. `toHaveText` is deliberate: the mutations call
 * `router.refresh()`, so assertions must retry until the refresh settles rather
 * than read a stale value immediately after the click.
 *
 * Every test also RESTORES what it changed. These run against the same seeded
 * orders the baselines photograph, and a test that leaves a custom cost behind
 * would make those snapshots drift.
 *
 * `detail-cogs` / `detail-profit` are a test contract. The Instrument rebuild may
 * move, restyle or re-parent those figures but must carry the testids with them.
 */

// ── Fixtures ────────────────────────────────────────────────────────────────

/**
 * #1002 is COSTED, so COGS is a real number that can move. On an uncostable
 * order the figure reads "not set" or a partial, and profit is withheld — no
 * delta to assert.
 *
 * Seeded state: revenue $78.00, one line item (Cold Brew Blend 5lb, product
 * recipe $74.74), no order components, no custom costs.
 */
const ORDER = '#1002'
const BASE_COGS = 74.74
const BASE_PROFIT = 3.26

/**
 * "Roastery Labor" is $22.00/unit in scripts/seed-demo-account.mjs, chosen over
 * the other seeded components on purpose: it is EXACTLY representable at two
 * decimal places. "Roasted Coffee" is $0.032/g, which cannot be asserted to the
 * cent without the test encoding a rounding rule it does not own.
 */
const COMPONENT = 'Roastery Labor'
const COMPONENT_COST = 22.0

/**
 * The option's full visible text. `selectOption` matches a literal label — it
 * takes no RegExp — so this has to mirror how AddComponentRow renders it.
 * Deriving it from the two constants above keeps the coupling honest: change the
 * component or its cost and this follows, rather than silently failing to match.
 */
const COMPONENT_OPTION = `${COMPONENT} ($${COMPONENT_COST.toFixed(2)}/unit)`

const money = (n: number) => `−$${n.toFixed(2)}`
const profitText = (n: number) => `$${n.toFixed(2)}`

function orderPath(name: string): string {
  const file = path.join(__dirname, '..', 'fixtures', 'seeded-orders.json')
  if (!existsSync(file)) {
    throw new Error(
      `Missing ${file}. Run \`node scripts/seed-demo-account.mjs\` — it writes ` +
        `this fixture on the way out.`,
    )
  }
  const id = (JSON.parse(readFileSync(file, 'utf8')) as Record<string, string>)[name]
  expect(id, `${name} is missing from seeded-orders.json — re-run the seed`).toBeTruthy()
  return `/orders/${id}`
}

/**
 * The onboarding tour widget is `fixed bottom-4 right-4 z-50` and sits on top of
 * the lower-right of the page, swallowing clicks meant for the panels' Add
 * controls. Without this, every mutation test here times out on a button that
 * Playwright reports as visible, enabled and stable — because it is; the click
 * simply lands on the widget.
 *
 * Hidden with injected CSS rather than dismissed through its own X, matching
 * orders-capabilities.spec.ts: that button persists `hidden` to localStorage,
 * and this page IS a baseline screenshot. Styling one document in one test
 * context cannot leak; writing localStorage is a step towards a baseline diff
 * nobody would connect back to this file.
 */
async function hideOnboardingWidget(page: Page) {
  await page.addStyleTag({
    content: 'div.fixed.bottom-4.right-4.z-50 { display: none !important; }',
  })
}

async function openOrder(page: Page, name: string) {
  await page.goto(orderPath(name))
  await expect(page).not.toHaveURL(/\/auth\//)
  await expect(
    page.getByRole('heading', { name, exact: false }),
    `${name} did not render — the id fixture is probably stale; re-run the seed`,
  ).toBeVisible({ timeout: 20_000 })
  await hideOnboardingWidget(page)
}

const cogs = (page: Page) => page.getByTestId('detail-cogs')
const profit = (page: Page) => page.getByTestId('detail-profit')

/** The seeded starting point, asserted before AND after every mutation. */
async function expectBaseline(page: Page) {
  await expect(cogs(page)).toHaveText(money(BASE_COGS))
  await expect(profit(page)).toHaveText(profitText(BASE_PROFIT))
}

// ── Criterion 5: custom costs ───────────────────────────────────────────────

test('adding a custom cost moves COGS and profit by exactly that amount', async ({ page }) => {
  await openOrder(page, ORDER)
  await expectBaseline(page)

  // Stage B replaced the Radix dialog with an inline worksheet row: the
  // collapsed "Add cost" button expands the row in place, and the same label
  // submits it. Assertions below are unchanged — the interaction moved, the
  // behaviour did not, which is exactly what this suite exists to prove.
  await page.getByRole('button', { name: 'Add cost', exact: true }).click()
  await page.getByLabel('Description').fill('Capability probe')
  await page.getByLabel('Amount').fill('4.00')
  await page.getByRole('button', { name: 'Add cost', exact: true }).last().click()

  // Both figures, because they are two derivations over the same number and a
  // mutation must move both. Checking only COGS would miss profit going stale.
  await expect(cogs(page)).toHaveText(money(BASE_COGS + 4))
  await expect(profit(page)).toHaveText(profitText(BASE_PROFIT - 4))

  // Restore — see the note at the top about baseline drift.
  await page.getByRole('button', { name: 'Remove Capability probe' }).click()
  await page.getByRole('button', { name: 'Delete', exact: true }).click()
  await expectBaseline(page)
})

// ── Criterion 6: order components ───────────────────────────────────────────

test('adding and removing an order component moves COGS by exactly its cost', async ({ page }) => {
  await openOrder(page, ORDER)
  await expectBaseline(page)

  // Instrument's Select is a NATIVE <select>, so this is selectOption() rather
  // than clicking a listbox. Driving a native select any other way silently
  // does nothing.
  await page.getByRole('button', { name: 'Add component', exact: true }).click()
  await page.getByLabel('Component').selectOption({ label: COMPONENT_OPTION })
  await page.getByRole('button', { name: 'Add component', exact: true }).last().click()

  await expect(cogs(page)).toHaveText(money(BASE_COGS + COMPONENT_COST))
  await expect(profit(page)).toHaveText(profitText(BASE_PROFIT - COMPONENT_COST))

  await page.getByRole('button', { name: `Remove ${COMPONENT}` }).click()
  await page.getByRole('button', { name: 'Remove', exact: true }).click()
  await expectBaseline(page)
})

// ── Criterion 7: roasted coffee is NOT a cost ───────────────────────────────

/**
 * The one capability whose correct behaviour is that COGS does NOT move.
 *
 * Assigning roasted coffee draws down roasted stock; it never enters COGS. The
 * current page renders it in the same panel chrome as the three cost panels,
 * which is exactly why an extraction might wire it into the wrong total — and
 * why the assertion here is an equality, not a delta.
 */
/**
 * Cleanup drains the panel rather than removing "the row I added".
 *
 * Two reasons, the second learned the hard way. `getByText('100g')` is ambiguous
 * — the assignment row and the "Total Assigned" line both contain it — so a
 * targeted removal is a strict-mode violation waiting to happen. And when that
 * cleanup fails mid-test it leaves an assignment behind, which silently drifts
 * the #1002 baseline captured in baselines.spec.ts. Draining to empty is
 * idempotent: it repairs a dirty starting state instead of compounding it.
 *
 * It removes through the UI on purpose. `removeRoastedCoffeeFromOrder` returns
 * the grams to `green_coffee_inventory.roasted_stock_g`; deleting the row
 * directly would leave roasted stock permanently short.
 */
async function drainAssignedCoffee(page: Page) {
  const rows = page.getByTestId('coffee-assignment')
  // Bounded rather than `while` — a broken remove handler would otherwise spin
  // here until the test timeout, reporting nothing useful about why.
  for (let i = 0; i < 5 && (await rows.count()) > 0; i++) {
    const before = await rows.count()
    await rows.first().getByRole('button').click()
    await page.getByRole('button', { name: 'Remove', exact: true }).click()
    await expect(rows).toHaveCount(before - 1, { timeout: 10_000 })
  }
  await expect(rows).toHaveCount(0)
}

test('assigning roasted coffee does not change COGS', async ({ page }) => {
  await openOrder(page, ORDER)

  // Self-healing: a previous failed run may have left an assignment behind.
  await drainAssignedCoffee(page)
  await expectBaseline(page)

  // Stage B: the assign dialog became an inline row, and the picker is
  // Instrument's native <select>. Chosen by index rather than label because the
  // option text embeds a live stock figure that changes as tests run.
  await page.getByRole('button', { name: 'Pull coffee', exact: true }).click()
  await page.getByLabel('Roasted coffee').selectOption({ index: 1 })
  await page.getByLabel('Amount in grams').fill('100')
  await page.getByRole('button', { name: 'Pull coffee', exact: true }).last().click()

  await expect(page.locator('[data-testid="coffee-assignment"]')).toHaveCount(1)

  // THE ASSERTION. Roasted coffee draws down roasted stock; it is not a cost.
  // The current page renders it in the same panel chrome as the three cost
  // panels, which is exactly how an extraction could wire it into the wrong
  // total — so this is an equality, not a delta.
  await expectBaseline(page)

  await drainAssignedCoffee(page)
  await expectBaseline(page)
})

// ── Criterion 8: ready to ship ──────────────────────────────────────────────

test('toggling ready to ship flips the control and leaves the money alone', async ({ page }) => {
  await openOrder(page, ORDER)
  await expectBaseline(page)

  const markReady = page.getByRole('button', { name: /Mark ready to ship/i })
  const markNotReady = page.getByRole('button', { name: /Mark not ready/i })

  const startedReady = await markNotReady.isVisible()
  if (startedReady) {
    await markNotReady.click()
    await expect(markReady).toBeVisible()
    await markReady.click()
    await expect(markNotReady).toBeVisible()
  } else {
    await markReady.click()
    await expect(markNotReady).toBeVisible()
    await markNotReady.click()
    await expect(markReady).toBeVisible()
  }

  // Fulfillment state is not a cost. If this moves, something wired the toggle
  // into the costing path.
  await expectBaseline(page)
})

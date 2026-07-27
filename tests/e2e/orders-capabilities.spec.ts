import { test, expect, type Page, type Locator } from '@playwright/test'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'

/**
 * The six order-editing capabilities, asserted by COGS DELTA.
 *
 * Written against the known-good implementation (CoffeeOS#65 Stage A) so that
 * Stage B's restyle has something that can prove it preserved behaviour. The
 * visual baselines catch appearance; nothing catches a control that renders
 * perfectly and silently no-ops. That is the realistic failure mode of a
 * rewrite — a quantity field wired to a handler that never fires looks
 * identical in a screenshot and identical in a presence check.
 *
 * So every test here drives the real UI and asserts the money MOVED by exactly
 * the expected amount. `toHaveText` is used deliberately: the mutations call
 * `router.refresh()`, so the assertion must retry until the refresh settles
 * rather than read a stale value immediately after the click.
 *
 * Both figures are checked each time:
 *   - `row-cogs`   — this order's COGS, computed client-side
 *   - `stat-cogs`  — the whole-period aggregate, computed server-side
 * They are two independent code paths over the same data (see lib/orders/cogs),
 * and a mutation must move both by the same amount. Checking only one would
 * miss the aggregate silently drifting from the rows.
 */

// Desktop only — same reasoning as orders-query.spec.ts. The page still ships a
// duplicate `md:hidden` mobile rendering, so `order-row`/`row-cogs` exist only
// on the desktop table and the expanded panel is rendered TWICE (the mobile copy
// first in DOM order). Everything below scopes to `:visible` for that reason.
// Stage B deletes the duplicate rendering; this scoping can go with it.
test.describe.configure({ mode: 'default' })
test.skip(({ isMobile }) => !!isMobile, 'editing capabilities — desktop project only')

// ── Fixtures ────────────────────────────────────────────────────────────────

/**
 * "Roastery Labor" is $22.00/hour in scripts/seed-demo-account.mjs, chosen over
 * the other seeded components on purpose: its cost is EXACTLY representable at
 * two decimal places. "Roasted Coffee" is $0.032/g, which the UI renders as
 * "$0.03" — an expected delta derived from the displayed cost would then be
 * wrong by a fraction of a cent per unit and the assertions would be untestable
 * noise rather than an exact match.
 */
const COMPONENT = /^Roastery Labor/

/**
 * Ethiopia Yirgacheffe's only seeded roast request is `fulfilled`, and the
 * merge path in createRoastRequestForOrder only looks at pending/in_progress.
 * So requesting this coffee CREATES a row instead of mutating a seeded one —
 * which matters, because Guatemala Huehuetenango has an `in_progress` request
 * that a merge would silently edit and cleanup could not restore.
 */
const ROAST_COFFEE = /^Ethiopia Yirgacheffe/

const money = (s: string) => Number(s.replace(/[^0-9.-]/g, ''))
const usd = (n: number) => `$${n.toFixed(2)}`

// ── Cleanup safety net ──────────────────────────────────────────────────────

/**
 * Every test below undoes its own mutation through the UI, which is also how
 * capabilities 3 and 5 are exercised. This is the backstop for when one FAILS
 * part-way.
 *
 * It matters more than it looks: /orders and /roasting have full-page
 * screenshot baselines over live seeded data. A single component left behind
 * changes a COGS figure, and the next run fails a baseline for a reason that
 * has nothing to do with the code under test. Snapshotting row ids up front and
 * deleting only what appeared during the run keeps the suite re-runnable
 * without touching a single seeded row.
 */
const TRACKED = ['order_components', 'order_custom_costs', 'roast_requests'] as const

let admin: SupabaseClient | null = null
const preexisting = new Map<string, Set<string>>()

function loadEnvLocal() {
  const envPath = path.join(process.cwd(), '.env.local')
  if (!fs.existsSync(envPath)) return
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (!(key in process.env)) process.env[key] = value
  }
}

test.beforeAll(async () => {
  loadEnvLocal()
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  // Absent credentials must not fail the run — the per-test UI cleanup still
  // holds on the happy path. This is a backstop, not a dependency.
  if (!url || !key) return
  admin = createClient(url, key, { auth: { persistSession: false } })
  for (const table of TRACKED) {
    const { data } = await admin.from(table).select('id')
    preexisting.set(table, new Set((data ?? []).map((r) => r.id as string)))
  }
})

test.afterAll(async () => {
  if (!admin) return
  for (const table of TRACKED) {
    const seen = preexisting.get(table)
    if (!seen) continue
    const { data } = await admin.from(table).select('id')
    const strays = (data ?? []).map((r) => r.id as string).filter((id) => !seen.has(id))
    if (strays.length) await admin.from(table).delete().in('id', strays)
  }
})

// ── Page helpers ────────────────────────────────────────────────────────────

/** The expanded panel of the DESKTOP table. `:visible` is load-bearing: the
 *  mobile copy of this panel is earlier in the DOM and merely CSS-hidden, so
 *  `.first()` alone would drive a hidden tree and every click would fail. */
const panelOf = (page: Page) =>
  page.locator('[data-testid="order-expanded"]:visible').first()

const rowCogsOf = (page: Page) => page.getByTestId('row-cogs').first()
const statCogsOf = (page: Page) => page.getByTestId('stat-cogs')

/**
 * The onboarding tour widget is `fixed bottom-4 right-4 z-50` and sits on top of
 * the lower-right of the orders panel, swallowing clicks meant for the expanded
 * row's controls.
 *
 * It is hidden with injected CSS rather than dismissed through its own X: that
 * button persists `hidden` to localStorage, and the widget is part of the
 * /orders baseline screenshot. Styling one document in one test context cannot
 * leak anywhere; writing localStorage is a step towards a baseline diff nobody
 * would connect back to this file.
 */
async function hideOnboardingWidget(page: Page) {
  await page.addStyleTag({
    content: 'div.fixed.bottom-4.right-4.z-50 { display: none !important; }',
  })
}

async function openFirstOrder(page: Page) {
  await page.goto('/orders?period=365')
  await page.waitForLoadState('networkidle')
  await hideOnboardingWidget(page)

  const row = page.getByTestId('order-row').first()
  await expect(row).toBeVisible()
  await row.click()

  const panel = panelOf(page)
  await expect(panel).toBeVisible()
  return panel
}

/** Reads the two COGS figures currently on screen. */
async function readCogs(page: Page) {
  return {
    row: money(await rowCogsOf(page).innerText()),
    stat: money(await statCogsOf(page).innerText()),
  }
}

/** Asserts BOTH figures settled on `before + delta` after `router.refresh()`. */
async function expectCogsDelta(
  page: Page,
  before: { row: number; stat: number },
  delta: number
) {
  await expect(rowCogsOf(page), 'order COGS did not move by the expected amount')
    .toHaveText(usd(before.row + delta))
  await expect(statCogsOf(page), 'period COGS aggregate did not move with the row')
    .toHaveText(usd(before.stat + delta))
}

/**
 * Picks a component and returns its cost_per_unit, parsed from the option the
 * app itself renders ("Roastery Labor ($22.00/hour)"). Deriving the expected
 * delta from the app's own declared price — rather than hardcoding 22 — means
 * the test still asserts an exact figure if the seed's prices change.
 */
async function chooseComponent(page: Page, panel: Locator): Promise<number> {
  await panel.getByTestId('component-select').click()
  const option = page.getByRole('option', { name: COMPONENT })
  const label = await option.innerText()
  const unitCost = money(label.slice(label.indexOf('(')))
  expect(unitCost, `could not parse a unit cost from "${label}"`).toBeGreaterThan(0)
  await option.click()
  return unitCost
}

/** Adds a component at `qty` and returns its cost_per_unit. */
async function addComponent(page: Page, panel: Locator, qty: number): Promise<number> {
  await panel.getByTestId('add-component-open').click()
  const unitCost = await chooseComponent(page, panel)
  await panel.getByTestId('component-qty-input').fill(String(qty))
  await panel.getByTestId('component-add-submit').click()
  await expect(panel.getByTestId('order-component-row')).toHaveCount(1)
  return unitCost
}

async function removeAllComponents(page: Page, panel: Locator) {
  const rows = panel.getByTestId('order-component-row')
  for (let n = await rows.count(); n > 0; n--) {
    await rows.first().getByTestId('component-remove').click()
    await expect(rows).toHaveCount(n - 1)
  }
}

async function addCustomCost(page: Page, panel: Locator, label: string, amount: number) {
  await panel.getByTestId('add-custom-cost-open').click()
  await panel.getByTestId('custom-cost-description-input').fill(label)
  await panel.getByTestId('custom-cost-amount-input').fill(amount.toFixed(2))
  await panel.getByTestId('custom-cost-add-submit').click()
  await expect(panel.getByTestId('custom-cost-row')).toHaveCount(1)
}

async function removeAllCustomCosts(page: Page, panel: Locator) {
  const rows = panel.getByTestId('custom-cost-row')
  for (let n = await rows.count(); n > 0; n--) {
    await rows.first().getByTestId('custom-cost-remove').click()
    await expect(rows).toHaveCount(n - 1)
  }
}

// ── The six capabilities ────────────────────────────────────────────────────

test.describe('order editing capabilities survive by COGS delta', () => {
  test('1 — adding a component raises COGS by cost_per_unit × quantity', async ({ page }) => {
    const panel = await openFirstOrder(page)
    const before = await readCogs(page)

    const qty = 2
    const unitCost = await addComponent(page, panel, qty)

    await expectCogsDelta(page, before, unitCost * qty)

    await removeAllComponents(page, panel)
    await expectCogsDelta(page, before, 0)
  })

  test('2 — updating quantity moves COGS by the quantity delta', async ({ page }) => {
    const panel = await openFirstOrder(page)
    const before = await readCogs(page)

    // Setup: one unit on the order, its cost already reflected in both figures.
    const unitCost = await addComponent(page, panel, 1)
    await expectCogsDelta(page, before, unitCost)

    // The capability under test: 1 → 2 must be worth exactly one more unit.
    await panel.getByTestId('component-qty-increment').click()
    await expect(panel.getByTestId('component-qty-value')).toHaveText('2')
    await expectCogsDelta(page, before, unitCost * 2)

    await removeAllComponents(page, panel)
    await expectCogsDelta(page, before, 0)
  })

  test('3 — removing a component drops COGS by exactly its contribution', async ({ page }) => {
    const panel = await openFirstOrder(page)
    const before = await readCogs(page)

    const qty = 3
    const unitCost = await addComponent(page, panel, qty)
    await expectCogsDelta(page, before, unitCost * qty)

    await removeAllComponents(page, panel)
    await expectCogsDelta(page, before, 0)
  })

  test('4 — adding a custom cost raises COGS by the amount entered', async ({ page }) => {
    const panel = await openFirstOrder(page)
    const before = await readCogs(page)

    const amount = 12.34
    await addCustomCost(page, panel, 'E2E gift wrap', amount)
    await expectCogsDelta(page, before, amount)

    await removeAllCustomCosts(page, panel)
    await expectCogsDelta(page, before, 0)
  })

  test('5 — removing a custom cost drops COGS by that amount', async ({ page }) => {
    const panel = await openFirstOrder(page)
    const before = await readCogs(page)

    const amount = 7.5
    await addCustomCost(page, panel, 'E2E expedited shipping', amount)
    await expectCogsDelta(page, before, amount)

    await removeAllCustomCosts(page, panel)
    await expectCogsDelta(page, before, 0)
  })

  test('6 — the roast request dialog opens and submits', async ({ page }) => {
    // Success and failure are BOTH reported through window.alert() here, so the
    // message is the only signal that the server action actually succeeded —
    // a closed dialog alone would also be consistent with an error path.
    const alerts: string[] = []
    page.on('dialog', async (d) => {
      alerts.push(d.message())
      await d.accept()
    })

    const panel = await openFirstOrder(page)
    const before = await readCogs(page)

    await panel.getByTestId('roast-request-open').click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()

    await dialog.getByTestId('roast-coffee-select').click()
    await page.getByRole('option', { name: ROAST_COFFEE }).click()
    await dialog.getByTestId('roast-quantity-input').fill('137')

    const submit = dialog.getByTestId('roast-request-submit')
    await expect(submit).toBeEnabled()
    await submit.click()

    // The flow completed: dialog dismissed and the action reported success.
    await expect(dialog).toBeHidden()
    await expect
      .poll(() => alerts.join(' | '), { message: 'no success alert from the roast request' })
      .toMatch(/Roast request created|Added .* to existing roast request/i)

    // A roast request is not a cost, so it must NOT move COGS. Asserting the
    // delta is zero is what makes this a real check rather than a smoke test.
    await expectCogsDelta(page, before, 0)
  })
})

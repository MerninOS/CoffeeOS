import { test, expect, type Page } from '@playwright/test'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { demoAccount, loadEnvLocal } from './support/env'

/**
 * The green-inventory editing capabilities, asserted by QUANTITY AND VALUE DELTA.
 *
 * Written against the known-good loud-Mernin' implementation (CoffeeOS#72
 * Stage 1) so the conversion has something that can prove it preserved
 * behaviour. The visual baselines catch appearance; nothing catches a control
 * that renders perfectly and silently no-ops. That is the realistic failure mode
 * of a rewrite — a quantity field wired to a handler that never fires looks
 * identical in a screenshot and identical in a presence check.
 *
 * So every test drives the real UI and asserts the figures MOVED by exactly the
 * expected amount. `toHaveText` is used deliberately: the mutation handlers call
 * `window.location.reload()` today and will call `router.refresh()` after
 * Stage 4, so the assertion must retry until the refresh settles rather than
 * read a stale value immediately after the click. That is also why these
 * assertions survive the Stage 4 change of refresh mechanism unmodified.
 *
 * Two figures are checked on every mutation:
 *   - `lot-green` / `lot-value`   — the row, computed per lot
 *   - `stat-green` / `stat-value` — the header aggregate, computed over the list
 * A mutation must move both. Checking only the row would miss the aggregate
 * silently drifting.
 */

// DESKTOP ONLY, for now. The page still ships a duplicate `md:hidden` card
// rendering, so at 375 the tagged desktop table is present but display:none and
// cannot be clicked. Stage 4 deletes that duplicate and makes the one worksheet
// stack — remove this skip then, exactly as `/orders` did, so the mobile project
// exercises the stacked worksheet for real.
test.skip(
  ({ isMobile }) => !!isMobile,
  'the duplicate md:hidden tree is still present; Stage 4 removes it and this skip',
)

const LBS_TO_GRAMS = 453.592

let admin: SupabaseClient | undefined
let ownerId: string | undefined
const createdLotIds = new Set<string>()

/**
 * Strict money/quantity parser. It THROWS on a non-numeric string rather than
 * coercing, because `Number("".replace(...))` is 0 — so a lenient parser reads a
 * missing figure as a real zero and every delta assertion silently passes.
 */
function num(text: string | null): number {
  const cleaned = (text ?? '').replace(/[^0-9.-]/g, '')
  if (cleaned === '' || Number.isNaN(Number(cleaned))) {
    throw new Error(`expected a numeric figure, got ${JSON.stringify(text)}`)
  }
  return Number(cleaned)
}

test.beforeAll(async () => {
  loadEnvLocal()
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error(
      'inventory-capabilities needs SUPABASE_SERVICE_ROLE_KEY to seed and clean its own lots',
    )
  }
  admin = createClient(url, key, { auth: { persistSession: false } })

  const { email } = demoAccount()
  const { data } = await admin.auth.admin.listUsers()
  ownerId = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())?.id
  if (!ownerId) {
    throw new Error(
      `${email} not found — run \`node scripts/seed-demo-account.mjs\` in this worktree. ` +
        `Each worktree owns its own demo account (see tests/e2e/support/env.ts).`,
    )
  }
})

/**
 * Every test operates on its OWN lot rather than a seeded one.
 *
 * The seeded lots are shared with the baseline screenshots and with
 * inventory-movements; mutating them here would make this file's success
 * dependent on execution order and would move an unrelated snapshot.
 */
async function makeLot(name: string, lbs: number, pricePerLb: number) {
  const grams = lbs * LBS_TO_GRAMS
  const { data, error } = await admin!
    .from('green_coffee_inventory')
    .insert({
      user_id: ownerId,
      name,
      origin: 'Testland',
      lot_code: 'QA-0001',
      supplier: 'QA Supplier',
      price_per_lb: pricePerLb,
      initial_quantity_g: grams,
      current_green_quantity_g: grams,
      roasted_stock_g: 0,
      purchase_date: '2026-01-01',
      notes: null,
    })
    .select('id')
    .single()
  if (error || !data) throw new Error(`failed to seed lot: ${error?.message}`)
  createdLotIds.add(data.id)
  return data.id as string
}

test.afterAll(async () => {
  if (!admin || createdLotIds.size === 0) return
  const ids = [...createdLotIds]
  await admin.from('coffee_inventory_changes').delete().in('coffee_id', ids)
  await admin.from('green_coffee_inventory').delete().in('id', ids)
  // Lots added through the UI carry no id we captured, so sweep by the marker
  // name this file uses exclusively.
  const { data: strays } = await admin!
    .from('green_coffee_inventory')
    .select('id')
    .eq('user_id', ownerId)
    .like('name', 'QA Capability%')
  const strayIds = (strays ?? []).map((r) => r.id as string)
  if (strayIds.length) {
    await admin.from('coffee_inventory_changes').delete().in('coffee_id', strayIds)
    await admin.from('green_coffee_inventory').delete().in('id', strayIds)
  }
})

// ── Page helpers ────────────────────────────────────────────────────────────

const rowFor = (page: Page, name: string) =>
  page.locator('[data-testid="lot-row"]').filter({ has: page.locator(`text="${name}"`) })

const greenOf = (page: Page, name: string) =>
  rowFor(page, name).locator('[data-testid="lot-green"]')
const valueOf = (page: Page, name: string) =>
  rowFor(page, name).locator('[data-testid="lot-value"]')

const statGreen = (page: Page) => page.getByTestId('stat-green')
const statValue = (page: Page) => page.getByTestId('stat-value')

async function openInventory(page: Page) {
  await page.goto('/inventory')
  await expect(page).not.toHaveURL(/\/auth\//)
  await expect(page.getByRole('heading', { name: /coffee inventory/i })).toBeVisible()
}

/** Opens a lot's Adjust dialog by its row's scale button. */
async function openAdjust(page: Page, name: string) {
  await rowFor(page, name).getByTitle('Adjust quantity').click()
  await expect(page.getByTestId('adjust-dialog')).toBeVisible()
}

// ── Tests ───────────────────────────────────────────────────────────────────

test.describe('green inventory editing capabilities', () => {
  test('adding a lot moves the green total by the quantity entered', async ({ page }) => {
    const name = `QA Capability Add ${Date.now()}`
    await openInventory(page)

    const before = num(await statGreen(page).textContent())

    await page.getByRole('button', { name: /add coffee/i }).click()
    await expect(page.getByTestId('lot-form-dialog')).toBeVisible()
    await page.locator('#name').fill(name)
    await page.locator('#origin').fill('Testland')
    await page.locator('#price_per_lb').fill('10')
    await page.locator('#quantity_lbs').fill('25')
    await page.getByRole('button', { name: /^add coffee$/i }).click()

    await expect(greenOf(page, name)).toHaveText(/25\.0 lbs/)
    await expect(valueOf(page, name)).toHaveText('$250.00')
    await expect(statGreen(page)).toHaveText(`${(before + 25).toFixed(1)} lbs`)
  })

  test('editing the price moves the lot value and the inventory value', async ({ page }) => {
    const name = `QA Capability Price ${Date.now()}`
    await makeLot(name, 10, 10)
    await openInventory(page)

    await expect(valueOf(page, name)).toHaveText('$100.00')
    const beforeValue = num(await statValue(page).textContent())

    await rowFor(page, name).getByTitle('Edit').click()
    await expect(page.getByTestId('lot-form-dialog')).toBeVisible()
    await page.locator('#price_per_lb').fill('20')
    await page.getByRole('button', { name: /save changes/i }).click()

    // The quantity is untouched, so the value must exactly double.
    await expect(valueOf(page, name)).toHaveText('$200.00')
    await expect(statValue(page)).toHaveText(`$${(beforeValue + 100).toFixed(2)}`)
  })

  test('a manual adjustment adds green stock', async ({ page }) => {
    const name = `QA Capability Up ${Date.now()}`
    await makeLot(name, 10, 10)
    await openInventory(page)

    const before = num(await statGreen(page).textContent())
    await openAdjust(page, name)

    // manual_green_adjust is the default reason, so no select interaction.
    await page.locator('#adjust_quantity').fill('2')
    await page.getByRole('button', { name: /apply adjustment/i }).click()

    await expect(greenOf(page, name)).toHaveText(/12\.0 lbs/)
    await expect(valueOf(page, name)).toHaveText('$120.00')
    await expect(statGreen(page)).toHaveText(`${(before + 2).toFixed(1)} lbs`)
  })

  test('a roast deduction removes green stock', async ({ page }) => {
    const name = `QA Capability Down ${Date.now()}`
    await makeLot(name, 10, 10)
    await openInventory(page)

    const before = num(await statGreen(page).textContent())
    await openAdjust(page, name)

    // The reason drives a SIGN INVERSION in the handler (`-Math.abs(qty)` for
    // anything that is not a manual adjust). Entering a positive 3 here and
    // expecting 7.0 lbs is the assertion that catches a rewrite dropping it.
    await page.getByTestId('adjust-dialog').getByRole('combobox').click()
    await page.getByRole('option', { name: /roast \(deduct stock\)/i }).click()
    await page.locator('#adjust_quantity').fill('3')
    await page.getByRole('button', { name: /apply adjustment/i }).click()

    await expect(greenOf(page, name)).toHaveText(/7\.0 lbs/)
    await expect(valueOf(page, name)).toHaveText('$70.00')
    await expect(statGreen(page)).toHaveText(`${(before - 3).toFixed(1)} lbs`)
  })

  test('deleting a lot removes its row and its stock from the total', async ({ page }) => {
    const name = `QA Capability Delete ${Date.now()}`
    await makeLot(name, 10, 10)
    await openInventory(page)

    const before = num(await statGreen(page).textContent())

    // Playwright auto-DISMISSES dialogs, so without this handler window.confirm
    // returns false and the delete never runs — the test would then pass only
    // because the row it expected to survive did.
    page.on('dialog', (d) => d.accept())
    await rowFor(page, name).getByTitle('Delete').click()

    await expect(rowFor(page, name)).toHaveCount(0)
    await expect(statGreen(page)).toHaveText(`${(before - 10).toFixed(1)} lbs`)
  })

  test('deducting more than the lot holds is refused and writes nothing', async ({ page }) => {
    const name = `QA Capability Refuse ${Date.now()}`
    const lotId = await makeLot(name, 4, 10)
    await openInventory(page)

    const messages: string[] = []
    page.on('dialog', (d) => {
      messages.push(d.message())
      return d.accept()
    })

    await openAdjust(page, name)
    await page.getByTestId('adjust-dialog').getByRole('combobox').click()
    await page.getByRole('option', { name: /roast \(deduct stock\)/i }).click()
    await page.locator('#adjust_quantity').fill('999')
    await page.getByRole('button', { name: /apply adjustment/i }).click()

    await expect.poll(() => messages.join(' ')).toMatch(/insufficient inventory/i)

    // The figure must be untouched...
    await openInventory(page)
    await expect(greenOf(page, name)).toHaveText(/4\.0 lbs/)

    // ...and, critically, NO change row may have been written. A handler that
    // refuses in the UI but has already logged the movement would pass every
    // on-screen assertion above.
    const { data: rows } = await admin!
      .from('coffee_inventory_changes')
      .select('id')
      .eq('coffee_id', lotId)
    expect(rows ?? []).toHaveLength(0)
  })
})

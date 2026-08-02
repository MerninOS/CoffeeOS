import { test, expect, type Page } from '@playwright/test'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { demoAccount, loadEnvLocal } from './support/env'

/**
 * The lot movement panel (CoffeeOS#72 Criteria 13, 14, 14a, 15, 16, 17a).
 *
 * `coffee_inventory_changes` has been written since the feature shipped and read
 * by nothing, so unlike the capability specs there is no prior behaviour to
 * preserve here — these assert the panel tells the truth about a table nobody
 * has looked at.
 *
 * Several assertions are about what must NOT appear. The panel's whole claim is
 * that it explains where the coffee went, so a fabricated batch code or a
 * silently truncated list is worse than a missing one.
 */

test.skip(
  ({ isMobile }) => !!isMobile,
  'the panel is asserted once; the worksheet reflow is covered by the capability spec',
)

let admin: SupabaseClient | undefined
let ownerId: string | undefined
const createdLotIds = new Set<string>()

const LBS_TO_GRAMS = 453.592

test.beforeAll(async () => {
  loadEnvLocal()
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('inventory-movements needs SUPABASE_SERVICE_ROLE_KEY')
  admin = createClient(url, key, { auth: { persistSession: false } })

  const { email } = demoAccount()
  const { data } = await admin.auth.admin.listUsers()
  ownerId = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())?.id
  if (!ownerId) throw new Error(`${email} not found — run scripts/seed-demo-account.mjs`)
})

test.afterAll(async () => {
  if (!admin || createdLotIds.size === 0) return
  const ids = [...createdLotIds]
  await admin.from('coffee_inventory_changes').delete().in('coffee_id', ids)
  await admin.from('green_coffee_inventory').delete().in('id', ids)
})

/** Its own lot, so the seeded fixtures the baselines screenshot stay untouched. */
async function makeLot(name: string, lbs: number) {
  const grams = lbs * LBS_TO_GRAMS
  const { data, error } = await admin!
    .from('green_coffee_inventory')
    .insert({
      user_id: ownerId,
      name,
      origin: 'Testland',
      lot_code: 'QA-MOVE',
      supplier: 'QA Supplier',
      price_per_lb: 10,
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

async function addChange(
  coffeeId: string,
  over: Record<string, unknown> = {},
) {
  const { error } = await admin!.from('coffee_inventory_changes').insert({
    coffee_id: coffeeId,
    user_id: ownerId,
    changed_by_user_id: ownerId,
    change_type: 'roast_deduct',
    green_quantity_change_g: -8 * LBS_TO_GRAMS,
    reference_type: 'roasting_batch',
    ...over,
  })
  if (error) throw new Error(`failed to seed change: ${error.message}`)
}

const rowFor = (page: Page, name: string) =>
  page.locator('[data-testid="lot-row"]').filter({ has: page.locator(`text="${name}"`) })

async function openInventory(page: Page) {
  await page.goto('/inventory')
  await expect(page).not.toHaveURL(/\/auth\//)
  await expect(page.getByRole('heading', { name: /green inventory/i })).toBeVisible()
}

test.describe('lot movements', () => {
  test('the panel is not fetched until a lot is expanded', async ({ page }) => {
    const name = `QA Move Lazy ${Date.now()}`
    const id = await makeLot(name, 20)
    await addChange(id)

    // Next server actions POST to the current URL carrying a `next-action`
    // header, so counting those separates "the page rendered" from "an action
    // ran" — which is the actual claim of Criterion 13.
    let actionCalls = 0
    page.on('request', (r) => {
      if (r.method() === 'POST' && r.headers()['next-action']) actionCalls += 1
    })

    await openInventory(page)
    await expect(page.getByTestId('lot-expanded')).toHaveCount(0)
    expect(actionCalls, 'no movement query on page load').toBe(0)

    await rowFor(page, name).getByRole('button', { name: new RegExp(`Expand ${name}`) }).click()
    await expect(page.getByTestId('lot-expanded')).toBeVisible()
    await expect(page.getByTestId('movement-row')).toHaveCount(1)
    expect(actionCalls, 'exactly one query, on expand').toBe(1)
  })

  test('a movement names its cause without inventing an identifier', async ({ page }) => {
    const name = `QA Move Source ${Date.now()}`
    const id = await makeLot(name, 20)
    await addChange(id, { notes: 'Moisture loss on the pallet' })
    await openInventory(page)

    await rowFor(page, name).getByRole('button', { name: new RegExp(`Expand ${name}`) }).click()
    const panel = page.getByTestId('lot-expanded')
    await expect(panel).toBeVisible()

    // roasting_batches carries no batch number, so the source must read
    // "Roast batch" with no code — and never a raw UUID.
    await expect(panel).toContainText('Roast batch')
    await expect(panel).not.toContainText(/BR-\d/)
    await expect(panel).not.toContainText(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}/i)

    await expect(panel).toContainText('Moisture loss on the pallet')
    // The actor is never blank: a readable profile gives a name, an unreadable
    // one falls back to "Owner" (Criterion 14a).
    await expect(panel).toContainText(/Demo User|Owner/)
  })

  test('a delta is signed exactly once', async ({ page }) => {
    const name = `QA Move Sign ${Date.now()}`
    const id = await makeLot(name, 60)
    await addChange(id, {
      change_type: 'initial',
      green_quantity_change_g: 50 * LBS_TO_GRAMS,
      reference_type: 'manual',
    })
    await addChange(id)
    await openInventory(page)

    await rowFor(page, name).getByRole('button', { name: new RegExp(`Expand ${name}`) }).click()
    const deltas = page.getByTestId('movement-delta')
    await expect(deltas).toHaveCount(2)

    const text = (await deltas.allTextContents()).join(' ')
    expect(text).toContain('−8.0 lb')
    expect(text).toContain('+50.0 lb')
    // The literal that catches a hard-coded sign: `−$-5.00` reached production
    // on /orders exactly this way.
    expect(text).not.toContain('−-')
    expect(text).not.toContain('--')
  })

  test('the panel says it is green-only and why', async ({ page }) => {
    const name = `QA Move Note ${Date.now()}`
    const id = await makeLot(name, 20)
    await addChange(id)
    await openInventory(page)

    await rowFor(page, name).getByRole('button', { name: new RegExp(`Expand ${name}`) }).click()
    const panel = page.getByTestId('lot-expanded')
    await expect(panel).toContainText(/green movements/i)
    // "never writes a change row" — NOT "there is no column".
    // coffee_inventory_changes.roasted_quantity_change_g exists; the two call
    // sites simply skip it, and misdescribing that misleads whoever fixes it.
    await expect(panel).toContainText(/neither writes a change row/i)
  })

  test('a truncated history says so', async ({ page }) => {
    const name = `QA Move Trunc ${Date.now()}`
    const id = await makeLot(name, 400)
    // 21 rows against a cap of 20.
    for (let i = 0; i < 21; i += 1) await addChange(id)
    await openInventory(page)

    await rowFor(page, name).getByRole('button', { name: new RegExp(`Expand ${name}`) }).click()
    await expect(page.getByTestId('movement-row')).toHaveCount(20)
    await expect(page.getByTestId('movements-truncated')).toBeVisible()
  })

  test('editing the price records a cost change; editing anything else does not', async ({
    page,
  }) => {
    const name = `QA Move Price ${Date.now()}`
    const id = await makeLot(name, 20)
    await openInventory(page)

    // A supplier-only edit must write NOTHING. A log that records non-events is
    // one an operator learns to skim (Criterion 22).
    await rowFor(page, name).getByTitle('Edit').click()
    await expect(page.getByTestId('lot-form-dialog')).toBeVisible()
    await page.locator('#supplier').fill('Someone Else')
    await page.getByRole('button', { name: /save changes/i }).click()
    await expect(page.getByTestId('lot-form-dialog')).toHaveCount(0)

    const { data: afterSupplier } = await admin!
      .from('coffee_inventory_changes')
      .select('id')
      .eq('coffee_id', id)
    expect(afterSupplier ?? [], 'a supplier edit is not a cost change').toHaveLength(0)

    // The price moving DOES write one row, rendering old -> new with no pound
    // delta, and it is not counted toward any quantity total (Criterion 23).
    await rowFor(page, name).getByTitle('Edit').click()
    await page.locator('#price_per_lb').fill('20')
    await page.getByRole('button', { name: /save changes/i }).click()
    await expect(page.getByTestId('lot-form-dialog')).toHaveCount(0)

    const { data: afterPrice } = await admin!
      .from('coffee_inventory_changes')
      .select('change_type, old_price_per_lb, new_price_per_lb')
      .eq('coffee_id', id)
    expect(afterPrice ?? []).toHaveLength(1)
    expect(afterPrice![0].change_type).toBe('price_change')
    expect(Number(afterPrice![0].old_price_per_lb)).toBeCloseTo(10, 4)
    expect(Number(afterPrice![0].new_price_per_lb)).toBeCloseTo(20, 4)

    await rowFor(page, name).getByRole('button', { name: new RegExp(`Expand ${name}`) }).click()
    const panel = page.getByTestId('lot-expanded')
    await expect(panel).toContainText('Cost change')
    await expect(page.getByTestId('movement-delta').first()).toHaveText('$10.00 → $20.00')
    // A cost change carries no pound delta at all.
    await expect(page.getByTestId('movement-delta').first()).not.toContainText('lb')
  })

  test('an open lot refetches its movements after its own adjustment', async ({ page }) => {
    const name = `QA Move Refetch ${Date.now()}`
    const id = await makeLot(name, 20)
    await addChange(id)
    await openInventory(page)

    await rowFor(page, name).getByRole('button', { name: new RegExp(`Expand ${name}`) }).click()
    await expect(page.getByTestId('movement-row')).toHaveCount(1)

    // Criterion 17a. router.refresh() re-renders the SERVER component but does
    // not re-run a client-invoked server action, so without an explicit
    // invalidation the panel would keep showing the state before this
    // adjustment — on the one surface whose entire job is provenance.
    await rowFor(page, name).getByTitle('Adjust quantity').click()
    await expect(page.getByTestId('adjust-dialog')).toBeVisible()
    await page.locator('#adjust_quantity').fill('3')
    await page.locator('#adjust_notes').fill('Refetch marker')
    await page.getByRole('button', { name: /apply adjustment/i }).click()

    // The row stays expanded AND the new movement is at position one. Asserting
    // the COUNT alone would pass against a stale list; asserting the content at
    // position one is what makes this test about the refetch.
    await expect(page.getByTestId('lot-expanded')).toBeVisible()
    await expect(page.getByTestId('movement-row')).toHaveCount(2)
    await expect(page.getByTestId('movement-row').first()).toContainText('Refetch marker')
    await expect(page.getByTestId('movement-delta').first()).toHaveText('+3.0 lb')
  })
})

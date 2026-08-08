import { test, expect } from '@playwright/test'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'

/**
 * The processing-fee display states, end to end (CoffeeOS#133).
 *
 * The unit suite pins the fee MATH (order-fees, cogs, order-detail-costing);
 * what nothing else proves is the wiring: that the columns flow from the query
 * through the components and render the right state markers. Three states,
 * three tests:
 *
 *   unknown    — the seeded demo orders were inserted by the seed script, not
 *                synced, so their fee columns are null. The genuine
 *                pre-backfill condition, asserted as found.
 *   estimated  — written to one seeded order via the admin client (the
 *                orders-capabilities pattern), asserted on the detail page,
 *                restored to null in `finally` so the screenshot baselines
 *                over this same seeded data never see it.
 *   actual     — same, and additionally must NOT carry the ~ prefix: the
 *                tilde is the estimate's marker, and leaking it onto actual
 *                figures would erase the distinction AC 7 requires.
 */

const ORDER_NAME = '#0902'

function orderIdFromFixture(name: string): string {
  const file = path.join(__dirname, '..', 'fixtures', 'seeded-orders.json')
  if (!fs.existsSync(file)) {
    throw new Error(
      `Missing ${file}. Run \`node scripts/seed-demo-account.mjs\` — it writes ` +
        `this fixture on the way out.`,
    )
  }
  const id = (JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, string>)[name]
  expect(id, `${name} is missing from seeded-orders.json — re-run the seed`).toBeTruthy()
  return id
}

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

let admin: SupabaseClient | null = null

test.beforeAll(() => {
  loadEnvLocal()
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return
  admin = createClient(url, key, { auth: { persistSession: false } })
})

async function setFee(
  orderId: string,
  fee: number | null,
  source: 'actual' | 'estimated' | null,
) {
  const { error } = await admin!
    .from('orders')
    .update({ total_processing_fee: fee, processing_fee_source: source })
    .eq('id', orderId)
  expect(error).toBeNull()
}

// The backstop for a mid-test failure: baselines.spec.ts screenshots this
// seeded data, and a stray fee left behind fails a baseline for a reason
// nobody would connect back to this file.
test.afterAll(async () => {
  if (!admin) return
  await setFee(orderIdFromFixture(ORDER_NAME), null, null)
})

test('a never-synced order shows its fee as not synced, not as $0', async ({ page }) => {
  await page.goto('/orders')
  await expect(page).not.toHaveURL(/\/auth\//)

  const row = page.getByTestId('order-row').first()
  await expect(row).toBeVisible()
  await row.click()

  const fee = page.getByTestId('order-expanded').first().getByTestId('processing-fee')
  await expect(fee).toBeVisible()
  await expect(fee).toHaveAttribute('data-state', 'unknown')
  await expect(fee).toHaveText('not synced')
})

test('an estimated fee renders with the ~ prefix on the detail worksheet', async ({ page }) => {
  test.skip(!admin, 'no service-role credentials in this environment')
  const orderId = orderIdFromFixture(ORDER_NAME)
  try {
    await setFee(orderId, 1.03, 'estimated')
    await page.goto(`/orders/${orderId}`)
    await expect(page).not.toHaveURL(/\/auth\//)

    const fee = page.getByTestId('detail-processing-fee')
    await expect(fee).toBeVisible()
    await expect(fee).toHaveAttribute('data-state', 'estimated')
    await expect(fee).toHaveText('~$1.03')
  } finally {
    await setFee(orderId, null, null)
  }
})

test('an actual fee renders plain — no tilde', async ({ page }) => {
  test.skip(!admin, 'no service-role credentials in this environment')
  const orderId = orderIdFromFixture(ORDER_NAME)
  try {
    await setFee(orderId, 1.41, 'actual')
    await page.goto(`/orders/${orderId}`)
    await expect(page).not.toHaveURL(/\/auth\//)

    const fee = page.getByTestId('detail-processing-fee')
    await expect(fee).toBeVisible()
    await expect(fee).toHaveAttribute('data-state', 'actual')
    await expect(fee).toHaveText('$1.41')
  } finally {
    await setFee(orderId, null, null)
  }
})

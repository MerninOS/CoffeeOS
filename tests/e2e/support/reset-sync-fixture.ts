import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import path from 'node:path'

/**
 * Puts the demo account back to a known state for the sync-review specs.
 *
 * These specs WRITE, unlike the rest of the suite. Two things make that
 * dangerous without a reset:
 *
 *  - playwright.config.ts runs two viewport projects over the same file against
 *    ONE database, so the mobile pass would otherwise inherit everything the
 *    desktop pass imported and every "must not be present" assertion would fail.
 *  - a second local run would start from the first run's leftovers.
 *
 * Scope is deliberately narrow: the fixture-only products (90000000xx) and the
 * owner's exclusions. It does NOT restore the seeded 100000000x products,
 * because the specs never import those — importing a seeded product would
 * overwrite the very values that make it read as CHANGED, and the Changed group
 * would be empty on every subsequent run. That constraint is load-bearing; if a
 * spec here ever needs to import a seeded product, this helper has to grow a
 * restore step first.
 */

const FIXTURE_ONLY_SHOPIFY_IDS = ['9000000001', '9000000002', '9000000003']

function env(): { url: string; serviceRoleKey: string } {
  // The Playwright process does not load .env.local the way Next does.
  const raw = readFileSync(path.join(process.cwd(), '.env.local'), 'utf8')
  const parsed = Object.fromEntries(
    raw
      .split('\n')
      .filter((line) => line.trim() && !line.trim().startsWith('#'))
      .map((line) => {
        const eq = line.indexOf('=')
        if (eq === -1) return null
        const key = line.slice(0, eq).trim()
        let value = line.slice(eq + 1).trim()
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1)
        }
        return [key, value] as const
      })
      .filter((entry): entry is readonly [string, string] => entry !== null)
  )

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? parsed.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? parsed.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    throw new Error(
      'reset-sync-fixture needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY ' +
        '(from the environment or .env.local).'
    )
  }

  return { url, serviceRoleKey }
}

export async function resetSyncFixture(): Promise<void> {
  const { url, serviceRoleKey } = env()

  // This deletes rows with a SERVICE ROLE key, which bypasses RLS entirely. The
  // only thing standing between it and a real account is which project the URL
  // points at, so refuse to run unless the account it resolves is the demo one.
  const email = process.env.DEMO_EMAIL ?? 'demo@coffeeos.io'

  const admin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Resolve the demo account FIRST, then look for its seeded product — not the
  // other way round.
  //
  // This used to resolve the owner from `products.shopify_id = '1000000005'`
  // with no account filter, on the reasonable assumption that exactly one demo
  // account exists. Per-worktree demo accounts (CoffeeOS#106) broke that: the
  // seed creates the same fixed shopify_ids for EVERY demo account, so an
  // unscoped `.limit(1)` returns whichever row it happens to hit, and the guard
  // below then correctly refuses to delete another account's data. Two worktrees
  // could never both run this spec.
  //
  // The safety property is unchanged and is why this order matters: we only ever
  // delete rows owned by the account named in DEMO_EMAIL. Deriving the owner
  // from that email rather than from a global row makes that true by
  // construction instead of by check.
  const { data: users, error: usersError } = await admin.auth.admin.listUsers()
  if (usersError) {
    throw new Error(`reset-sync-fixture could not list accounts: ${usersError.message}`)
  }
  const demoUser = users.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())
  if (!demoUser) {
    throw new Error(
      `reset-sync-fixture found no account for ${email}. ` +
        'Run `node scripts/seed-demo-account.mjs` first.'
    )
  }
  const ownerId = demoUser.id

  // Scoped to that owner: proves the seed ran FOR THIS ACCOUNT, which is the
  // thing the old global lookup could not tell you.
  const { data: seeded, error: seededError } = await admin
    .from('products')
    .select('id')
    .eq('shopify_id', '1000000005')
    .eq('user_id', ownerId)
    .limit(1)
    .maybeSingle()

  if (seededError) {
    throw new Error(`reset-sync-fixture could not read the demo account: ${seededError.message}`)
  }
  if (!seeded) {
    throw new Error(
      `reset-sync-fixture found no seeded product 1000000005 for ${email}. ` +
        'Run `node scripts/seed-demo-account.mjs` in this worktree first.'
    )
  }

  // product_variants cascades from products, so deleting the products is enough.
  const { error: productsError } = await admin
    .from('products')
    .delete()
    .eq('user_id', ownerId)
    .in('shopify_id', FIXTURE_ONLY_SHOPIFY_IDS)

  if (productsError) {
    throw new Error(`reset-sync-fixture could not clear products: ${productsError.message}`)
  }

  const { error: exclusionsError } = await admin
    .from('shopify_product_exclusions')
    .delete()
    .eq('user_id', ownerId)

  if (exclusionsError) {
    throw new Error(`reset-sync-fixture could not clear exclusions: ${exclusionsError.message}`)
  }
}

import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { loadEnvLocal, roasterAccount } from './support/env'

/**
 * The /settings editing capabilities, asserted by SERVER-OBSERVED EFFECT.
 *
 * Written against the un-extracted page (CoffeeOS#74 Stage 0b) so that Stage A's
 * extraction and Stage B's restyle both have something that can prove they
 * preserved behaviour. The visual baselines catch appearance and nothing else: a
 * control that renders perfectly and silently no-ops is pixel-identical to one
 * that works, and that is the realistic failure mode of an extraction.
 *
 * So every test mutates, RELOADS, and asserts the reloaded value. The reload is
 * not decoration — without it these tests pass against a page whose every
 * handler is dead, which is the exact false positive they exist to prevent. Each
 * one was verified to fail with its mutation removed.
 *
 * Every test also RESTORES what it changed, inline as well as in afterEach:
 * afterEach does not run if the worker dies, and these drive the same seeded
 * account tests/e2e/baselines.spec.ts photographs.
 */

/**
 * Take the onboarding tour widget out of the layout for capability tests.
 *
 * `components/onboarding-tour-widget.tsx` renders `fixed bottom-4 right-4 z-50`
 * over the bottom-right of every dashboard route, and it keeps that corner even
 * after global setup dismisses it — dismissing collapses it to a "Show
 * Onboarding" pill in the same place. Playwright reports the target beneath it
 * as "visible, enabled and stable" and then retries the click for the full
 * timeout while the widget eats every pointer event, so the failure reads as a
 * missing element rather than an overlay.
 *
 * It bites at 375px in particular: the converted page is short, the invite row
 * is the last thing on it, and scrolling that row into view puts it under the
 * pill. page.tsx already carries bottom padding so the row clears the widget at
 * the END of the document, but the widget is fixed to the VIEWPORT, so padding
 * cannot help mid-scroll.
 *
 * Excluded here rather than worked around, because this spec's job is to assert
 * what the page can do, and the overlay is a tracked defect of shared chrome
 * that no settings ticket should be rewriting. It is deliberately NOT applied to
 * baselines.spec.ts — those snapshots should keep photographing what an operator
 * actually sees, widget included.
 *
 * Selected by its Tailwind position classes because the component exposes no
 * testid. If this stops matching, the widget moved — which is worth knowing, so
 * prefer fixing the selector over deleting the call.
 *
 * Also drops `<nextjs-portal>`, the Next dev-overlay root. The suite runs against
 * `next dev`, so that portal exists here and in no production build; it anchors
 * bottom-left, which is exactly where a stacked row puts its action button at
 * 375px. Excluding a thing no operator can ever see is not the same as excluding
 * a defect.
 */
async function hideOnboardingOverlay(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    const apply = () => {
      const style = document.createElement('style')
      style.textContent =
        '.fixed.bottom-4.right-4, nextjs-portal { display: none !important; }'
      document.head.appendChild(style)
    }
    if (document.head) apply()
    else document.addEventListener('DOMContentLoaded', apply)
  })
}

const SEEDED_LAST_NAME = 'User'

/**
 * A last-resort sweep of leaked invitations, straight through the service role.
 *
 * The UI cleanup below asserts that cancelling works, which is worth keeping —
 * but it shares a failure mode with the test it cleans up after: when the cancel
 * control is what breaks, the test fails at that step AND the cleanup fails at
 * the same step, and rows survive. That has now drifted the /settings baseline
 * twice, presenting leaked data as a rendering regression both times.
 *
 * A UI-driven cleanup can never be self-healing when the UI is the thing that is
 * broken, so this closes the loop below it. Runs once, after the whole file.
 */
test.afterAll(async () => {
  loadEnvLocal()
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return
  const admin = createClient(url, key, { auth: { persistSession: false } })
  await admin.from('team_invitations').delete().like('email', 'qa-invite-%')
})

test.describe('/settings — profile', () => {
  test.beforeEach(async ({ page }) => { await hideOnboardingOverlay(page) })

  test.afterEach(async ({ page }) => {
    await page.goto('/settings')
    const last = page.getByLabel(/last name/i)
    if ((await last.inputValue()) !== SEEDED_LAST_NAME) {
      await last.fill(SEEDED_LAST_NAME)
      await page.getByRole('button', { name: /save changes/i }).click()
      await expect(page.getByText(/profile updated/i)).toBeVisible()
    }
  })

  test('a saved name survives a reload', async ({ page }) => {
    const token = `QA${Date.now().toString().slice(-6)}`

    await page.goto('/settings')
    await page.getByLabel(/last name/i).fill(token)
    await page.getByRole('button', { name: /save changes/i }).click()
    await expect(page.getByText(/profile updated/i)).toBeVisible()

    // The assertion that matters. An implementation that only sets local state
    // passes everything above and fails here.
    await page.reload()
    await expect(page.getByLabel(/last name/i)).toHaveValue(token)

    await page.getByLabel(/last name/i).fill(SEEDED_LAST_NAME)
    await page.getByRole('button', { name: /save changes/i }).click()
    await expect(page.getByText(/profile updated/i)).toBeVisible()
  })
})

/**
 * `member-row` / `invitation-row` / `member-role` / `cancel-invitation` are a
 * TEST CONTRACT, the same way `detail-cogs` and `detail-profit` are on
 * /orders/[id] (CoffeeOS#70). The Instrument rebuild may move, restyle or
 * re-parent these — members and invitations become one table — but it must carry
 * the testids with them. Selecting on the loud layout's class names instead
 * would guarantee these tests die in Stage B, which is precisely when they are
 * meant to be watching.
 */
const memberRow = (page: import('@playwright/test').Page, email: string) =>
  page.locator(`[data-testid="member-row"][data-member-email="${email}"]`)

const invitationRow = (page: import('@playwright/test').Page, email: string) =>
  page.locator(`[data-testid="invitation-row"][data-invitation-email="${email}"]`)

test.describe('/settings — team invitations', () => {
  test.beforeEach(async ({ page }) => { await hideOnboardingOverlay(page) })

  // A fresh address per run. inviteTeamMember upserts on (owner_id, email) and
  // refuses a still-pending duplicate, so a leaked row from an earlier run would
  // make this test assert against something it did not create.
  const INVITEE = `qa-invite-${Date.now()}@example.com`

  /**
   * Cancels EVERY qa-invite- row, not just this run's.
   *
   * Scoping the cleanup to one address made it share a failure mode with the
   * test: when the cancel control broke, the test failed at the cancel step AND
   * this cleanup failed at the same step, so eight invitations accumulated
   * across retries and drifted the /settings baseline — which then read as a
   * rendering regression rather than as leaked data.
   *
   * Sweeping the prefix makes it self-healing: the next run clears whatever an
   * earlier one stranded, whether or not that run got as far as creating it.
   */
  test.afterEach(async ({ page }) => {
    await page.goto('/settings')
    const stale = page.locator('[data-testid="invitation-row"][data-invitation-email^="qa-invite-"]')
    for (let guard = 0; (await stale.count()) > 0 && guard < 20; guard++) {
      const cancel = stale.first().getByTestId('cancel-invitation')
      await cancel.scrollIntoViewIfNeeded()
      await cancel.click()
      await expect(page.getByText(/invitation cancelled/i)).toBeVisible()
    }
    await expect(stale).toHaveCount(0)
  })

  test('an invitation appears, then cancels', async ({ page }) => {
    await page.goto('/settings')

    // Assert ABSENCE first. Without this the test would pass on a leaked row
    // from a previous run without inviting anything at all.
    await expect(invitationRow(page, INVITEE)).toHaveCount(0)

    await page.getByPlaceholder('team@example.com').fill(INVITEE)
    await page.getByRole('button', { name: /^invite$/i }).click()

    // Wait for the acknowledgement BEFORE reloading. page.reload() fired
    // straight after the click tears down the in-flight server action, and the
    // invitation is then never written — which reads as "the feature is broken"
    // rather than "the test raced it".
    await expect(page.getByText(/invitation created/i)).toBeVisible()

    // Reloaded, not just rendered — proves the row came back from the server
    // rather than from the optimistic refetch the handler already triggered.
    await page.reload()
    await expect(invitationRow(page, INVITEE)).toBeVisible()

    /* Scrolled into view first. After the reload the team list refetches on
       mount and the rows shift while it settles, so Playwright's stability check
       can time out on a control that is perfectly reachable a moment later —
       measured: once scrolled, elementFromPoint at the button's centre returns
       the button itself. It bites at 375px and not at 1280 because the stacked
       layout puts this row much further down the page. */
    const cancel = invitationRow(page, INVITEE).getByTestId('cancel-invitation')
    await cancel.scrollIntoViewIfNeeded()
    await cancel.click()
    await expect(page.getByText(/invitation cancelled/i)).toBeVisible()

    await page.reload()
    await expect(invitationRow(page, INVITEE)).toHaveCount(0)
  })
})

/**
 * Every `?error=` code settings-client.tsx maps, and the fallback it must not
 * fall through to. Copy is asserted verbatim because Stage B moves this map into
 * lib/settings/errors.ts and a reworded string would go unnoticed otherwise.
 *
 * `billing_not_active` is deliberately absent — it is the one code that does not
 * merely render. See the test below it.
 */
const ERROR_FALLBACK = 'An error occurred connecting to Shopify'

const ERROR_CODES: Array<[string, RegExp]> = [
  ['missing_params', /Missing required parameters from Shopify/i],
  ['config_error', /Shopify app not configured correctly/i],
  ['invalid_signature', /Invalid signature from Shopify/i],
  ['invalid_state', /Invalid state/i],
  ['state_expired', /Connection timed out/i],
  ['shop_mismatch', /Shop mismatch/i],
  ['token_exchange_failed', /Failed to exchange token with Shopify/i],
  ['save_failed', /Failed to save connection/i],
  ['callback_error', /An error occurred during connection/i],
  ['billing_create_failed', /managed pricing apps/i],
  ['billing_check_failed', /Could not verify Shopify billing status/i],
  ['shopify_not_connected', /Connect your Shopify store before activating billing/i],
]

test.describe('/settings — Shopify error codes', () => {
  for (const [code, copy] of ERROR_CODES) {
    test(`?error=${code} renders its own message`, async ({ page }) => {
      await page.goto(`/settings?error=${code}`)

      await expect(page.getByText(copy)).toBeVisible()

      // Asserting the specific copy is not enough on its own: if a key fell
      // through, the fallback could still contain the words being matched. This
      // is what makes the table meaningful rather than decorative.
      await expect(page.getByText(ERROR_FALLBACK, { exact: true })).toHaveCount(0)

      // The page strips the query string once it has shown the message, so a
      // refresh does not resurrect a stale error.
      await expect(page).toHaveURL(/\/settings$/)
    })
  }

  /**
   * The thirteenth code, which does not render at all.
   *
   * settings-client.tsx maps copy for `billing_not_active`, but on a connected
   * store with inactive billing — the seeded state, and the only state that can
   * produce this code — the auto-check effect fires first and navigates to
   * /api/shopify/billing/ensure. Measured: the message is never painted.
   *
   * That effect is the piece design.md §4 rules must NOT move into a child
   * component during Stage A, because its `hasAutoCheckedBillingRef` guard is
   * per-mount. This test is what will notice if it does: extract the effect into
   * something that remounts and the navigation either fires twice or stops
   * firing, and either way this fails.
   *
   * Asserts departure from /settings rather than the destination — where the
   * ensure route lands depends on whether the billing bypass is on, and pinning
   * that would make this a test of playwright.config.ts.
   */
  test('billing_not_active re-checks billing instead of rendering a message', async ({ page }) => {
    await page.goto('/settings?error=billing_not_active')
    await expect(page).not.toHaveURL(/\/settings/, { timeout: 15_000 })
    await expect(page.getByText(/Billing is required to use the app/i)).toHaveCount(0)
  })

  test('an unmapped code falls through to the generic message', async ({ page }) => {
    // The negative control for the twelve above. Without it, a map that returned
    // the fallback for EVERY key would still pass any test whose regex happened
    // to match the fallback's wording.
    await page.goto('/settings?error=not_a_real_code')
    await expect(page.getByText(ERROR_FALLBACK, { exact: true })).toBeVisible()
  })
})

/**
 * The workspace status, asserted as WIRING only.
 *
 * The three states themselves are unit tests over the pure function in
 * lib/settings/status.ts (spec criterion 20). Driving all three through a
 * browser would mean writing three different shopify_settings rows for the
 * account tests/e2e/baselines.spec.ts photographs — the ordering hazard /orders
 * already paid for — to re-test a function that needs no browser.
 *
 * So this asserts the one thing units cannot: that the page renders that
 * function's output for the state actually in the database.
 *
 * The seeded workspace is connected (connected_via_oauth + admin_access_token)
 * with billing_status null, so it is BLOCKED. Before Stage B the page says so in
 * the Shopify panel; after Stage B it says so as the hero, in --brand. Naming
 * the state exactly is the point — a page that renders "Live" over a workspace
 * that cannot trade is the failure this is here to catch.
 */
test.describe('/settings — workspace status', () => {
  test('the page reports the seeded workspace as not billing-active', async ({ page }) => {
    await page.goto('/settings')
    await expect(page.getByText(/billing required|not active|blocked/i).first()).toBeVisible()
    await expect(page.getByText(/billing active/i)).toHaveCount(0)
  })
})

test.describe('/settings — member roles', () => {
  test.beforeEach(async ({ page }) => { await hideOnboardingOverlay(page) })

  // Resolved, never hard-coded: the roaster address is derived from this
  // worktree's demo account (CoffeeOS#106), so a literal here would break the
  // moment a worktree sets its own DEMO_EMAIL — and break as a confusing
  // "member not found" rather than as a configuration error.
  const ROASTER = roasterAccount().email

  test.afterEach(async ({ page }) => {
    await page.goto('/settings')
    const role = memberRow(page, ROASTER).getByTestId('member-role')
    if ((await role.count()) && !/roaster/i.test((await role.textContent()) ?? '')) {
      await role.click()
      await page.getByRole('option', { name: /roaster/i }).click()
      await expect(page.getByText(/role updated/i)).toBeVisible()
    }
  })

  test('a role change survives a reload', async ({ page }) => {
    await page.goto('/settings')

    const role = memberRow(page, ROASTER).getByTestId('member-role')
    await expect(role).toContainText(/roaster/i)

    await role.click()
    await page.getByRole('option', { name: /admin/i }).click()
    await expect(page.getByText(/role updated/i)).toBeVisible()

    // Read the role back from the RELOADED row, never from the control's own
    // value: a select reports its optimistic state and would agree with itself
    // even if nothing was written.
    await page.reload()
    await expect(memberRow(page, ROASTER).getByTestId('member-role')).toContainText(/admin/i)

    await memberRow(page, ROASTER).getByTestId('member-role').click()
    await page.getByRole('option', { name: /roaster/i }).click()
    await page.reload()
    await expect(memberRow(page, ROASTER).getByTestId('member-role')).toContainText(/roaster/i)
  })
})

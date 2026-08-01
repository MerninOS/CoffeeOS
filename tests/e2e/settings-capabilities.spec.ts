import { test, expect } from '@playwright/test'

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

const SEEDED_LAST_NAME = 'User'

/**
 * Hide the onboarding tour widget for the duration of a capability test.
 *
 * `components/onboarding-tour-widget.tsx` renders `fixed bottom-4 right-4 z-50`
 * and genuinely INTERCEPTS the click on /settings' "Save changes" — Playwright
 * reports "subtree intercepts pointer events" and the click never lands. That is
 * a real defect (an operator hits it too, even at 6/6 complete), but it lives
 * outside this route and is tracked separately; here it is noise between the
 * test and the thing under test.
 *
 * Suppressed by intercepting the getItem the widget reads on mount, rather than
 * by clicking its X: clicking would assert the widget's own behaviour, and
 * writing the key directly needs the user id. The pattern match keeps this
 * working for either seeded account.
 *
 * Deliberately NOT applied to baselines.spec.ts — the snapshots photograph the
 * page as an operator actually sees it, widget included.
 */
async function hideOnboardingWidget(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    const real = Storage.prototype.getItem
    Storage.prototype.getItem = function (key: string) {
      if (/^coffeeos:onboarding:.*:hidden$/.test(key)) return 'true'
      return real.call(this, key)
    }
  })
}

test.describe('/settings — profile', () => {
  test.beforeEach(async ({ page }) => {
    await hideOnboardingWidget(page)
  })

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
  // A fresh address per run. inviteTeamMember upserts on (owner_id, email) and
  // refuses a still-pending duplicate, so a leaked row from an earlier run would
  // make this test assert against something it did not create.
  const INVITEE = `qa-invite-${Date.now()}@example.com`

  test.beforeEach(async ({ page }) => {
    await hideOnboardingWidget(page)
  })

  test.afterEach(async ({ page }) => {
    await page.goto('/settings')
    const row = invitationRow(page, INVITEE)
    if (await row.count()) {
      await row.getByTestId('cancel-invitation').click()
      await expect(row).toHaveCount(0)
    }
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

    await invitationRow(page, INVITEE).getByTestId('cancel-invitation').click()
    await expect(page.getByText(/invitation cancelled/i)).toBeVisible()

    await page.reload()
    await expect(invitationRow(page, INVITEE)).toHaveCount(0)
  })
})

test.describe('/settings — member roles', () => {
  const ROASTER = 'roaster@coffeeos.io'

  test.beforeEach(async ({ page }) => {
    await hideOnboardingWidget(page)
  })

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

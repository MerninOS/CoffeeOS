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

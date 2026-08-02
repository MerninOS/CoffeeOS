import { test, expect } from '@playwright/test'

/**
 * Geometry, not pixels.
 *
 * The visual baselines run at 1280 and 375 only, and /orders shipped an
 * unreadable overlapping figure that lived above 1400px because nothing was
 * watching there. These assert that nothing on the settings worksheet exceeds
 * the space it is given at any of three widths — which is the failure
 * instrument's DataTable would have shipped here, since it wraps itself in
 * overflow-x:auto and its columns then become reachable only by scrolling.
 *
 * SCOPED TO THE PAGE, NOT THE DOCUMENT. At 375px the app shell's top bar
 * overflows the viewport by 12px on EVERY dashboard route — measured on
 * /dashboard and /products as well as here — so a document-level assertion
 * would fail permanently for a reason this route cannot fix, and the honest
 * options are to fix shared chrome from a settings ticket or to test the thing
 * the criterion is actually about. That overflow is reported separately.
 *
 * Measured on the ROWS, not on a container. An overflow-x:auto wrapper makes the
 * WRAPPER fit while its content still scrolls, so a container-only assertion
 * passes on exactly the layout this is written to reject.
 */
const WIDTHS = [375, 1280, 1600]

for (const width of WIDTHS) {
  test(`the settings worksheet fits its column at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/settings')
    await expect(page).not.toHaveURL(/\/auth\//)
    await page.waitForLoadState('networkidle')

    const pageRoot = page.locator('[data-settings-page]')
    await expect(pageRoot).toBeVisible()

    // 1. The settings column itself never scrolls sideways.
    const box = await pageRoot.evaluate((el) => ({
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
      right: el.getBoundingClientRect().right,
    }))
    expect(
      box.scrollWidth,
      `the settings column scrolls horizontally at ${width}px`,
    ).toBeLessThanOrEqual(box.clientWidth + 1)

    // 2. Every worksheet row and every team row sits inside that column.
    const rows = page.locator(
      '[data-settings-row], [data-testid="member-row"], [data-testid="invitation-row"]',
    )
    const count = await rows.count()
    expect(count, 'no worksheet rows found — the selector drifted').toBeGreaterThan(0)

    for (let i = 0; i < count; i++) {
      const r = await rows.nth(i).boundingBox()
      if (!r) continue
      expect(r.x + r.width, `row ${i} overflows the settings column at ${width}px`).toBeLessThanOrEqual(
        box.right + 1,
      )
    }
  })
}

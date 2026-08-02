import { test, expect, type Page } from '@playwright/test'

/**
 * Layout guards for the converted roasting queue — the two failure modes the
 * screenshot baselines structurally cannot catch.
 *
 * 1. THE BLIND BAND. Baselines run at 1280 and 375 only. `/orders` shipped an
 *    unreadable overlapping figure that lived entirely above 1400px, and every
 *    check passed. Geometry is asserted here at a width no snapshot covers.
 * 2. PORTALLED TOKEN SCOPE. Radix renders Dialog/Select/Dropdown content to
 *    <body>, OUTSIDE [data-surface="app"], where every var(--token) resolves to
 *    nothing and the content renders unstyled. A screenshot would catch that
 *    only if the dialog happened to be open when it was taken — it never is.
 */

const QUEUE = '/roasting?tab=requests'

async function openQueue(page: Page) {
  await page.goto(QUEUE)
  await expect(page).not.toHaveURL(/\/auth\//)
  await expect(page.getByRole('heading', { name: 'Roast Requests' })).toBeVisible({
    timeout: 20_000,
  })
  await page.waitForLoadState('networkidle')
  await page.addStyleTag({
    content: [
      '[class*="fixed"][class*="bottom-4"][class*="right-4"]{display:none !important}',
      'nextjs-portal{display:none !important}',
    ].join(''),
  })
}

test.describe('roasting queue layout', () => {
  /**
   * Compares the TEXT LEAVES inside a row, not the grid cells.
   *
   * Grid cells cannot overlap — the layout algorithm forbids it — so a check
   * that compares cell boxes can never fail, and two earlier versions of this
   * test duly passed with the progress column squeezed to 40px. What actually
   * goes wrong is CONTENT overflowing its cell and running into the neighbour,
   * which is what shipped on /orders. So: measure the rendered text.
   */
  /**
   * For each text leaf in the first active row, its own box AND the box of the
   * grid cell containing it (the row's direct child).
   *
   * Measuring cell-vs-cell is useless: CSS grid cells cannot overlap, so that
   * check can never fail — verified by squeezing a column to 40px and watching
   * it pass. Measuring text-vs-neighbouring-text is also useless HERE, because
   * this table clips rather than overruns. What a squeezed column actually does
   * is render text wider than the cell that holds it, so that is what to
   * measure.
   */
  async function leafOverflow(page: Page) {
    return page.evaluate(() => {
      const row = document.querySelector(
        '[data-testid="requests-active"] [data-testid="request-row"]'
      )
      if (!row) return []
      const cells = Array.from(row.children)
      const out: { text: string; overflow: number }[] = []
      for (const cell of cells) {
        const c = cell.getBoundingClientRect()
        const leaves = Array.from(cell.querySelectorAll('*')).filter(
          (el) => el.children.length === 0 && (el.textContent ?? '').trim().length > 0
        )
        const candidates = leaves.length ? leaves : [cell]
        for (const el of candidates) {
          const r = el.getBoundingClientRect()
          if (r.width === 0) continue
          out.push({
            text: (el.textContent ?? '').trim().slice(0, 40),
            overflow: Math.max(0, r.right - c.right, c.left - r.left),
          })
        }
      }
      return out
    })
  }

  test('no cell content overflows its column', async ({ page }) => {
    // 1280 and 375 are snapshotted; 1600 and 1920 are not, and that band is
    // exactly where the /orders overlap shipped unnoticed.
    for (const width of [1280, 1600, 1920]) {
      await page.setViewportSize({ width, height: 900 })
      await openQueue(page)

      const leaves = await leafOverflow(page)
      test.skip(leaves.length === 0, 'no desktop rows rendered — seed may be empty')

      for (const leaf of leaves) {
        expect(
          leaf.overflow,
          `at ${width}px "${leaf.text}" overflows its column by ${leaf.overflow.toFixed(0)}px`
        ).toBeLessThanOrEqual(1)
      }
    }
  })

  test('portalled dialog content resolves instrument tokens', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await openQueue(page)

    await page.locator('[data-testid="new-request"]').click()
    const dialog = page.locator('[data-testid="request-dialog"]')
    await expect(dialog).toBeVisible()

    // Assert the COMPUTED value, not the attribute's presence: data-surface can
    // sit on a node the tokens do not cascade from and the attribute check would
    // still pass while everything rendered unstyled.
    const bg = await dialog.evaluate((el) => getComputedStyle(el).backgroundColor)
    expect(bg, 'dialog background did not resolve — is data-surface="app" set?').not.toBe(
      'rgba(0, 0, 0, 0)'
    )
    expect(bg).not.toBe('')

    // And the same for a portalled Select, which is a separate portal root.
    await page.locator('[data-testid="field-coffee"]').click()
    const option = page.getByRole('option').first()
    await expect(option).toBeVisible()
    const optionBg = await option.evaluate(
      (el) => getComputedStyle(el.closest('[role="listbox"]') ?? el).backgroundColor
    )
    expect(optionBg, 'select content did not resolve its tokens').not.toBe('rgba(0, 0, 0, 0)')
  })
})

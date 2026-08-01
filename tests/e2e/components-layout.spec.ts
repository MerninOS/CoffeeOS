import { test, expect, type Page } from '@playwright/test'

/**
 * Geometry assertions for /components that screenshots structurally cannot make.
 *
 * The baseline projects are 1280 (desktop) and 375 (mobile), so nothing above
 * 1400px is captured by ANY baseline — a layout defect there is invisible to the
 * entire snapshot suite. That is how /orders shipped a hero overflowing its
 * column and painting its last glyphs under the strip's background.
 *
 * A truncated figure is not cosmetic on this page. Every cost here multiplies
 * through product_components into product cost and through order_components into
 * order margin, so an operator reading a clipped number reads a number that is
 * not the number.
 *
 * These anchor on explicit testids rather than walking the DOM. The first
 * version of the /orders equivalent inferred its subjects by climbing from the
 * largest text node, silently landed on the wrong element, and PASSED against
 * the known-broken layout. A geometry test that guesses its own subject reports
 * safety it never checked.
 *
 * CoffeeOS#73 Stage B, criterion 4.
 */

test.describe.configure({ mode: 'serial' })
test.skip(({ isMobile }) => !!isMobile, 'wide-viewport geometry — desktop project only')

// 1440 and 1512 are the laptop widths /orders' defect was reported from.
const WIDE = [1400, 1440, 1512, 1728, 1920]

/**
 * The longest cost string the formatter can produce: eight decimals, because the
 * value is small enough that four would round it to zero, plus the widest unit.
 * `$0.00000040/hour` is 16 characters of condensed mono in a 150px track.
 *
 * Created through the UI rather than asserted against whatever the fixture holds
 * — the seeded components are all short ($22.00/hour, $0.0320/g), so a test that
 * used them would prove the column fits the easy case and nothing else.
 */
const PROBE = 'E2E Layout Probe'
const PROBE_COST = '0.0000004'
const PROBE_UNIT = 'hour'

async function openList(page: Page) {
  await page.goto('/components')
  await page.waitForLoadState('networkidle')
  await page.addStyleTag({
    content: '[class*="fixed"][class*="bottom-4"][class*="right-4"]{display:none !important}',
  })
  await expect(page.locator('[data-testid="component-row"]').first()).toBeVisible()
}

const rowFor = (page: Page, name: string) =>
  page
    .locator('[data-testid="component-row"]')
    .filter({ has: page.locator(`[data-testid="row-name"]:text-is("${name}")`) })

async function removeProbe(page: Page) {
  await openList(page)
  const existing = rowFor(page, PROBE)
  while ((await existing.count()) > 0) {
    await existing.first().locator('[data-testid="row-delete"]').click()
    await page.locator('[data-testid="delete-confirm"]').click()
    await expect(rowFor(page, PROBE)).toHaveCount(0)
  }
}

test.describe('/components wide-viewport geometry', () => {
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage()
    await removeProbe(page)
    await page.locator('[data-testid="add-component"]').click()
    await page.locator('[data-testid="field-name"]').fill(PROBE)
    await page.locator('[data-testid="field-type"]').selectOption('other')
    await page.locator('[data-testid="field-unit"]').selectOption(PROBE_UNIT)
    await page.locator('[data-testid="field-cost"]').fill(PROBE_COST)
    await page.locator('[data-testid="dialog-save"]').click()
    await expect(rowFor(page, PROBE)).toHaveCount(1)
    await page.close()
  })

  test.afterAll(async ({ browser }) => {
    const page = await browser.newPage()
    await removeProbe(page)
    await page.close()
  })

  for (const width of WIDE) {
    test(`the longest cost stays inside its column at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      await openList(page)

      const cell = rowFor(page, PROBE).locator('[data-testid="row-cost"]')
      await expect(cell).toBeVisible()

      // The rendered text must actually be the eight-decimal form — if the
      // formatter changed, this test would otherwise silently measure a short
      // string and prove nothing about the wide case.
      await expect(cell).toHaveText(`$0.00000040/${PROBE_UNIT}`)

      const box = (await cell.boundingBox())!
      const track = (await rowFor(page, PROBE).locator('> div').nth(2).boundingBox())!

      expect(
        box.width,
        `the cost figure overflows its ${Math.round(track.width)}px column at ${width}px`,
      ).toBeLessThanOrEqual(track.width)

      // And it must not spill past the column's right edge, which is what
      // actually paints a figure under the neighbouring cell.
      expect(box.x + box.width).toBeLessThanOrEqual(track.x + track.width + 1)
    })
  }

  test('every group is measured against the same ruler', async ({ page }) => {
    // Criterion 4. The page this replaces built a separate grid per type group,
    // so the columns did not line up across groups — the defect is invisible in
    // a screenshot unless you happen to hold a straight edge to it.
    await page.setViewportSize({ width: 1512, height: 900 })
    await openList(page)

    const rows = page.locator('[data-testid="component-row"]')
    const count = await rows.count()
    expect(count, 'need at least two rows in different groups').toBeGreaterThan(1)

    /**
     * EVERY column boundary, not just the cost one.
     *
     * A first version measured only the cost cell's left edge and could not
     * fail: the two flexible tracks always sum to the same remainder, so the
     * cost column starts at the same x whatever their ratio. Rows given a
     * completely different `1.3fr 1.3fr 150px 72px` still passed. The name/notes
     * boundary is the one that actually moves.
     */
    const signatures = new Set<string>()
    for (let i = 0; i < count; i++) {
      const cells = rows.nth(i).locator('> div')
      const edges: number[] = []
      for (let c = 0; c < 4; c++) {
        const box = await cells.nth(c).boundingBox()
        if (box) edges.push(Math.round(box.x))
      }
      signatures.add(edges.join(','))
    }

    expect(
      [...signatures],
      'rows do not share one set of column edges — some group has its own grid',
    ).toHaveLength(1)
  })
})

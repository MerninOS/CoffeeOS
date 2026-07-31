import { test, expect, type Page } from '@playwright/test'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

/**
 * Geometry, and the agreement between /orders and /orders/[id].
 *
 * Neither is covered by the visual baselines, for different reasons.
 *
 * GEOMETRY: baselines shoot 1280 and 375 only. /orders shipped an unreadable
 * overlapping figure that lived above 1400px, where no baseline looks, so this
 * asserts the worksheet's column geometry at 1280, 1440 AND 1600 — measurements,
 * not pixels, because the layout is meant to change across those widths.
 *
 * AGREEMENT: two surfaces rendering the same order differently is the entire
 * defect CoffeeOS#100 closed and CoffeeOS#70 must not reopen. A screenshot of
 * either page in isolation cannot see it.
 */

function seededOrderIds(): Record<string, string> {
  const file = path.join(__dirname, '..', 'fixtures', 'seeded-orders.json')
  if (!existsSync(file)) {
    throw new Error(
      `Missing ${file}. Run \`node scripts/seed-demo-account.mjs\` — it writes ` +
        `this fixture on the way out.`,
    )
  }
  return JSON.parse(readFileSync(file, 'utf8'))
}

async function hideOnboardingWidget(page: Page) {
  await page.addStyleTag({
    content: 'div.fixed.bottom-4.right-4.z-50 { display: none !important; }',
  })
}

// ── Criterion 17: geometry across widths ────────────────────────────────────

for (const width of [1280, 1440, 1600]) {
  test(`worksheet columns do not overlap at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 })
    await page.goto(`/orders/${seededOrderIds()['#1002']}`)
    await expect(page).not.toHaveURL(/\/auth\//)
    await hideOnboardingWidget(page)

    const grid = page.getByTestId('worksheet')
    await expect(grid).toBeVisible({ timeout: 20_000 })

    // The seven header cells are the column tracks made visible.
    const boxes = await grid.locator(':scope > div').evaluateAll((els) =>
      els.slice(0, 7).map((el) => {
        const r = el.getBoundingClientRect()
        return { left: r.left, right: r.right, width: r.width }
      }),
    )

    expect(boxes.length, 'the worksheet renders seven column tracks').toBe(7)

    for (let i = 1; i < boxes.length; i++) {
      // Sub-pixel rounding is normal; a real overlap is not. 0.5px of slack
      // distinguishes the two without letting a collapsed column through.
      expect(
        boxes[i].left,
        `column ${i} starts before column ${i - 1} ends at ${width}px — the tracks overlap`,
      ).toBeGreaterThanOrEqual(boxes[i - 1].right - 0.5)
    }

    // A track that has collapsed to nothing is an overlap waiting to happen and
    // reads as missing data rather than as a layout bug.
    for (const [i, b] of boxes.entries()) {
      expect(b.width, `column ${i} collapsed to zero width at ${width}px`).toBeGreaterThan(0)
    }

    // The whole table must stay inside the viewport: a worksheet that scrolls
    // horizontally hides the Cost column, which is the one people came for.
    const total = boxes[boxes.length - 1].right - boxes[0].left
    expect(total, `worksheet is wider than the ${width}px viewport`).toBeLessThanOrEqual(width)
  })
}

// ── Criterion 18: the two surfaces agree ────────────────────────────────────

/**
 * Only orders visible on BOTH surfaces can be compared, and
 * `playwright.config.ts` pins ORDERS_PAGE_LIMIT to 3, so /orders shows the
 * newest three: #1002, #1001, #1006.
 *
 * That is not the limitation it looks like. #1006 is the case that actually
 * matters — uncostable, but carrying real order-level cost, so it exercises the
 * partial-figure branch where the two surfaces are most likely to disagree.
 * Testing only a costed order would pass while they diverge on everything else.
 *
 * #1007 (unlinked, "not set") cannot be reached from the list at that limit; the
 * baselines cover it visually instead.
 */
const AGREE = [
  { name: '#1002', note: 'costed — a real margin on both' },
  { name: '#1006', note: 'uncostable WITH order-level cost — the partial figure' },
]

for (const { name, note } of AGREE) {
  test(`/orders and /orders/[id] agree on ${name} (${note})`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 })

    // The list's own figure for this order.
    await page.goto('/orders?period=365')
    await expect(page).not.toHaveURL(/\/auth\//)
    await hideOnboardingWidget(page)

    const row = page.locator('[data-testid="order-row"]', { hasText: name }).first()
    await expect(row, `${name} is on the first page of /orders`).toBeVisible({ timeout: 20_000 })
    const listCogs = (await row.getByTestId('row-cogs').innerText()).trim()
    const listMargin = (await row.getByTestId('row-margin').innerText()).trim()

    // The detail page's figure for the same order.
    await page.goto(`/orders/${seededOrderIds()[name]}`)
    await hideOnboardingWidget(page)
    const detailCogs = (await page.getByTestId('detail-cogs').innerText()).trim()

    // COGS must match as a STRING. Comparing numbers would pass while the two
    // pages format differently ($27.65 vs $27.7), which is a real divergence to
    // an operator reading both.
    expect(
      detailCogs.replace(/^−/, ''),
      `COGS differs between /orders and /orders/[id] for ${name}`,
    ).toBe(listCogs.replace(/^−/, ''))

    // And they must agree on whether a margin may be shown at all. The glyphs
    // are deliberately NOT compared: the list withholds with an em dash in a
    // 104px cell, the detail page says it in words under a display-size label.
    // Requiring identical text there would force one surface to render badly.
    const listWithheld = listMargin === '—'
    const detailWithheld = (await page.getByTestId('detail-profit').count()) === 0
    expect(
      detailWithheld,
      `${name}: one surface shows a margin and the other withholds it`,
    ).toBe(listWithheld)

    /**
     * The header must NAME both states — never swallow one.
     *
     * The visual baselines cannot see this: the repo runs toHaveScreenshot at
     * maxDiffPixelRatio 0.01, and two short badge labels sit far inside that
     * budget. A version of OrderHeader that looked labels up in a partial map
     * rendered NO payment badge at all for VOIDED / AUTHORIZED / PARTIALLY_PAID
     * and asserted "Unfulfilled" for RESTOCKED and ON_HOLD — and passed all six
     * baselines. That is how this gap was found, so it is asserted as text.
     */
    // expect.poll, not a one-shot innerText(): the surrounding assertions use
    // auto-retrying locators, and reading text once raced the header's render —
    // this returned [] on a first run and passed on retry before being fixed.
    await expect
      .poll(
        async () =>
          (await page.locator('h1').locator('xpath=..').innerText())
            .split('\n')
            .slice(1)
            .map((t) => t.trim())
            .filter(Boolean),
        {
          message: `${name}: the header must show a payment AND a fulfilment badge`,
          timeout: 15_000,
        },
      )
      .toEqual(expect.arrayContaining([expect.any(String)]))

    const badges = (await page.locator('h1').locator('xpath=..').innerText())
      .split('\n')
      .slice(1)
      .map((t) => t.trim())
      .filter(Boolean)

    expect(
      badges.length,
      `${name}: the header must show a payment AND a fulfilment badge, got ${JSON.stringify(badges)}`,
    ).toBeGreaterThanOrEqual(2)
  })
}

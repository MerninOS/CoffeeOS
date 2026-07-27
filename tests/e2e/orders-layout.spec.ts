import { test, expect } from '@playwright/test'

/**
 * Geometry assertions for /orders that screenshots structurally cannot make.
 *
 * The baseline projects are 1280 (desktop) and 375 (mobile). The hero and the
 * stat strip only sit side by side above 1400px, so the two-column layout is
 * captured by NO baseline — a layout defect there is invisible to the entire
 * snapshot suite. That is how the hero shipped overflowing its column and
 * painting its last glyphs under the strip's background: at 1440, "$337.38"
 * measured 388px inside a 340px column.
 *
 * A truncated figure is not cosmetic on this page. It is the same class of
 * defect as the stat that once rendered "23,840" as "23,84" — the operator
 * reads a number that is not the number.
 *
 * These anchor on `hero-column` / `strip-column` rather than walking the DOM.
 * The first version of this file inferred both by climbing from the largest
 * text node, silently landed on the wrong element, and passed against the
 * known-broken layout. Geometry tests that guess their own subject are worse
 * than no test — they report safety they never checked.
 */

test.describe.configure({ mode: 'default' })
test.skip(({ isMobile }) => !!isMobile, 'wide-viewport geometry — desktop project only')

// Above the 1400px breakpoint where hero and strip share a row. 1440 and 1512
// are the laptop widths this was reported from.
const WIDE = [1400, 1440, 1512, 1728, 1920]

async function boxes(page: import('@playwright/test').Page) {
  const hero = page.getByTestId('hero-column')
  const strip = page.getByTestId('strip-column')
  await expect(hero).toBeVisible()
  await expect(strip).toBeVisible()

  const heroBox = await hero.boundingBox()
  const stripBox = await strip.boundingBox()

  // The rendered figure inside the hero column — what actually overflows.
  const figure = await hero.evaluate((col) => {
    let node: Element | null = null
    let biggest = 0
    col.querySelectorAll('*').forEach((el) => {
      if (el.children.length) return
      const size = parseFloat(getComputedStyle(el).fontSize)
      if (size > biggest && /\d/.test(el.textContent || '')) {
        biggest = size
        node = el
      }
    })
    if (!node) return null
    const el = node as Element
    const r = el.getBoundingClientRect()
    return { text: el.textContent || '', width: r.width, right: r.right }
  })

  return { heroBox: heroBox!, stripBox: stripBox!, figure: figure! }
}

test.describe('the gross profit figure stays readable', () => {
  for (const width of WIDE) {
    test(`hero does not run under the stat strip at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      await page.goto('/orders?period=90')
      await page.waitForLoadState('networkidle')

      const { heroBox, stripBox, figure } = await boxes(page)
      expect(figure, 'no figure rendered inside the hero column').not.toBeNull()

      // Only meaningful while the two share a row; below the breakpoint they
      // stack and there is nothing to collide with.
      const sameRow = Math.abs(heroBox.y - stripBox.y) < 120
      test.skip(!sameRow, `hero and strip are stacked at ${width}px`)

      expect(
        figure.right,
        `the hero figure "${figure.text}" reaches ${Math.round(figure.right)}px but ` +
          `the stat strip starts at ${Math.round(stripBox.x)}px — its last glyphs are ` +
          `painted under the strip's background and cannot be read`
      ).toBeLessThanOrEqual(stripBox.x)
    })
  }

  test('the hero figure fits inside its own column at 1440px', async ({ page }) => {
    // Catches the overflow at its source, independently of where the strip sits
    // — a wider gap would hide the collision above while the number still
    // spilled out of its box.
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/orders?period=90')
    await page.waitForLoadState('networkidle')

    const { heroBox, figure } = await boxes(page)
    expect(figure).not.toBeNull()
    expect(
      figure.width,
      `"${figure.text}" is ${Math.round(figure.width)}px inside a ` +
        `${Math.round(heroBox.width)}px column — it will be clipped or overlap`
    ).toBeLessThanOrEqual(heroBox.width + 1)
  })
})

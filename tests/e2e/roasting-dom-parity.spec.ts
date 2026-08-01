import { test, expect } from '@playwright/test'

/**
 * The real proof that a Stage A extraction changed nothing.
 *
 * The screenshot baselines CANNOT do this job on their own: playwright.config.ts
 * sets `maxDiffPixelRatio: 0.01`, so up to 1% of a page may differ and still
 * pass. Measured on this repo, one table cell's text changing from `—` to
 * `PROOF-MARKER` passed. A subtle extraction regression is exactly the sub-1%
 * kind, so "the baselines are green" is not evidence of behaviour preservation.
 *
 * This compares the rendered DOM byte-for-byte instead — no tolerance at all.
 * Run it before the extraction to record, and after each extraction step to
 * verify:
 *
 *   E2E_PORT=3131 ./node_modules/.bin/playwright test tests/e2e/roasting-dom-parity.spec.ts --update-snapshots   # record
 *   E2E_PORT=3131 ./node_modules/.bin/playwright test tests/e2e/roasting-dom-parity.spec.ts                      # verify
 *
 * ⚠ This asserts on RENDERED DATA as well as markup, which is the point — but it
 * means a sibling session mutating the shared demo account will fail it for
 * reasons unrelated to your change. Check `ps aux | grep "playwright.*test
 * tests/e2e"` before trusting a failure, and re-seed only when nothing else is
 * running.
 */

/**
 * Strip the identifiers React and Radix generate fresh on every render. These
 * are genuinely non-deterministic — baselines.spec.ts already documents a useId
 * mismatch (`aria-controls` `_R_2itmlb_` server vs `_R_6itmlb_` client) on a
 * freshly-compiled route — so leaving them in would make this check fail
 * constantly and get deleted. Everything else is compared verbatim.
 */
const normalize = (html: string) =>
  html
    // React useId: _R_2itmlb_ / «r0»
    .replace(/_R_[a-z0-9]*_/g, '_R_ID_')
    .replace(/«[a-z0-9]+»/gi, '«ID»')
    // Radix generated ids: radix-:r1:, radix-_R_xyz_
    .replace(/radix-[^"'\s>]+/g, 'radix-ID')
    // Playwright/Next dev can vary trailing whitespace between text nodes
    .replace(/\s+$/gm, '')

test.describe('roasting queue DOM parity', () => {
  test('the rendered queue DOM is byte-identical to the recorded baseline', async ({
    page,
  }) => {
    await page.goto('/roasting?tab=requests')
    await expect(page).not.toHaveURL(/\/auth\//)

    // Same anchor baselines.spec.ts uses to prove the query param survived —
    // without it this could compare the sessions tab against itself.
    await expect(
      page.getByRole('heading', { name: 'Roast Requests' })
    ).toBeVisible()
    await page.waitForLoadState('networkidle')

    const main = page.locator('main')
    await expect(main).toBeVisible()

    const html = normalize(await main.innerHTML())

    // Guard against the check passing because it captured nothing. An empty or
    // trivially short capture would otherwise "match" a broken baseline.
    expect(html.length, 'captured DOM is implausibly small').toBeGreaterThan(2000)

    // toMatchSnapshot is an EXACT text comparison — no maxDiffPixelRatio here.
    expect(html).toMatchSnapshot('roasting-queue-dom.html')
  })
})

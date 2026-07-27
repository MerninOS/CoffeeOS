import { test, expect } from '@playwright/test'

/**
 * Assertions for the spec's acceptance criteria that a screenshot cannot prove.
 * Each one guards a failure mode that is SILENT — the page looks fine and ships
 * broken, which is exactly why these are assertions and not care.
 */

test.describe('C7 — the Martian Mono width axis survived', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('font-stretch is a range, not a single value', async ({ page }) => {
    await page.goto('/auth/login')

    const result = await page.evaluate(async () => {
      await document.fonts.ready
      const face = [...document.fonts].find((f) => f.family.includes('Martian'))
      return face ? face.stretch : null
    })

    // null means the face was never found — without this the assertion could
    // pass vacuously on a page where the font simply never loaded.
    expect(result, 'Martian Mono face was not loaded at all').not.toBeNull()

    // Omitting `axes: ['wdth']` in next/font makes Google serve a DIFFERENT
    // .woff2 whose stretch is a flat 100%. The font still loads and renders, so
    // nothing looks broken — but every font-variation-settings:'wdth' in the
    // design system goes inert and the type hierarchy flattens to one width.
    expect(result).toBe('75% 112.5%')
  })
})

test.describe('C5 — instrument tokens stay inside the app surface', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  const INSTRUMENT_TOKENS = ['--canvas', '--ink', '--brand', '--roast-0', '--hairline', '--surface']

  for (const route of ['/', '/pricing', '/auth/login']) {
    test(`no token leaks onto ${route}`, async ({ page }) => {
      await page.goto(route)

      const leaked = await page.evaluate((tokens) => {
        const cs = getComputedStyle(document.body)
        return tokens.filter((t) => cs.getPropertyValue(t).trim() !== '')
      }, INSTRUMENT_TOKENS)

      expect(leaked, `instrument tokens resolved on ${route}`).toEqual([])
    })
  }

  test('positive control: the same tokens DO resolve inside the scope', async ({ page }) => {
    // Without this, every assertion above would also pass if the stylesheet had
    // simply failed to load — which is precisely what happened once already,
    // when styles.css shipped as @import lines and broke the whole sheet.
    await page.goto('/auth/login')

    const scoped = await page.evaluate(() => {
      const probe = document.createElement('div')
      probe.setAttribute('data-surface', 'app')
      document.body.appendChild(probe)
      const cs = getComputedStyle(probe)
      const out = {
        canvas: cs.getPropertyValue('--canvas').trim(),
        ink: cs.getPropertyValue('--ink').trim(),
        brand: cs.getPropertyValue('--brand').trim(),
      }
      probe.remove()
      return out
    })

    expect(scoped).toEqual({ canvas: '#f8f7f5', ink: '#241812', brand: '#fa3b30' })
  })
})

test.describe('P1 — the instrument scope is live on the dashboard only', () => {
  test('a dashboard route carries data-surface="app"', async ({ page }) => {
    // <AppShell> sets the attribute on its root. It is the anchor the entire
    // instrument token layer is scoped to, so if it disappears every var(--token)
    // in the shell silently resolves to nothing and the chrome renders unstyled
    // rather than erroring.
    await page.goto('/dashboard')
    await expect(page).not.toHaveURL(/\/auth\//)

    await expect(page.locator('[data-surface="app"]').first()).toBeAttached()
  })

})

test.describe('P1 — the instrument scope stays off public routes', () => {
  // Must run logged out: /auth/login redirects to the dashboard when a session
  // exists, which would make the assertion below vacuously pass on the wrong page.
  test.use({ storageState: { cookies: [], origins: [] } })

  for (const route of ['/', '/auth/login']) {
    test(`no data-surface="app" on ${route}`, async ({ page }) => {
      // Public routes keep the loud Mernin' brand. The scope reaching them would
      // re-skin them wholesale — this is the counterpart to the assertion above.
      await page.goto(route)

      const count = await page.locator('[data-surface="app"]').count()
      expect(count, `instrument scope activated on ${route}`).toBe(0)
    })
  }
})

/* Enabled in P1, once <AppShell> sets data-surface="app":
 *
 * C6 — Radix portals inherit the skin. Each of dialog, alert-dialog, sheet,
 * dropdown-menu, select and tooltip must render portaled content that resolves
 * instrument tokens AND is not given the app canvas background. The transform
 * splits the design system's body rule for exactly this:
 *   [data-surface="app"]                    -> inheritable text properties
 *   [data-surface="app"]:not([data-slot])   -> background / margin
 * Assert the matched node's closest('[data-surface]') IS the portal element —
 * asserting on the trigger passes while the portal is broken.
 */
test.fixme('C6 — Radix portals inherit the instrument skin', async () => {})

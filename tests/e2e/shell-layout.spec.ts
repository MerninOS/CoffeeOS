import { test, expect } from '@playwright/test'

/**
 * One guard, for the whole authenticated shell: no page may scroll sideways.
 *
 * `components/instrument-shell.tsx` renders the header on EVERY authenticated
 * route, so a header that is 12px too wide is not one page's bug — it is every
 * page's bug. That is exactly what shipped: the actions group (identity block +
 * "Sign out") ran from x=219 to x=387 inside a 375px header, and `/dashboard`,
 * `/orders`, `/products`, `/inventory`, `/components`, `/settings` and every
 * roasting route all reported a 13px document overflow at 375. Each one scrolled
 * horizontally on a phone.
 *
 * Nothing caught it. Every surface has a `*-layout.spec.ts`, and all of them
 * assert geometry INSIDE their own page — column overflow, cell overlap — which
 * is blind to chrome the page does not own. The mobile baselines were no help
 * either: 12px on the right edge of a full-page screenshot is far under the
 * `maxDiffPixelRatio: 0.01` tolerance, the same blind spot that hid a stat strip
 * clipped to 35px and a deliberate "orders"→"ordels" rename.
 *
 * Asserted at the DOCUMENT level on purpose. Per-element checks are what the
 * per-surface specs already do; this one asks the only question that matters to
 * someone holding a phone — does the page scroll sideways — and it asks it of
 * the shell, once, for everything.
 */

// The narrowest phone worth supporting, the width the baselines use, and a
// common large phone. 375 is the one that had a passing snapshot the whole time.
const WIDTHS = [320, 375, 414]

const ROUTES = [
  '/dashboard',
  '/orders',
  '/products',
  '/inventory',
  '/components',
  '/settings',
  '/roasting',
  '/roasting?tab=sessions',
  '/roasting?tab=stock',
]

test.describe('app shell layout', () => {
  // One test PER WIDTH, not one test for all three.
  //
  // The first version looped 3 widths x 9 routes inside a single test and hit
  // the 30s default timeout — which reported as a failure, and briefly looked
  // like the overflow assertion doing its job. It wasn't: a timeout fails for
  // any reason at all, so it proves nothing about the thing being asserted.
  // Split up, each test does 9 navigations, and the timeout is raised so that a
  // failure here can only mean a page actually scrolls sideways.
  for (const width of WIDTHS) {
    test(`no authenticated route scrolls sideways at ${width}px`, async ({ page }) => {
      test.setTimeout(120_000)

      const offenders: string[] = []
      await page.setViewportSize({ width, height: 812 })

      for (const route of ROUTES) {
        await page.goto(route)
        await expect(page).not.toHaveURL(/\/auth\//)
        await page.waitForLoadState('networkidle')

        const overflow = await page.evaluate(() => {
          const de = document.documentElement
          const spill = de.scrollWidth - de.clientWidth
          if (spill <= 0) return null

          // Name the widest offender rather than only the number — "13px" alone
          // sends you hunting through the whole tree.
          let worst = { tag: '', text: '', right: 0 }
          for (const el of Array.from(document.querySelectorAll('body *'))) {
            const r = el.getBoundingClientRect()
            if (r.width === 0 || r.height === 0) continue
            if (r.right > worst.right) {
              worst = {
                tag: el.tagName.toLowerCase(),
                text: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 30),
                right: Math.round(r.right),
              }
            }
          }
          return { spill, worst, viewport: de.clientWidth }
        })

        if (overflow) {
          offenders.push(
            `${route}: +${overflow.spill}px ` +
              `(widest: ${overflow.worst.tag} "${overflow.worst.text}" ends at ` +
              `${overflow.worst.right} in ${overflow.viewport}px)`
          )
        }
      }

      expect(
        offenders,
        `routes scrolling horizontally at ${width}px:\n${offenders.join('\n')}`
      ).toEqual([])
    })
  }

  test('the sign-out control keeps its accessible name when its label is hidden', async ({
    page,
  }) => {
    // The overflow fix hides the "Sign out" text below md. That is only safe
    // because `aria-label` carries the name — without it the control becomes an
    // unnamed icon button for screen readers, and every `getByRole('button',
    // { name: /sign out/i })` in the suite silently stops matching on mobile.
    for (const width of [375, 1280]) {
      await page.setViewportSize({ width, height: 812 })
      await page.goto('/roasting')
      await page.waitForLoadState('networkidle')

      await expect(
        page.getByRole('button', { name: /sign out/i }),
        `no accessibly-named sign-out control at ${width}px`
      ).toHaveCount(1)
    }
  })
})

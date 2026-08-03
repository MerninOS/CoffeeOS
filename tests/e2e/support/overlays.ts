import type { Page } from '@playwright/test'

/**
 * Hide the two floating overlays that intercept pointer events.
 *
 * Hidden with CSS rather than dismissed: dismissal persists to localStorage,
 * and the tour widget is part of the visual baselines, so clicking it away
 * would silently change what the baseline suite captures.
 *
 * Was copy-pasted identically into `components-capabilities.spec.ts` and
 * `roasting-requests-capabilities.spec.ts`; extracted here when `auth.setup.ts`
 * turned out to need it too (see below).
 */
export async function hideOverlays(page: Page) {
  await page.addStyleTag({
    content: [
      // The onboarding tour widget, collapsed or expanded — both roots are
      // `fixed bottom-4 right-4 z-50` and it covers the bottom of the list.
      '[class*="fixed"][class*="bottom-4"][class*="right-4"]{display:none !important}',
      // The Next.js dev-tools overlay. It does not exist in production, but in
      // dev its `nextjs-portal` host can cover an interactive element outright:
      // `document.elementFromPoint()` at the centre of /auth/login's "Sign in"
      // button returned NEXTJS-PORTAL, and Playwright retried the click for a
      // full 180s before the setup project timed out and took all 328 tests in
      // the run down with it.
      'nextjs-portal{display:none !important}',
    ].join(''),
  })
}

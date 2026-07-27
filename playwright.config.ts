import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: './tests/e2e/global-setup.ts',

  // Screenshots are only stable single-threaded — parallel workers race on
  // animation timing and produce flaky diffs.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? 'github' : 'list',

  use: {
    baseURL: 'http://localhost:3000',
    storageState: 'tests/e2e/.auth/storageState.json',
  },

  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.01, animations: 'disabled' },
  },

  // Desktop-only baselines are how a completely broken mobile layout shipped:
  // the nav rail took 236 of 375px, content was crushed into ~140px, and a stat
  // figure was cut mid-number. Every check passed. Mobile is a separate project
  // rather than a wider matrix so its baselines are independently reviewable.
  projects: [
    { name: 'desktop', use: { viewport: { width: 1280, height: 800 } } },
    { name: 'mobile', use: { viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true } },
  ],

  webServer: {
    // node_modules/.bin/next directly, not `pnpm dev` — pnpm's deps-status check
    // runs an install on boot, which needs NODE_AUTH_TOKEN in the shell for the
    // private @merninos registry and fails the run when it is absent.
    command: 'node_modules/.bin/next dev --port 3000',
    url: 'http://localhost:3000/auth/login',
    reuseExistingServer: true,
    timeout: 180_000,
    env: {
      // Criterion 5 can only detect its bug when the page limit is BINDING —
      // i.e. there are more orders in range than one page returns. At the
      // production default (100) against the demo seed the page and the range
      // are the same set, so a broken implementation returns identical numbers
      // to a correct one and the test would pass while proving nothing.
      //
      // Setting it low here is far cheaper than seeding 101 orders, and means
      // the suite is meaningful by default rather than red by default — a test
      // that always fails is a test people delete.
      ORDERS_PAGE_LIMIT: '3',
    },
  },
})

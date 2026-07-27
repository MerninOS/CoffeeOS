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

  webServer: {
    // node_modules/.bin/next directly, not `pnpm dev` — pnpm's deps-status check
    // runs an install on boot, which needs NODE_AUTH_TOKEN in the shell for the
    // private @merninos registry and fails the run when it is absent.
    command: 'node_modules/.bin/next dev --port 3000',
    url: 'http://localhost:3000/auth/login',
    reuseExistingServer: true,
    timeout: 180_000,
  },
})

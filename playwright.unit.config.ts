import { defineConfig } from '@playwright/test'

/**
 * Node-only unit tests. Separate config rather than a project in
 * `playwright.config.ts` because its `webServer` is GLOBAL — a project there
 * would boot Next just to execute pure functions, and the auth setup project is
 * a dependency of every browser project in it.
 *
 * The main config's `testDir` is `./tests/e2e`, so it never picks these up and
 * the two suites cannot collide.
 *
 * Run with `pnpm test:unit`. No browser, no server, no storage state.
 */
export default defineConfig({
  testDir: './tests/unit',
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? 'github' : 'list',
  fullyParallel: true,
})

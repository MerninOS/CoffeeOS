import { defineConfig } from '@playwright/test'
import { loadEnvLocal } from './tests/e2e/support/env'

// Before PORT is read below — this worktree's .env.local is its own config.
loadEnvLocal()

/**
 * The dev-server port, overridable so two worktrees can run the suite at once.
 *
 * This repo now carries several concurrent worktrees, and `reuseExistingServer`
 * below ADOPTS whatever is already on the port. With the port hard-coded, a run
 * started in worktree A silently tests worktree B's code — the failures look
 * like assertion bugs, not a wrong-server bug, because the page renders fine.
 * Defaults to 3000, so nothing changes unless PORT is set.
 */
const PORT = process.env.PORT ?? '3000'

export default defineConfig({
  testDir: './tests/e2e',

  // Screenshots are only stable single-threaded — parallel workers race on
  // animation timing and produce flaky diffs.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? 'github' : 'list',

  // These specs drive a real `next dev` against a live Supabase, so a run can
  // lose a test to a network round-trip that simply took too long. With retries
  // at 0 that landed as a hard failure, which made a red run and a green run
  // mean the same thing: measured over four runs of the same four specs, clean
  // main gave 48/0 then 47/1, and a branch that only moved a pure function gave
  // 46/2 then 45/3 — a DIFFERENT test failing each time, none reproducible in
  // isolation. A suite with that much noise cannot gate anything, and CoffeeOS#69
  // asks it to gate two: "Stage A moves no pixel" and the six behavioural COGS
  // tests written before the Stage B rewrite.
  //
  // One retry, not more. It separates a transient timeout from a real
  // regression without hiding a test that fails half the time — that still
  // shows up, as `flaky`, which is the signal we actually want.
  retries: 1,

  use: {
    baseURL: `http://localhost:${PORT}`,
    storageState: 'tests/e2e/.auth/storageState.json',
  },

  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.01, animations: 'disabled' },
  },

  projects: [
    // Auth lives here rather than in `globalSetup` because globalSetup runs
    // ahead of EVERY run regardless of which spec you asked for. When it threw,
    // `playwright test tests/e2e/design-rulings.spec.ts` — a spec that reads
    // files off disk and never opens a browser — reported "could not sign in",
    // and no spec in the repo could execute while anything about auth was
    // broken (CoffeeOS#119). As a dependency it still stops everything that
    // needs a session, and nothing that doesn't.
    //
    // `.setup.ts` is outside the default `**/*.spec.ts` match, so this file is
    // automatically excluded from the projects below rather than needing to be
    // ignored by name.
    //
    // storageState is cleared because this project WRITES that file: inheriting
    // `use.storageState` would make it a precondition of producing itself, and
    // the first run of a fresh checkout would fail on the missing file.
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
      use: { viewport: { width: 1280, height: 800 }, storageState: undefined },
    },

    // Specs that assert on source files, not on a rendered page. They need no
    // session and no viewport, so they neither depend on `setup` nor run twice
    // across the viewport matrix.
    {
      name: 'static',
      testMatch: /design-rulings\.spec\.ts/,
      use: { storageState: undefined },
    },

    // Desktop-only baselines are how a completely broken mobile layout shipped:
    // the nav rail took 236 of 375px, content was crushed into ~140px, and a stat
    // figure was cut mid-number. Every check passed. Mobile is a separate project
    // rather than a wider matrix so its baselines are independently reviewable.
    {
      name: 'desktop',
      testIgnore: /design-rulings\.spec\.ts/,
      dependencies: ['setup'],
      use: { viewport: { width: 1280, height: 800 } },
    },
    {
      name: 'mobile',
      testIgnore: /design-rulings\.spec\.ts/,
      dependencies: ['setup'],
      use: { viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true },
    },
  ],

  webServer: {
    // node_modules/.bin/next directly, not `pnpm dev` — pnpm's deps-status check
    // runs an install on boot, which needs NODE_AUTH_TOKEN in the shell for the
    // private @merninos registry and fails the run when it is absent.
    command: `node_modules/.bin/next dev --port ${PORT}`,
    url: `http://localhost:${PORT}/auth/login`,
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

      // Serves tests/fixtures/shopify-catalog.json instead of calling Shopify.
      // The sync runs inside a server action, so the request never leaves the
      // server and page.route() cannot intercept it — this env var is the ONLY
      // seam. lib/shopify-client.ts additionally refuses it when NODE_ENV is
      // production, so it cannot divert a real deployment.
      //
      // ⚠ `reuseExistingServer: true` above means a dev server already on :3000
      // is ADOPTED and this whole env block is silently ignored. The sync specs
      // then hit the real Shopify API and fail with a 401 that looks nothing
      // like the actual cause. Kill port 3000 before running them:
      //   lsof -ti:3000 | xargs kill -9 2>/dev/null; pnpm test:e2e
      // This is the same trap ORDERS_PAGE_LIMIT hit in CoffeeOS#88.
      SHOPIFY_FIXTURE_MODE: '1',

      // Lets a SECOND test account through the billing gate.
      //
      // lib/supabase/proxy.ts redirects any user whose workspace lacks active
      // billing to /settings?error=billing_not_active&action=activate_billing.
      // The demo workspace has billing_status null, so the only reason the suite
      // works at all is `isDemoUserEmail()` in lib/shopify-billing.ts — a
      // hardcoded match on the single literal "demo@coffeeos.io".
      //
      // That makes the suite's access model unextendable: the seeded roaster
      // (CoffeeOS#74 criterion 18) is gated, bounced through the settings
      // auto-activate effect, and ends up back on /auth/login — which surfaces
      // as a 30s waitForURL timeout in global setup, nothing like its cause.
      //
      // This flips the bypass that lib/shopify-billing.ts already exposes, for
      // the test server only. It is NOT a code change and NOT a data change:
      // .env.local ships `false`, and process env wins over the env files Next
      // loads. The gate is all this affects — /settings still reads
      // billing_status itself, so the page still renders its blocked state.
      SHOPIFY_BILLING_TEST: '1',
    },
  },
})

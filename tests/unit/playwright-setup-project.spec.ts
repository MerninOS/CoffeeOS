import { test, expect } from '@playwright/test'
import config from '../../playwright.config'

/**
 * Guards the one property of the e2e config that only fails on someone else's
 * machine.
 *
 * `tests/e2e/auth.setup.ts` WRITES `tests/e2e/.auth/storageState.json`. The
 * top-level `use.storageState` points at that same file, so if the setup project
 * inherits it, the project that creates the file requires the file to exist —
 * and the first run on a checkout without `tests/e2e/.auth/` dies with
 * `ENOENT: tests/e2e/.auth/storageState.json`, reported against the setup test
 * rather than anything to do with the spec you asked for.
 *
 * It regressed exactly once already (CoffeeOS#119 → #120) via
 * `storageState: undefined`, which reads like "clear it" but means "inherit" in
 * a Playwright `use` block. Nobody with a saved session could see it.
 *
 * Asserted statically because reproducing it needs a pristine checkout, which no
 * test run has.
 */
test('the setup project does not inherit the storageState it writes', () => {
  const setup = config.projects?.find((p) => p.name === 'setup')
  expect(setup, 'no project named "setup" — did the auth project get renamed?').toBeDefined()

  const state = setup!.use?.storageState

  expect(
    typeof state,
    'setup.use.storageState must be an explicit empty state object. ' +
      '`undefined` means INHERIT in a `use` block, not clear, so it resolves to ' +
      'the top-level path — the file this project exists to create.'
  ).toBe('object')

  // A path string would be the same bug wearing different clothes.
  expect(typeof state).not.toBe('string')

  expect(state, 'the empty state must have no cookies and no origins').toEqual({
    cookies: [],
    origins: [],
  })
})

test('every browser project depends on setup, so none reads a session that was never written', () => {
  // The inverse mistake: a project that needs a session but skips the dependency
  // reads a stale or missing storageState and silently tests logged out.
  const browserProjects = (config.projects ?? []).filter(
    (p) => p.name !== 'setup' && p.name !== 'static'
  )
  expect(browserProjects.length, 'expected desktop and mobile projects').toBeGreaterThan(0)

  for (const p of browserProjects) {
    expect(p.dependencies, `project "${p.name}" must depend on setup`).toContain('setup')
  }
})

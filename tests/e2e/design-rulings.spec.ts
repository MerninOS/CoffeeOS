import { test, expect } from '@playwright/test'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import path from 'node:path'

/**
 * Static checks, not browser tests — they live here because Playwright is this
 * repo's only runner.
 *
 * These enforce two design rulings made on 2026-07-27 while converting the
 * dashboard to the instrument design system. Both are the kind of decision that
 * erodes quietly: someone reaches for a nice-looking token, it renders fine, and
 * nobody notices the UI is now asserting something untrue about the data.
 */

const ROOTS = ['app', 'components', 'lib']
const CODE = /\.(tsx?|jsx?|css)$/

function sources(): string[] {
  const walk = (dir: string): string[] =>
    existsSync(dir)
      ? readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
          const p = path.join(dir, e.name)
          if (e.isDirectory()) return e.name === 'node_modules' ? [] : walk(p)
          return CODE.test(e.name) ? [p] : []
        })
      : []
  return ROOTS.flatMap(walk)
}

const offenders = (re: RegExp) =>
  sources()
    .map((f) => [f, readFileSync(f, 'utf8')] as const)
    .filter(([, src]) => re.test(src))
    .map(([f, src]) => `${f} → ${src.match(re)?.[0]}`)

test.describe('design ruling: the roast ramp is aspirational', () => {
  // There is no roast-level data in CoffeeOS — no roast_level, agtron,
  // development_time, first_crack, charge_temp or drop_temp in the schema or the
  // app. The ramp encodes roast darkness, so with nothing to bind to it would be
  // decoration, which the design system forbids in the same sentence that
  // introduces it. Ruled: do not show it until roasting_batches.roast_level exists.
  //
  // Explicitly NOT mapped onto loss_percent either — that is a three-stop
  // in-spec/out-of-spec signal, and a colour meaning one thing now and another
  // later is worse than no colour.
  test('no app code references --roast-*', () => {
    expect(
      offenders(/var\(\s*--roast-\d/),
      'the roast ramp may not be used until roast-level data exists'
    ).toEqual([])
  })

  test('the tokens still ship, so this is a usage ban and not a missing token', () => {
    // Guards the opposite failure: if the token layer silently stopped shipping
    // --roast-*, the assertion above would pass for the wrong reason.
    const tokens = readFileSync(
      'node_modules/@merninos/ui/dist/instrument/styles.css',
      'utf8'
    )
    expect(tokens).toMatch(/--roast-0:/)
    expect(tokens).toMatch(/--roast-5:/)
  })
})

test.describe('design ruling: nothing may claim to be live', () => {
  // There is no live layer in this app: no polling, no realtime subscription, no
  // timer, no status column on roasting_sessions. roast_minutes is typed in after
  // the roast. A pulsing "live" indicator over a value that only changes on page
  // load is a lie about the data, so pulse and tone="live" are banned until a
  // real live layer exists.
  test('no component is rendered with pulse', () => {
    expect(
      offenders(/\bpulse(\s*=\s*\{?\s*true|\s*[}/>])/),
      'Badge pulse implies live data; none exists yet'
    ).toEqual([])
  })

  test('no stat is rendered with tone="live"', () => {
    expect(
      offenders(/tone\s*=\s*["'{]?\s*live/),
      'Stat tone="live" implies live data; none exists yet'
    ).toEqual([])
  })

  test('AppShell is not given a batchStrip', () => {
    expect(
      offenders(/batchStrip\s*=/),
      'BatchStrip needs session status, batch start times and a realtime layer'
    ).toEqual([])
  })
})

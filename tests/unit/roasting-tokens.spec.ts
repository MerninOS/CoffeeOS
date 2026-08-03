import { test, expect } from '@playwright/test'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import path from 'node:path'

/**
 * Static guard: the converted roasting surface may not resolve a visual value
 * through a Tailwind class.
 *
 * This repo's Tailwind theme IS the loud Mernin' palette — `bg-cream`,
 * `text-espresso`, `shadow-flat-md`, `border-fog` all render the OTHER design
 * system, correctly and silently. Nothing catches that: the page looks
 * deliberate, the screenshots pass at 1% tolerance, and the capability tests
 * assert effects rather than styling. So it is caught here instead, statically.
 *
 * Scoped to what has actually converted. Sessions, batches, session detail and
 * settings are still loud on purpose and convert in later stages of CoffeeOS#71
 * — add each to FILES as it lands, rather than widening the glob and having to
 * disable the check.
 */
const ROOT = 'app/(dashboard)/roasting'
const FILES = [
  `${ROOT}/layout.tsx`,
  `${ROOT}/roasting-page-client.tsx`,
  `${ROOT}/roast-requests-client.tsx`,
  `${ROOT}/sessions-client.tsx`,
]
const DIRS = [`${ROOT}/components`]

const LOUD =
  /\b(?:bg|text|border|shadow|divide|ring|from|to|via|fill|stroke|placeholder|accent|caret)-(?:cream|espresso|tomato|sun|sky|chalk|roast|honey|matcha|fog)\b|shadow-flat-(?:sm|md|lg)|rounded-\[\d+px\]/

const walk = (dir: string): string[] =>
  existsSync(dir)
    ? readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
        const p = path.join(dir, e.name)
        return e.isDirectory() ? walk(p) : /\.tsx?$/.test(e.name) ? [p] : []
      })
    : []

test('the converted roasting surface takes no visual value from a Tailwind class', () => {
  const files = [...FILES.filter(existsSync), ...DIRS.flatMap(walk)]

  // Guards the opposite failure: an empty file list would pass for the wrong
  // reason if a path were renamed, and the check would sit there green forever.
  expect(
    files.length,
    'no roasting source files matched — did a path move?'
  ).toBeGreaterThan(5)

  const offenders = files
    .map((f) => [f, readFileSync(f, 'utf8')] as const)
    .filter(([, src]) => LOUD.test(src))
    .map(([f, src]) => `${f} → ${src.match(LOUD)?.[0]}`)

  expect(
    offenders,
    "this repo's Tailwind theme is the LOUD palette — read tokens as var(--token)"
  ).toEqual([])
})

test('units are pounds, not grams, everywhere on the converted surface', () => {
  // The surface stores grams and displayed them inconsistently before this
  // conversion. A stray `}g` is how that creeps back one cell at a time.
  const files = [...FILES.filter(existsSync), ...DIRS.flatMap(walk)]
  const offenders = files
    .map((f) => [f, readFileSync(f, 'utf8')] as const)
    .filter(([, src]) => /toLocaleString\(\)\}g/.test(src))
    .map(([f]) => f)

  expect(offenders, 'render weights through lb()/lbs() from units.ts').toEqual([])
})

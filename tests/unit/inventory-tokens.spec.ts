import { test, expect } from '@playwright/test'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'

/**
 * Guards over /inventory that fail SILENTLY in production if they are wrong,
 * which is why they are tests rather than review notes (CoffeeOS#72
 * Criteria 1, 5, 11, 20).
 *
 * 1. NO LOUD PALETTE. This repo's Tailwind theme is the loud Mernin' palette, so
 *    `bg-cream` or `text-espresso` compile fine, render fine, typecheck fine —
 *    and silently paint the other design system inside the Instrument shell.
 * 2. NO BANNED DESIGN-SYSTEM ELEMENTS. The roast ramp and the live register have
 *    no data behind them in CoffeeOS (ruled 2026-07-27).
 * 3. NO RE-DERIVED ARITHMETIC. The conversion constant and the low-stock rule
 *    live in lib/inventory/, so a component re-typing either reopens exactly the
 *    drift the extraction closed.
 */

const ROUTE = path.join(__dirname, '..', '..', 'app', '(dashboard)', 'inventory')

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) return sourceFiles(full)
    return /\.tsx?$/.test(entry) ? [full] : []
  })
}

/**
 * Every `className="…"` value on the route.
 *
 * Attribute contents, NOT raw file text. These files name `bg-cream` and
 * `text-espresso` in their docstrings — explaining precisely what not to use —
 * and a whole-file grep flags that prose. The natural "fix" is then to delete a
 * useful comment, which is the opposite of what this guard is for.
 */
function classNamesIn(file: string): string[] {
  const src = readFileSync(file, 'utf8')
  const out: string[] = []
  for (const m of src.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)) {
    out.push(m[1] ?? m[2] ?? '')
  }
  return out
}

/** Block and line comments, so prose about a banned token is not a violation. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
}

const LOUD =
  /\b(bg|text|border|from|to|via|divide|ring|shadow)-(cream|chalk|espresso|tomato|sun|sky|roast|honey|matcha|fog)\b|\bshadow-flat-/

test.describe('/inventory renders on instrument only', () => {
  test('the guard actually visits the route', () => {
    // Without this the regex assertions below pass vacuously if the path ever
    // moves — a green test proving nothing is worse than no test.
    const files = sourceFiles(ROUTE)
    expect(files.length).toBeGreaterThanOrEqual(5)
    expect(files.some((f) => f.endsWith('InventoryWorksheetTable.tsx'))).toBe(true)
    expect(files.some((f) => f.endsWith('InventoryDialogs.tsx'))).toBe(true)
  })

  test('no loud-Mernin palette class survives in any className', () => {
    const offenders = sourceFiles(ROUTE).flatMap((file) =>
      classNamesIn(file)
        .filter((cls) => LOUD.test(cls))
        .map((cls) => `${path.basename(file)} → ${cls.match(LOUD)?.[0]}`),
    )
    expect(offenders, 'Tailwind is layout-only on this route').toEqual([])
  })

  test('the banned design-system elements stay absent', () => {
    // The roast ramp encodes roast darkness and CoffeeOS has no roast-level
    // data; `tone="live"` and Badge `pulse` claim a realtime layer that does not
    // exist. tests/e2e/design-rulings.spec.ts enforces the ramp repo-wide; this
    // covers the two props that spec Criterion 5 names for this route.
    // Comments are stripped first. These files EXPLAIN why `tone="live"` is
    // banned, and a raw-text scan flags that prose — the natural "fix" being to
    // delete the explanation, which is the opposite of the point. Same trap the
    // className guard above avoids by reading attribute values only.
    const src = sourceFiles(ROUTE).map(
      (f) => [f, stripComments(readFileSync(f, 'utf8'))] as const,
    )
    const banned = src.flatMap(([f, text]) =>
      [
        /var\(\s*--roast-\d/,
        /tone=["']live["']/,
        // The Badge prop, NOT Tailwind's `animate-pulse`.
        /(?<![-\w])pulse(?:\s*=|\s*[/>])/,
      ]
        .filter((re) => re.test(text))
        .map((re) => `${path.basename(f)} → ${text.match(re)?.[0]}`),
    )
    expect(banned).toEqual([])
  })

  test('the conversion constant and the low rule are not re-derived', () => {
    const src = sourceFiles(ROUTE).map((f) => [f, readFileSync(f, 'utf8')] as const)

    // Criterion 20: one conversion constant, in lib/inventory/units.ts. The
    // lib/ modules are scanned too — the first draft of movements.ts declared
    // its own divisor, which is precisely the drift the extraction closed and
    // which a route-only scan would have missed.
    const libFiles = sourceFiles(path.join(__dirname, '..', '..', 'lib', 'inventory'))
    const withConstant = [...src.map(([f, t]) => [f, t] as const),
      ...libFiles.map((f) => [f, readFileSync(f, 'utf8')] as const)]
      .filter(([f, t]) => t.includes('453.592') && !f.endsWith('units.ts'))
      .map(([f]) => path.basename(f))
    expect(withConstant, 'import from lib/inventory/units.ts').toEqual([])

    // Criterion 11: the low-stock threshold is an imported binding, never a
    // bare comparison. Matches `< 5`, `<5`, `<= 5` against a lbs-ish name.
    const inline = src.flatMap(([f, t]) =>
      /\b(green|lbs|Lbs|quantity)\w*\s*<=?\s*5\b/.test(t) ? [path.basename(f)] : [],
    )
    expect(inline, 'import LOW_STOCK_LB instead of comparing against 5').toEqual([])
  })
})

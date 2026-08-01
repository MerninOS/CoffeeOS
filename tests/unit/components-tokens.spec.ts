import { test, expect } from '@playwright/test'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'

/**
 * Three guards over /components, all of which fail silently in production if
 * they are wrong — which is why they exist as tests rather than review notes.
 *
 * 1. NO LOUD PALETTE. This repo's Tailwind theme is the loud Mernin' palette, so
 *    `bg-cream` or `text-espresso` compile fine, render fine, typecheck fine —
 *    and silently paint the other design system inside the Instrument shell.
 *
 * 2. NO RE-DERIVED COST RULES. `fmtCost` and `isUncosted` live in
 *    lib/components/format.ts so the unit tests assert the rules the UI actually
 *    uses. Reimplementing one in a component reopens exactly the split-brain
 *    CoffeeOS#100 closed between /orders and /orders/[id], and nothing visible
 *    breaks when it happens. The design mock shipped working mirrors of both,
 *    which makes copying them the path of least resistance.
 *
 * 3. DIALOGS DECLARE THEIR SURFACE. Radix portals dialog content to <body>,
 *    outside the AppShell subtree that scopes the instrument token layer, so
 *    without `data-surface="app"` on the content root every var(--token) inside
 *    resolves to nothing and the dialog renders unstyled. /products asserts the
 *    same thing for the same reason.
 *
 * Cloned from tests/unit/orders-detail-tokens.spec.ts, including its
 * counter-assertions: a guard that cannot be shown to fire is not a guard.
 */

const ROUTE = path.join(__dirname, '..', '..', 'app', '(dashboard)', 'components')
const LOUD_ROUTE = path.join(__dirname, '..', '..', 'app', '(dashboard)', 'roasting')
const GLOBALS = path.join(__dirname, '..', '..', 'app', 'globals.css')
const DIALOGS = path.join(ROUTE, 'components', 'ComponentDialogs.tsx')

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
 * Attribute contents, NOT raw file text. Several files here name `bg-cream` and
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

/**
 * The loud palette, derived from the @theme block rather than hard-coded — a
 * hand-written list silently stops covering a token added to the theme later,
 * so the guard would keep passing while a new loud colour leaked onto the route.
 */
function loudTokens(): string[] {
  const css = readFileSync(GLOBALS, 'utf8')
  const section = css.slice(css.indexOf("Mernin' Brand Palette"))
  const colors = [...section.matchAll(/--color-([a-z]+):\s*var\(--mernin-/g)].map((m) => m[1])
  const shadows = [...section.matchAll(/--shadow-(flat-[a-z]+):/g)].map((m) => m[1])
  expect(colors.length, 'parsed the loud palette out of globals.css').toBeGreaterThan(5)
  return [...colors, ...shadows]
}

const PREFIXES = ['bg', 'text', 'border', 'ring', 'fill', 'stroke', 'from', 'to', 'via', 'decoration', 'shadow', 'divide', 'outline', 'accent', 'caret']

function loudClassOffences(root: string): string[] {
  const tokens = loudTokens()
  const pattern = new RegExp(`\\b(?:${PREFIXES.join('|')})-(?:${tokens.join('|')})\\b`, 'g')
  const offences: string[] = []
  for (const file of sourceFiles(root)) {
    for (const value of classNamesIn(file)) {
      for (const hit of value.matchAll(pattern)) {
        offences.push(`${path.relative(root, file)}: ${hit[0]}`)
      }
    }
  }
  return offences
}

test('no file on /components uses a loud-palette Tailwind class', () => {
  expect(
    loudClassOffences(ROUTE),
    'loud-palette classes silently render the other design system inside the ' +
      'Instrument shell — read design values as var(--token) in inline styles',
  ).toEqual([])
})

test('the loud-palette check can actually fire', () => {
  // Without this, a regex that matched nothing would pass forever and the guard
  // above would be decorative. /roasting is unconverted and must trip it.
  expect(
    loudClassOffences(LOUD_ROUTE).length,
    'the guard found nothing even on an unconverted route — it is broken, not satisfied',
  ).toBeGreaterThan(0)
})

test('no file on /components re-derives a rule that lib/components/format.ts owns', () => {
  const offences: string[] = []
  for (const file of sourceFiles(ROUTE)) {
    const src = readFileSync(file, 'utf8')
    // Strip comments: these rules are DESCRIBED in several docstrings on
    // purpose, and describing them is not re-deriving them.
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    const rel = path.relative(ROUTE, file)

    // The LITERAL is forbidden; importing COST_NOT_SET is the sanctioned way to
    // render that state, because it cannot drift.
    if (/["']not set["']/.test(code)) {
      offences.push(`${rel}: hard-codes "not set" — import COST_NOT_SET instead`)
    }
    // The SEMANTICS, not just the spelling. `cost_per_unit === 0` IS
    // isUncosted's rule, and a guard that only knows a literal cannot protect a
    // rule — the lesson orders-detail-tokens learned when MarginHero re-derived
    // cogsLabel as `costKnown || cogs !== 0` and sailed past two checks.
    if (/cost_per_unit\s*[!=]==?\s*0\b/.test(code)) {
      offences.push(`${rel}: comparing cost_per_unit to 0 re-derives isUncosted()`)
    }
    // Any local formatting of a cost. fmtCost owns the decimal rule, and a
    // stray toFixed is how a second, disagreeing rule gets born.
    if (/\.toFixed\(/.test(code)) {
      offences.push(`${rel}: formats a figure locally — fmtCost() owns the decimal rule`)
    }
  }

  expect(
    offences,
    'these rules live in lib/components/format.ts so tests assert what the UI ' +
      'uses; re-deriving one is invisible until two screens disagree about a cost',
  ).toEqual([])
})

test('both portalled dialog roots declare data-surface="app"', () => {
  const src = readFileSync(DIALOGS, 'utf8')

  // One per Radix content root. Radix portals these outside the AppShell
  // subtree that scopes the tokens, so a missing attribute renders the dialog
  // completely unstyled — and only that dialog, which is easy to miss.
  const roots = [...src.matchAll(/<(?:AlertDialogContent|DialogContent)\b[^>]*>/g)].map((m) => m[0])
  expect(roots.length, 'expected both dialog content roots in ComponentDialogs.tsx').toBe(2)

  for (const root of roots) {
    expect(
      root.includes('data-surface="app"'),
      `a Radix content root is missing data-surface="app": ${root.slice(0, 60)}…`,
    ).toBe(true)
  }
})

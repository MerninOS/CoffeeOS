import { test, expect } from '@playwright/test'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'

/**
 * Two guards over /orders/[id], both of which fail silently in production if
 * they are wrong — which is why they exist as tests rather than review notes.
 *
 * 1. NO LOUD PALETTE. This repo's Tailwind theme is the loud Mernin' palette, so
 *    `bg-cream` or `text-espresso` compile fine, render fine, typecheck fine —
 *    and silently paint the other design system inside the Instrument shell.
 *
 * 2. NO RE-DERIVED COSTING RULES. `cogsLabel`, `mayShowMargin` and
 *    `blockingReason` live in lib/orders/format.ts so the tests assert the rules
 *    the UI actually uses. Reimplementing one in a component reopens the
 *    split-brain between /orders and /orders/[id] that CoffeeOS#100 closed, and
 *    nothing visible breaks when it happens (spec criterion 12d). The design
 *    mock ships working mirrors of all three, which makes copying them the path
 *    of least resistance.
 */

const ROUTE = path.join(__dirname, '..', '..', 'app', '(dashboard)', 'orders', '[id]')
const GLOBALS = path.join(__dirname, '..', '..', 'app', 'globals.css')

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
 * Attribute contents, NOT raw file text. Worksheet.tsx names `bg-cream` and
 * `text-espresso` in its docstring — explaining precisely what not to use — and
 * a whole-file grep flags that prose. The natural "fix" is then to delete a
 * useful comment, which is the opposite of what this guard is for.
 */
function classNamesIn(file: string): string[] {
  const src = readFileSync(file, 'utf8')
  const out: string[] = []
  // Plain string attributes and template-literal attributes both count.
  for (const m of src.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)) {
    out.push(m[1] ?? m[2] ?? '')
  }
  return out
}

/**
 * The loud palette, derived from the @theme block rather than hard-coded.
 *
 * Criterion 9's false-positive check: a hand-written list silently stops
 * covering a token added to the theme later, so the guard would keep passing
 * while a new loud colour leaked onto the route.
 */
function loudTokens(): string[] {
  const css = readFileSync(GLOBALS, 'utf8')
  const section = css.slice(css.indexOf("Mernin' Brand Palette"))
  const colors = [...section.matchAll(/--color-([a-z]+):\s*var\(--mernin-/g)].map((m) => m[1])
  const shadows = [...section.matchAll(/--shadow-(flat-[a-z]+):/g)].map((m) => m[1])
  expect(colors.length, 'parsed the loud palette out of globals.css').toBeGreaterThan(5)
  return [...colors, ...shadows]
}

test('no file on /orders/[id] uses a loud-palette Tailwind class', () => {
  const tokens = loudTokens()
  // The utility prefixes Tailwind generates for a colour token.
  const prefixes = ['bg', 'text', 'border', 'ring', 'fill', 'stroke', 'from', 'to', 'via', 'decoration', 'shadow', 'divide', 'outline', 'accent', 'caret']
  const pattern = new RegExp(
    `\\b(?:${prefixes.join('|')})-(?:${tokens.join('|')})\\b`,
    'g',
  )

  const offences: string[] = []
  for (const file of sourceFiles(ROUTE)) {
    for (const value of classNamesIn(file)) {
      for (const hit of value.matchAll(pattern)) {
        offences.push(`${path.relative(ROUTE, file)}: ${hit[0]}`)
      }
    }
  }

  expect(
    offences,
    'loud-palette classes silently render the other design system inside the ' +
      'Instrument shell — read design values as var(--token) in inline styles',
  ).toEqual([])
})

test('no file on /orders/[id] re-derives a costing rule that lib/orders/format.ts owns', () => {
  const offences: string[] = []
  for (const file of sourceFiles(ROUTE)) {
    const src = readFileSync(file, 'utf8')
    // Strip comments: these rules are DESCRIBED in several docstrings on
    // purpose, and describing them is not re-deriving them.
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    const rel = path.relative(ROUTE, file)

    // The LITERAL is forbidden; importing COGS_NOT_SET from format.ts is the
    // sanctioned way to branch on that state, because it cannot drift.
    if (/["']not set["']/.test(code)) {
      offences.push(`${rel}: hard-codes "not set" — import COGS_NOT_SET instead`)
    }
    if (/===\s*["']costed["']/.test(code)) {
      offences.push(`${rel}: the costed check belongs to mayShowMargin()`)
    }
    // The SEMANTICS, not just the literal. MarginHero re-derived cogsLabel's
    // rule as `costKnown || cogs !== 0` and the two checks above sailed past
    // it, because neither the "not set" string nor === "costed" appears in it.
    // A guard that only knows the spelling of a rule cannot protect the rule.
    if (/\bcogs\s*[!=]==?\s*0\b/.test(code)) {
      offences.push(`${rel}: comparing cogs to 0 re-derives cogsLabel()'s rule`)
    }
  }

  expect(
    offences,
    'these rules live in lib/orders/format.ts so tests assert what the UI uses; ' +
      're-deriving one reopens the /orders vs /orders/[id] split-brain (CoffeeOS#100)',
  ).toEqual([])
})

import { test, expect } from '@playwright/test'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import path from 'node:path'

/**
 * Static checks over app/(dashboard)/settings/, modelled on
 * tests/unit/orders-detail-tokens.spec.ts. They live in the unit suite because
 * they read source, not a browser.
 *
 * Two rules, each of which has already been broken once elsewhere in this repo.
 *
 * 1. Instrument values are never resolved through a Tailwind class. This repo's
 *    Tailwind theme is the LOUD Mernin' palette, so `bg-cream` or
 *    `text-espresso` silently render the other design system inside the
 *    instrument shell — it looks deliberate, and nothing fails.
 *
 * 2. Nothing outside lib/settings/status.ts reads the three connection fields.
 *    This bans the FIELD NAMES, not the comparisons, and that distinction is the
 *    whole point: orders-detail-tokens.spec.ts:92 records its first two checks
 *    shipping and a re-derivation spelled `costKnown || cogs !== 0` walking
 *    straight past both, so a third had to be added afterwards. A guard that
 *    only knows the spelling of a rule cannot protect the rule. A component that
 *    cannot read `connected_via_oauth` cannot re-derive connectedness at all.
 */

const ROUTE = path.join(process.cwd(), 'app/(dashboard)/settings')
const CODE = /\.(tsx?|jsx?)$/

function sourceFiles(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name)
    return e.isDirectory() ? sourceFiles(p) : CODE.test(e.name) ? [p] : []
  })
}

/** These rules are DESCRIBED in docstrings on purpose; describing is not doing. */
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

/**
 * Loud-palette utilities, plus the two arbitrary-value forms this route actually
 * used — `shadow-[3px_3px_0_#1C0F05]` and `border-[2.5px]`. A scan that only
 * knew the named colours would have passed over half of settings-client.tsx.
 */
const LOUD =
  /\b(?:bg|text|border|ring|from|to|via|fill|stroke|divide|placeholder|accent|decoration|outline)-(?:cream|espresso|tomato|sun|sky|chalk|roast|honey|matcha|fog)\b|\bshadow-flat-(?:sm|md|lg)\b|\bfont-(?:display|headline|body)\b|\bshadow-\[[^\]]*#(?:1C0F05|E8442A|5BC8D5)[^\]]*\]|\bborder-\[[\d.]+px\]/i

test('no file under /settings resolves an instrument value through Tailwind', () => {
  const offences: string[] = []
  for (const file of sourceFiles(ROUTE)) {
    const code = stripComments(readFileSync(file, 'utf8'))
    const hit = code.match(LOUD)
    if (hit) offences.push(`${path.relative(ROUTE, file)} → ${hit[0]}`)
  }
  expect(
    offences,
    'loud-palette classes silently render the other design system inside the ' +
      'Instrument shell — read design values as var(--token) in inline styles',
  ).toEqual([])
})

test('lib/settings/status.ts is the only reader of the connection fields', () => {
  const FIELDS = ['connected_via_oauth', 'has_admin_credentials', 'billing_status']
  const offences: string[] = []
  for (const file of sourceFiles(ROUTE)) {
    const rel = path.relative(ROUTE, file)
    // types.ts DECLARES the shape. Declaring a field is not reading it, and the
    // type has to name them for lib/settings/status.ts to consume the object.
    if (rel === 'components/types.ts') continue
    const code = stripComments(readFileSync(file, 'utf8'))
    for (const f of FIELDS) {
      if (new RegExp(`\\b${f}\\b`).test(code)) {
        offences.push(`${rel}: reads ${f} — call lib/settings/status.ts instead`)
      }
    }
  }
  expect(
    offences,
    'these rules live in lib/settings/status.ts so the unit tests assert what ' +
      'the UI actually uses; re-deriving one reopens the split-brain ' +
      'CoffeeOS#100 closed on /orders',
  ).toEqual([])
})

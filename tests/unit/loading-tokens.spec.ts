import { test, expect } from '@playwright/test'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import path from 'node:path'

/**
 * Static guard over EVERY loading.tsx under app/(dashboard).
 *
 * The per-route token guards (roasting, settings, products, components,
 * inventory, orders) are allowlists or per-route sweeps, and a route skeleton
 * fell through both kinds. `roasting/loading.tsx` was simply never added to that
 * spec's FILES; `(dashboard)/loading.tsx` belongs to the route GROUP and sits
 * under no route directory at all, so no sweep reached it. Both stayed loud for
 * the whole conversion with every test green.
 *
 * Nothing else catches this. A skeleton is only on screen for the length of a
 * server round trip, so it is absent from screenshot baselines and from every
 * capability test — it is exactly the frame that is never looked at, which is
 * why it needs a guard that finds files rather than one that is told about them.
 *
 * Discovery is deliberate: this walks the tree instead of listing paths, so a
 * new route's skeleton is covered the moment it exists.
 */

const GROUP = path.join(process.cwd(), 'app/(dashboard)')

/**
 * Loud-palette utilities plus the arbitrary forms skeletons reach for — chunky
 * `border-[3px]`, comic `rounded-[16px]`, the flat offset shadow. Skeletons are
 * mostly boxes, so those three carry the loud look even with no colour class.
 */
const LOUD =
  /\b(?:bg|text|border|shadow|divide|ring|from|to|via|fill|stroke|placeholder|accent|caret)-(?:cream|espresso|tomato|sun|sky|chalk|roast|honey|matcha|fog)\b|\bshadow-flat-(?:sm|md|lg)\b|\brounded-\[\d+px\]|\bborder-\[[\d.]+px\]/

/** The rules are described in the docstrings above each skeleton on purpose. */
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

function skeletons(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) return skeletons(p)
    return e.name === 'loading.tsx' ? [p] : []
  })
}

test('no route skeleton resolves a visual value through a Tailwind class', () => {
  const files = skeletons(GROUP)

  // An empty list would pass for the wrong reason if the group directory moved,
  // and this check would sit green forever — the failure it exists to prevent.
  expect(
    files.length,
    'no loading.tsx found under app/(dashboard) — did the route group move?',
  ).toBeGreaterThan(4)

  const offenders = files
    .map((f) => [f, stripComments(readFileSync(f, 'utf8'))] as const)
    .filter(([, src]) => LOUD.test(src))
    .map(([f, src]) => `${path.relative(GROUP, f)} → ${src.match(LOUD)?.[0]}`)

  expect(
    offenders,
    "this repo's Tailwind theme is the LOUD palette, so these classes paint the " +
      'other design system for the length of every navigation before the page ' +
      'replaces them — read design values as var(--token) in inline styles',
  ).toEqual([])
})

import { test, expect, type Page, type Locator } from '@playwright/test'

/**
 * The six recipe-editing capabilities of /products/[id], asserted by their
 * EFFECT ON COGS rather than by the presence of a control.
 *
 * CoffeeOS#69 Stage A.5. These exist to survive Stage B: the page is about to be
 * rebuilt from loud Mernin' onto instrument, every class string replaced and the
 * duplicate mobile rendering deleted. A test that asserts "the button is there"
 * would pass through a rewrite that quietly stopped saving. A test that asserts
 * "the total moved by exactly cost_per_unit x quantity" cannot.
 *
 * That is why they are written NOW, against the pre-restyle markup, and must be
 * green on this commit's parent. Written after the rewrite they would only
 * assert whatever the rewrite happens to do.
 *
 * Everything is selected by `data-testid`, never by class or copy — those are
 * exactly what Stage B changes. The testids are the contract.
 *
 * Two properties of the page shape these tests:
 *
 * 1. THE PAGE RENDERS EVERY ROW TWICE — a `sm:hidden` card list and a
 *    `hidden sm:block` table — so every testid matches twice. `vis()` filters to
 *    the rendering the current viewport actually shows. Criterion 21 deletes the
 *    duplication in Stage B, at which point `vis()` becomes a no-op rather than
 *    a lie.
 *
 * 2. THE EDITOR IS LOCAL STATE UNTIL SAVED. Tests 1-3 therefore never touch the
 *    database. Only 4 and 5 write, and both restore what they changed.
 */

// Figures render through `fmt`, i.e. THREE decimals ($11.480). Comparing at
// precision 3 matches what the page actually displays; asserting more would be
// asserting on values the operator cannot see.
const PRECISION = 3

/**
 * Cold Brew Blend 5lb: product-mode (no variants), already costed, and uses
 * THREE of the four seeded components — so exactly one remains addable.
 * Yirgacheffe would be the obvious choice but uses all four, which permanently
 * disables "Add Component".
 */
const PRODUCT_MODE_FIXTURE = 'Cold Brew Blend 5lb'

const money = (s: string) => Number(s.replace(/[^0-9.-]/g, ''))

/** The copy of a duplicated element that this viewport actually shows. */
const vis = (l: Locator) => l.filter({ visible: true })

async function hideOnboardingWidget(page: Page) {
  await page.addStyleTag({
    content: 'div.fixed.bottom-4.right-4.z-50 { display: none !important; }',
  })
}

/**
 * Open a product's detail page by NAME.
 *
 * Reads the href and navigates rather than clicking, for the same two reasons
 * baselines.spec.ts does: the onboarding widget covers the row at 375px, and the
 * duplicate renderings make the name match twice.
 */
async function openProduct(page: Page, name: string) {
  await page.goto('/products')
  await expect(page).not.toHaveURL(/\/auth\//)
  const link = page.getByRole('link', { name, exact: false }).first()
  await link.waitFor({ timeout: 20_000 })
  const href = await link.getAttribute('href')
  expect(href, `no detail link for "${name}"`).toMatch(/^\/products\/[0-9a-f-]{36}$/)
  await page.goto(href!)
  await page.waitForLoadState('networkidle')
  await hideOnboardingWidget(page)
}

const cogs = (page: Page) => page.getByTestId('stat-total-cogs')
const rows = (page: Page) => vis(page.getByTestId('recipe-row'))

async function readCogs(page: Page): Promise<number> {
  return money(await cogs(page).innerText())
}

async function expectCogs(page: Page, expected: number, message: string) {
  await expect
    .poll(async () => readCogs(page), { message })
    .toBeCloseTo(expected, PRECISION)
}

/**
 * Adds a component and returns its unit cost, parsed from the row the app itself
 * renders. Deriving the expected delta from the app's own declared price — not a
 * hardcoded number — means the assertion stays exact if the seed's costs change.
 *
 * "Add Component" appends the first component not already used, at quantity 1,
 * so the new row is the last one.
 */
async function addComponent(page: Page): Promise<number> {
  const before = await rows(page).count()

  // Precondition, stated rather than discovered as a 30s timeout: "Add
  // Component" is disabled once every available component is already used, which
  // is how the page prevents adding the same component twice. Yirgacheffe uses
  // all four seeded components, so it can never satisfy this — hence
  // PRODUCT_MODE_FIXTURE is Cold Brew, which uses three of four.
  const add = vis(page.getByTestId('recipe-add'))
  await expect(
    add,
    'Add Component is disabled — this product already uses every seeded component, so nothing can be added'
  ).toBeEnabled()

  await add.click()
  await expect(rows(page)).toHaveCount(before + 1)

  const unitCost = money(await rows(page).last().getByTestId('recipe-unit-cost').innerText())
  expect(unitCost, 'could not parse a unit cost from the new row').toBeGreaterThan(0)
  return unitCost
}

async function removeLastRow(page: Page) {
  const before = await rows(page).count()
  await rows(page).last().getByTestId('recipe-remove').click()
  await expect(rows(page)).toHaveCount(before - 1)
}

async function save(page: Page) {
  await vis(page.getByTestId('recipe-save')).click()
  await expect(page.getByTestId('detail-toast')).toBeVisible()
}

// ── 1-3: the arithmetic, in local state, no writes ──────────────────────────

test.describe('recipe editing moves COGS by exactly the right amount', () => {
  test('1 — adding a component raises COGS by its unit cost', async ({ page }) => {
    await openProduct(page, PRODUCT_MODE_FIXTURE)
    const before = await readCogs(page)
    expect(before, 'fixture product should already be costed').toBeGreaterThan(0)

    const unitCost = await addComponent(page)
    await expectCogs(page, before + unitCost, 'COGS did not rise by the added unit cost')

    await removeLastRow(page)
    await expectCogs(page, before, 'COGS did not settle back after cleanup')
  })

  test('2 — changing a quantity moves COGS by the quantity delta', async ({ page }) => {
    await openProduct(page, PRODUCT_MODE_FIXTURE)
    const before = await readCogs(page)

    const unitCost = await addComponent(page)
    await expectCogs(page, before + unitCost, 'setup: one unit should be reflected')

    // The capability under test: 1 -> 3 must be worth exactly two more units.
    await rows(page).last().getByTestId('recipe-qty').fill('3')
    await expectCogs(page, before + unitCost * 3, 'COGS did not track the quantity')

    await removeLastRow(page)
    await expectCogs(page, before, 'COGS did not settle back after cleanup')
  })

  test('3 — removing a component drops COGS by exactly its contribution', async ({ page }) => {
    await openProduct(page, PRODUCT_MODE_FIXTURE)
    const before = await readCogs(page)

    const unitCost = await addComponent(page)
    await rows(page).last().getByTestId('recipe-qty').fill('4')
    await expectCogs(page, before + unitCost * 4, 'setup: four units should be reflected')

    await removeLastRow(page)
    await expectCogs(page, before, 'removing the row did not remove exactly its contribution')
  })
})

// ── 4-5: the writes, each restoring what it changed ─────────────────────────

test.describe('recipes persist', () => {
  test('4 — a saved product-level recipe survives a reload', async ({ page }) => {
    await openProduct(page, PRODUCT_MODE_FIXTURE)
    const before = await readCogs(page)
    const originalRows = await rows(page).count()

    const unitCost = await addComponent(page)
    await save(page)

    await page.reload()
    await page.waitForLoadState('networkidle')
    await hideOnboardingWidget(page)

    await expect(rows(page), 'the saved row is missing after reload').toHaveCount(originalRows + 1)
    await expectCogs(page, before + unitCost, 'the saved COGS did not survive the reload')

    // Restore, and prove the restore worked — a failed cleanup here would leave
    // the fixture costed differently for every other spec.
    await removeLastRow(page)
    await save(page)
    await page.reload()
    await page.waitForLoadState('networkidle')
    await hideOnboardingWidget(page)
    await expect(rows(page), 'cleanup did not restore the original row count').toHaveCount(originalRows)
    await expectCogs(page, before, 'cleanup did not restore the original COGS')
  })

  test('5 — a saved variant-level recipe survives a reload', async ({ page }) => {
    // Kenya is variant-costed: two variants that agree, so it is COSTED. Editing
    // one writes to product_variant_components, a different table and a
    // different server action from test 4.
    await openProduct(page, 'Kenya Nyeri AA')

    await expect(page.getByTestId('variant-basis-row'), 'fixture should carry two variants').toHaveCount(2)
    const pill = page.locator('[data-testid="variant-basis-row"][data-variant-sku="KEN-NYERI-12"]')
    await pill.click()

    const before = await readCogs(page)
    const originalRows = await rows(page).count()
    expect(originalRows, 'the seeded variant should already have a recipe').toBeGreaterThan(0)

    const unitCost = await addComponent(page)
    await save(page)

    await page.reload()
    await page.waitForLoadState('networkidle')
    await hideOnboardingWidget(page)
    await pill.click()

    await expect(rows(page), 'the saved variant row is missing after reload').toHaveCount(originalRows + 1)
    await expectCogs(page, before + unitCost, 'the saved variant COGS did not survive the reload')

    await removeLastRow(page)
    await save(page)
    await page.reload()
    await page.waitForLoadState('networkidle')
    await hideOnboardingWidget(page)
    await pill.click()
    await expect(rows(page), 'cleanup did not restore the variant row count').toHaveCount(originalRows)
    await expectCogs(page, before, 'cleanup did not restore the variant COGS')
  })
})

// ── 6: the one that matters most ────────────────────────────────────────────

test.describe('variant selection', () => {
  /**
   * Sumatra's two variants cost DIFFERENT amounts on purpose ($11.30 for the
   * 12oz, $29.64 for the 2lb). That difference is the whole point: it is what
   * makes "the page shows the selected variant's cost" falsifiable.
   *
   * This is also the closest thing to a regression test for the class of bug
   * CoffeeOS#85 fixed — variant-level recipes being ignored. That bug reached
   * production because the fixture had no variants at all to read.
   */
  test('6 — switching variant shows that variant\'s COGS, not the other one\'s', async ({ page }) => {
    await openProduct(page, 'Sumatra Mandheling')

    // Selection moved from a pill row to the costing-source table in Stage C —
    // the same act, a different element. The ASSERTIONS below are unchanged.
    const small = page.locator('[data-testid="variant-basis-row"][data-variant-sku="SUM-MAND-12"]')
    const large = page.locator('[data-testid="variant-basis-row"][data-variant-sku="SUM-MAND-2LB"]')
    await expect(small).toHaveCount(1)
    await expect(large).toHaveCount(1)

    await small.click()
    const smallCogs = await readCogs(page)

    await large.click()
    const largeCogs = await readCogs(page)

    // The guard that makes this test mean something: if the two variants cost
    // the same, "it changed" is unfalsifiable and the assertions below would
    // pass against a page that ignores the selection entirely.
    expect(
      Math.abs(largeCogs - smallCogs),
      'fixture variants must differ in cost, or this proves nothing'
    ).toBeGreaterThan(1)

    // And back, to prove the figure tracks the selection rather than only ever
    // moving forwards.
    await small.click()
    await expectCogs(page, smallCogs, 'switching back did not restore the first variant figure')
  })
})

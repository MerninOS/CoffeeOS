import { test, expect, type Page, type Browser } from '@playwright/test'
import { hideOverlays } from './support/overlays'

/**
 * The five behavioural capabilities of the roast requests queue
 * (`/roasting?tab=requests`), asserted by their EFFECT ON THE RENDERED QUEUE
 * rather than by the presence of a control.
 *
 * These exist to survive the upcoming restyle onto instrument (CoffeeOS#71):
 * every class string will be replaced, and (per the components precedent,
 * CoffeeOS#73) the duplicate mobile rendering may be deleted and the Radix
 * Selects may become native `<select>`s. A test that asserts "the button is
 * there" would pass through a rewrite that quietly stopped mutating data. A
 * test that asserts "the row for the probe request now shows Urgent" cannot.
 *
 * Written NOW, against the pre-restyle markup, green on this commit's parent.
 * Everything is selected by `data-testid`, never by class or copy, except
 * where noted — those are exactly what the restyle changes.
 */

/**
 * ── The mobile testid gap ──────────────────────────────────────────────────
 *
 * The testid contract gives `request-menu` (the dropdown trigger) and
 * `menu-edit` / `menu-fulfill` / `menu-delete` (its items). Read against the
 * actual markup:
 *
 *   - RequestsTable.tsx (desktop `hidden md:block` table): the row carries
 *     `request-row`, its trigger `request-menu`, and every menu item its
 *     testid. Its COMPLETED-variant row also carries `request-row`, with a
 *     bare `request-delete` button (no dropdown — completed rows can't be
 *     edited or re-fulfilled).
 *   - RequestCard.tsx (mobile `md:hidden` card list): the ACTIVE-variant card
 *     carries `request-card`, but its own dropdown trigger and every menu
 *     item inside it have NO data-testid at all. The COMPLETED-variant card
 *     has no testid whatsoever, not even a container one.
 *
 * So edit, status-change, and delete — every capability that goes through the
 * row dropdown or the completed-row delete button — has no stable, markup-
 * independent way to be driven on a mobile viewport today. This is a real gap
 * in the testid contract, not a choice made here; it is called out per-test
 * below rather than silently skipped, and desktop still exercises all five
 * capabilities. `observe` and `create` do not need the dropdown at all — the
 * dialog and both row-list containers are equally reachable on both
 * viewports — so those two run on both projects.
 */

/**
 * Scoped to the PROJECT for the same reason as CoffeeOS#73's components spec:
 * desktop and mobile run against ONE shared database (playwright.config.ts
 * says so explicitly), so an unscoped probe quantity would let mobile's
 * leftovers collide with desktop's, or vice versa.
 *
 * The probe can't be a free-text name the way the components spec used one —
 * `createRoastRequest` only ever names a request after a coffee already in
 * inventory (`selectedCoffee.name`), and the demo fixture has exactly two
 * coffees, both of which already have a roast request against them. So the
 * probe is identified by its QUANTITY instead: a value distinct from every
 * seeded quantity (2,000 / 5,000 / 3,200) and from the other project's probe.
 */
/**
 * Deliberately NOT a doubling pair. `createRoastRequest` merges, so a desktop
 * probe created twice becomes 2x its quantity — with 4321/8642 the merged
 * desktop row would masquerade as the mobile probe in the shared database.
 */
const PROBE_QTY_G: Record<string, string> = {
  desktop: '4321',
  mobile: '5678',
}
const probeQtyG = (testInfo: { project: { name: string } }) =>
  PROBE_QTY_G[testInfo.project.name] ?? '9999'
/**
 * The rendered form of a quantity, in POUNDS.
 *
 * These CHANGED at Stage B, from grams (`4,321g`) to pounds (`9.5 lb`), and
 * that is the guard working as designed: the assertions were written as literal
 * strings precisely so a unit change would have to be made here, deliberately
 * and in review, rather than absorbed silently by a computed formatter. Storage
 * is still grams; only the display converts. The dialog's quantity FIELD also
 * stays in grams — it is precise data entry, and it is labelled as such.
 */
const G_PER_LB = 453.592
const toDisplayQty = (raw: string) => (Number(raw) / G_PER_LB).toFixed(1)
const probeQtyComma = (testInfo: { project: { name: string } }) => toDisplayQty(probeQtyG(testInfo))

/**
 * The probe targets a coffee with NO roast requests of its own.
 *
 * Two reasons, both learned the hard way:
 *   1. `createRoastRequest` MERGES into an existing pending/in_progress request
 *      for the same coffee rather than inserting. Probing a coffee that already
 *      has an active request silently exercises the merge path and never adds a
 *      row.
 *   2. Cleanup has to be able to say "this row is mine" without ambiguity. When
 *      the probe shared a coffee with a seeded request, cleanup protected the
 *      seeded one by QUANTITY — and that broke twice: once when a merge changed
 *      the probe's quantity, and again when Stage B changed the displayed unit
 *      from grams to pounds so the guard string stopped matching anything.
 *
 * Kenya Nyeri AA has green stock (so it is selectable) and no requests at all,
 * seeded by CoffeeOS#72. So ANY Kenya request is a probe, in either section, and
 * cleanup needs no quantity guard.
 */
const PROBE_COFFEE = 'Kenya Nyeri AA'

/**
 * The page renders every ACTIVE row twice — a `request-row` in the
 * `hidden md:block` desktop table and a `request-card` in the `md:hidden`
 * mobile list — so row queries union both and rely on `:visible` to pick
 * whichever the current viewport actually renders. Completed rows have no
 * such union: only the desktop table's completed variant carries a testid at
 * all (see the mobile-gap note above), so `completedRows` is desktop-shaped
 * on purpose.
 */
/**
 * ONE selector, not a `.or()` union.
 *
 * The union form — `locator(rowSel).or(locator(cardSel))` with `:visible` on each
 * side — silently resolved to ZERO while the row was demonstrably on the page,
 * which turned `expect(...).toHaveCount(0)` into a FALSE PASS: the status-change
 * test reported the row had left the active section while it was still sitting
 * there marked Pending. A check that passes when the thing it describes did not
 * happen is worse than no check. `:is()` keeps it a single locator so `:visible`
 * applies to the resolved set.
 */
const activeRows = (page: Page) =>
  page.locator(
    '[data-testid="requests-active"] :is([data-testid="request-row"],[data-testid="request-card"]):visible'
  )

const completedRows = (page: Page) =>
  page.locator(
    '[data-testid="requests-completed"] :is([data-testid="request-row"],[data-testid="request-card"]):visible'
  )

async function openQueue(page: Page) {
  await page.goto('/roasting?tab=requests')
  await page.waitForLoadState('networkidle')
  await hideOverlays(page)
  await expect(activeRows(page).first()).toBeVisible()
}

/**
 * Every mutation here ends in a hard `window.location.reload()`
 * (roast-requests-client.tsx), not a soft refresh or optimistic local-state
 * update — this page has no client-side request list at all, it is re-read
 * from server props on every load. `waitForURL` resolves immediately for a
 * same-URL reload (the URL never changes, so the "already there" check
 * short-circuits it — confirmed while authoring this spec: it returned before
 * the reload had even started). `page.waitForEvent('load')`, registered
 * before the action that triggers the reload, does not have that problem —
 * it only resolves on the next 'load' event the page actually fires.
 */
async function clickAndAwaitReload(page: Page, locator: ReturnType<Page['locator']>) {
  await Promise.all([page.waitForEvent('load'), locator.click()])
}

/** Radix `SelectTrigger`s, not native `<select>`s — click the trigger, then the option. */
async function pickOption(page: Page, testId: string, optionName: string | RegExp) {
  await page.locator(`[data-testid="${testId}"]`).click()
  await page.getByRole('option', { name: optionName }).click()
}

/**
 * Deletes the probe wherever it currently is — active (via the dropdown) or
 * completed (via the bare delete button) — using a page FORCED to a desktop
 * viewport regardless of which project is calling this. That sidesteps the
 * mobile testid gap entirely for cleanup purposes: a mobile test run can
 * still reliably delete what it created, because cleanup never has to drive
 * the row through a mobile card that has no testid to grab.
 *
 * Registers its own dialog handler — `deleteRoastRequest` and status changes
 * go through a native `confirm()`, and Playwright auto-dismisses unhandled
 * dialogs, which would otherwise make cleanup silently no-op.
 */
/**
 * Removes every probe request, identified by COFFEE rather than by quantity.
 *
 * Quantity is not a safe handle for cleanup. `createRoastRequest` MERGES into an
 * existing pending/in_progress request for the same coffee, so a probe that gets
 * created twice — which is exactly what a serial-mode retry does, since the whole
 * group re-runs — stops being 4,321g and becomes 8,642g. A quantity-scoped
 * cleanup then walks straight past it, the next `create` merges again, and the
 * suite fails on a row that "vanished". Observed precisely that way.
 *
 * Coffee is safe because the fixture's only Ethiopia request is `fulfilled`:
 * any ACTIVE Ethiopia row is therefore a probe by definition. In the completed
 * section the seeded row IS Ethiopia, so that one is protected by quantity.
 */
async function removeProbeIfPresent(browser: Browser) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
  page.on('dialog', (dialog) => dialog.accept())
  await page.goto('/roasting?tab=requests')
  await page.waitForLoadState('networkidle')
  await hideOverlays(page)

  const activeProbe = () =>
    page
      .locator('[data-testid="requests-active"] [data-testid="request-row"]')
      .filter({ has: page.locator(`[data-testid="row-coffee"]:text-is("${PROBE_COFFEE}")`) })

  for (let i = 0; i < 6; i++) {
    if ((await activeProbe().count()) === 0) break
    await activeProbe().first().locator('[data-testid="request-menu"]').click()
    await clickAndAwaitReload(page, page.locator('[data-testid="menu-delete"]'))
  }

  const completedProbe = () =>
    page
      .locator('[data-testid="requests-completed"] [data-testid="request-row"]')
      .filter({ has: page.locator(`[data-testid="row-coffee"]:text-is("${PROBE_COFFEE}")`) })

  for (let i = 0; i < 6; i++) {
    if ((await completedProbe().count()) === 0) break
    await clickAndAwaitReload(page, completedProbe().first().locator('[data-testid="request-delete"]'))
  }

  await page.close()
}

test.describe.configure({ mode: 'serial' })

test.describe('roast requests queue capabilities', () => {
  test.beforeAll(async ({ browser }) => {
    // Defensive for BOTH quantities, not just this project's — an interrupted
    // run of the OTHER project could just as easily have left its probe behind,
    // and a leftover pending Ethiopia request would break the "merge vs.
    // insert" assumption the create test below depends on.
    await removeProbeIfPresent(browser)
  })

  // Unconditional, same reasoning as beforeAll: a mid-run failure must not
  // leave the probe in the shared fixture, where it shifts row counts and
  // section membership for every other spec that touches this page (the DOM
  // parity baseline included).
  test.afterAll(async ({ browser }) => {
    await removeProbeIfPresent(browser)
  })

  // ── 1. observe ─────────────────────────────────────────────────────────
  test('observe: an active request shows its fulfilled/requested progress', async ({ page }) => {
    await openQueue(page)

    // Seeded fixture: Guatemala Huehuetenango is `in_progress`, 2000g of 5000g.
    // Displayed in POUNDS as of Stage B — 4.4 of 11.0 — while storage stays in
    // grams. `ProgressMeter` (desktop) and the mobile card's progress block
    // render the identical string, so one assertion covers both projects.
    const guatemala = activeRows(page).filter({ hasText: 'Guatemala Huehuetenango' })
    await expect(guatemala, 'seeded active request is missing').toHaveCount(1)
    await expect(guatemala).toContainText('4.4 / 11.0 lb')
  })

  // ── 2. create ──────────────────────────────────────────────────────────
  test('create: a new request appears in the active list', async ({ page }, testInfo) => {
    const qty = probeQtyG(testInfo)
    const qtyComma = probeQtyComma(testInfo)

    await openQueue(page)
    const before = await activeRows(page).count()

    await page.locator('[data-testid="new-request"]').click()
    await expect(page.locator('[data-testid="request-dialog"]')).toBeVisible()

    await pickOption(page, 'field-coffee', new RegExp(`^${PROBE_COFFEE}`))
    await page.locator('[data-testid="field-quantity"]').fill(qty)
    await clickAndAwaitReload(page, page.locator('[data-testid="dialog-submit"]'))

    // The effect: one more active row, carrying the coffee and quantity that
    // were entered, freshly at 0 fulfilled (a brand-new request, not a merge
    // into anything already there).
    await expect(activeRows(page), 'active row count did not increase').toHaveCount(before + 1)
    const probeRow = activeRows(page).filter({ hasText: qtyComma })
    await expect(probeRow).toHaveCount(1)
    await expect(probeRow).toContainText(PROBE_COFFEE)
    await expect(probeRow).toContainText(`0.0 / ${qtyComma} lb`)

    // Survives a reload — this page has no client-side request list at all
    // (unlike /components' `handleSubmit`, which appends to local state on
    // success and would satisfy the assertions above even if the server call
    // were removed entirely). Reading it back after a fresh navigation is
    // what proves the insert reached the database, not just the DOM already
    // on screen from the reload the mutation itself triggered.
    await page.reload()
    await page.waitForLoadState('networkidle')
    await expect(activeRows(page).filter({ hasText: qtyComma })).toHaveCount(1)
  })

  // ── 3. edit ────────────────────────────────────────────────────────────
  test('edit: changing priority updates the row', async ({ page }, testInfo) => {
    const qtyComma = probeQtyComma(testInfo)

    await openQueue(page)
    const probeRow = activeRows(page).filter({ hasText: qtyComma })
    await expect(probeRow).toHaveCount(1)
    // Created with the default priority — confirms the starting point this
    // test is actually changing, not asserting a value already in place.
    await expect(probeRow).toContainText('Normal')

    await probeRow.locator('[data-testid="request-menu"]').click()
    await page.locator('[data-testid="menu-edit"]').click()
    await expect(page.locator('[data-testid="request-dialog"]')).toBeVisible()

    // Pre-filled from the row being edited — if this is empty the dialog is
    // not reading the request, and saving would silently blank the quantity.
    // The FIELD is still grams — only displays convert to pounds. Asserting the
    // raw gram value here is what proves the dialog round-trips storage units.
    await expect(page.locator('[data-testid="field-quantity"]')).toHaveValue(probeQtyG(testInfo))

    await pickOption(page, 'field-priority', 'Urgent')
    await clickAndAwaitReload(page, page.locator('[data-testid="dialog-submit"]'))

    const updatedRow = activeRows(page).filter({ hasText: qtyComma })
    await expect(updatedRow).toHaveCount(1)
    await expect(updatedRow).toContainText('Urgent')
    await expect(updatedRow).not.toContainText('Normal')

    // Survives a reload, for the same reason as create: nothing here is
    // optimistic local state.
    await page.reload()
    await page.waitForLoadState('networkidle')
    await expect(activeRows(page).filter({ hasText: qtyComma })).toContainText('Urgent')
  })

  // ── 4. status change ──────────────────────────────────────────────────
  test('status change: Mark Fulfilled moves the row out of the active section', async ({
    page,
  }, testInfo) => {
    const qtyComma = probeQtyComma(testInfo)

    await openQueue(page)
    const probeRow = activeRows(page).filter({ hasText: qtyComma })
    await expect(probeRow).toHaveCount(1)

    await probeRow.locator('[data-testid="request-menu"]').click()
    await clickAndAwaitReload(page, page.locator('[data-testid="menu-fulfill"]'))

    // Gone from active, present in completed — the actual claim of this
    // capability, not just "a status label changed somewhere".
    await expect(activeRows(page).filter({ hasText: qtyComma }), 'row still in active section').toHaveCount(0)
    const completedRow = completedRows(page).filter({ hasText: qtyComma })
    await expect(completedRow).toHaveCount(1)
    await expect(completedRow).toContainText('Fulfilled')

    await page.reload()
    await page.waitForLoadState('networkidle')
    await expect(activeRows(page).filter({ hasText: qtyComma })).toHaveCount(0)
    await expect(completedRows(page).filter({ hasText: qtyComma })).toHaveCount(1)
  })

  // ── 5. delete ──────────────────────────────────────────────────────────
  test('delete: removes the row', async ({ page }, testInfo) => {
    const qtyComma = probeQtyComma(testInfo)

    await openQueue(page)
    const before = await completedRows(page).count()
    const probeRow = completedRows(page).filter({ hasText: qtyComma })
    await expect(probeRow).toHaveCount(1)

    // `deleteRoastRequest` runs behind a native `confirm()`. With no handler,
    // Playwright auto-dismisses it, `handleDelete`'s `if (!confirm(...)) return`
    // fires, and the row is untouched — which a naive "is the row gone" check
    // could still pass if it happened to run before this navigated at all.
    // Registering the handler and asserting it actually fired is what makes
    // this a test of the delete path, not of dismiss-then-do-nothing.
    let dialogFired = false
    page.once('dialog', async (dialog) => {
      dialogFired = true
      await dialog.accept()
    })
    await clickAndAwaitReload(page, probeRow.locator('[data-testid="request-delete"]'))
    expect(dialogFired, 'confirm() dialog never fired').toBe(true)

    await expect(completedRows(page).filter({ hasText: qtyComma }), 'row still present after delete').toHaveCount(0)
    await expect(completedRows(page)).toHaveCount(before - 1)

    // Survives a reload: gone from the database, not just from a page that
    // happens to already be mid-reload from the delete action itself.
    await page.reload()
    await page.waitForLoadState('networkidle')
    await expect(completedRows(page).filter({ hasText: qtyComma })).toHaveCount(0)
  })
})

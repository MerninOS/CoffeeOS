import { test, expect, type Page, type Browser } from '@playwright/test'

/**
 * The four behavioural capabilities of the roasting sessions tab
 * (`/roasting?tab=sessions`), asserted by their EFFECT ON THE RENDERED LIST
 * rather than by the presence of a control.
 *
 * These exist to survive the upcoming restyle onto instrument (CoffeeOS#71):
 * every class string will be replaced, and (per the requests/components
 * precedent) the duplicate mobile rendering may be deleted. A test that
 * asserts "the button is there" would pass through a rewrite that quietly
 * stopped mutating data. A test that asserts "the row for the probe vendor now
 * shows 0 batches and $0.00" cannot.
 *
 * Written NOW, against the pre-restyle markup, green on this commit's parent.
 * Selected by `data-testid` wherever the contract actually reaches the DOM —
 * see the testid-contract gap note below for the cases where it does not.
 */

/**
 * ── The testid-contract gap on `Btn` and `MerninInput` ─────────────────────
 *
 * The stated contract includes `new-session`, `dialog-submit`, `field-date`,
 * `field-vendor`, and `field-rate`. Read against the actual markup in
 * sessions-client.tsx, none of them reach the DOM:
 *
 *   - `Btn` (the component behind the "New Session" and "Create Session"
 *     buttons) destructures a fixed prop list — variant, children, onClick,
 *     disabled, className, asChild, href — with no `data-testid` in its type
 *     and no prop spread onto the rendered `<button>`/`<Link>`. Passing
 *     `data-testid="new-session"` to `<Btn>` is accepted by the type checker
 *     (JSX spread of an unknown extra prop) but silently dropped at render.
 *   - `MerninInput` (behind the date, vendor, and rate fields) has the same
 *     shape: a fixed prop list, no forwarding. `data-testid="field-date"` on
 *     `<MerninInput>` never becomes an attribute on the underlying `<input>`.
 *
 * Confirmed empirically against the running dev server before writing this
 * spec: `document.querySelector('[data-testid="new-session"]')` returns null
 * on the live page, while the button is plainly on screen. Same for the three
 * field testids and `dialog-submit`. (`session-dialog`, `delete-dialog`,
 * `delete-confirm`, `session-menu`, `menu-open`, and `menu-delete` all DO
 * reach the DOM — those sit on raw elements or Radix primitives with `asChild`,
 * not on `Btn`/`MerninInput`.)
 *
 * This is a real gap in the testid contract, not a choice made here, and it is
 * called out per-locator below rather than silently worked around with
 * classes or copy. The fallbacks used instead are the next-most-stable thing
 * actually in the markup:
 *   - "New Session" / "Create Session": accessible role+name (the button text
 *     is product copy the restyle is expected to keep recognizable, unlike
 *     class names).
 *   - the date/vendor/rate fields: their native `id` attributes
 *     (`sessionDate`, `vendorName`, `ratePerHour`), which `MerninInput` DOES
 *     forward to the `<input>` even though it drops `data-testid`.
 */

/**
 * Scoped to the PROJECT for the same reason as the requests/components specs:
 * desktop and mobile run against ONE shared database (playwright.config.ts
 * says so explicitly), so an unscoped probe vendor would let one project's
 * cleanup delete the other's row.
 *
 * Unlike roast requests, `createSession` never merges — it always inserts —
 * so there is no doubling-pair hazard here. The vendor name alone is enough
 * to make a probe row unambiguous and cleanup unambiguous.
 */
const PROBE_VENDOR: Record<string, string> = {
  desktop: 'ZZZ Probe Roastery Desktop',
  mobile: 'ZZZ Probe Roastery Mobile',
}
const probeVendor = (testInfo: { project: { name: string } }) =>
  PROBE_VENDOR[testInfo.project.name] ?? 'ZZZ Probe Roastery Other'

/**
 * Two overlays that sit over the bottom of the list and intercept clicks at
 * narrow widths — same two the requests/components specs hide, for the same
 * reason: dismissing them persists to localStorage and would change what the
 * visual baseline suite captures, so they are hidden with CSS instead.
 */
async function hideOverlays(page: Page) {
  await page.addStyleTag({
    content: [
      '[class*="fixed"][class*="bottom-4"][class*="right-4"]{display:none !important}',
      'nextjs-portal{display:none !important}',
    ].join(''),
  })
}

/**
 * `session-row` is the desktop table row and `session-card` the `md:hidden`
 * mobile card. Both are in the DOM at once, so the query unions both and
 * relies on `:visible` to pick whichever the current viewport actually
 * renders — the SAME single-`:is()`-selector shape as the requests spec, not
 * a `.or()` union. The union form silently resolves to zero while the row is
 * demonstrably on the page (confirmed the hard way on the requests spec), which
 * turns `toHaveCount(0)` into a false pass.
 */
/**
 * `.filter({ visible: true })`, NOT `:visible` inside the selector.
 *
 * The selector form — `:is([data-testid="session-row"],[data-testid="session-card"]):visible`
 * — counts correctly but chaining `.filter({ hasText })` onto it silently
 * resolves to ZERO. Observed: `count()` returned 2, both elements' innerText
 * contained the vendor being filtered for, and the filtered locator still
 * matched nothing. Which read as "the row I just created has vanished" rather
 * than "the locator is wrong".
 */
const sessionRows = (page: Page) =>
  page
    .locator('[data-testid="session-row"], [data-testid="session-card"]')
    .filter({ visible: true })

async function openSessions(page: Page) {
  await page.goto('/roasting?tab=sessions')
  await page.waitForLoadState('networkidle')
  await hideOverlays(page)
  await expect(sessionRows(page).first()).toBeVisible()
}

/**
 * ── A second, more severe instance of the testid-contract gap ──────────────
 *
 * The desktop `session-row` carries `row-batches`/`row-green`/`row-roasted`/
 * `row-loss`/`row-cost` on each value. The `md:hidden` mobile `session-card`
 * carries NONE of them — its batch-count badge and its Roasted/Loss/Cost
 * stat block are plain `<span>`s with no `data-testid` at all. Confirmed
 * empirically the same way as the Btn/MerninInput gap above.
 *
 * Worse than a missing testid: the mobile card does not render total GREEN
 * weight anywhere. Desktop shows a "Green (g)" column; the mobile stat grid
 * is only Roasted / Loss / Cost. There is no markup, testid or otherwise, for
 * green weight to assert against on a narrow viewport — this is a product
 * gap, not a locator gap, and no selector fixes it.
 *
 * So: batches/roasted/loss/cost are asserted on BOTH projects, using the
 * testid on desktop and the card's own text content on mobile (the next-most-
 * stable thing actually rendered there). Green is asserted on desktop ONLY,
 * called out explicitly per the instruction to scope rather than silently
 * drop a capability that cannot be driven on one viewport.
 */
async function expectRowStats(
  row: ReturnType<typeof sessionRows>,
  projectName: string,
  expected: {
    batches: string
    green?: string
    roasted: string
    loss?: string
    cost: string
    /** The arithmetic rendered beneath the cost, e.g. "1.3 h × $85.00". */
    basis?: string
  }
) {
  if (projectName === 'mobile') {
    const batchWord = expected.batches === '1' ? 'batch' : 'batches'
    await expect(row).toContainText(`${expected.batches} ${batchWord}`)
    await expect(row).toContainText(`${expected.roasted} lb`)
    if (expected.loss) await expect(row).toContainText(expected.loss)
    await expect(row).toContainText(expected.cost)
    if (expected.basis) await expect(row).toContainText(expected.basis)
    return
  }
  await expect(row.locator('[data-testid="row-batches"]')).toHaveText(expected.batches)
  if (expected.green !== undefined) {
    await expect(row.locator('[data-testid="row-green"]')).toHaveText(expected.green)
  }
  await expect(row.locator('[data-testid="row-roasted"]')).toHaveText(expected.roasted)
  if (expected.loss) await expect(row.locator('[data-testid="row-loss"]')).toContainText(expected.loss)
  await expect(row.locator('[data-testid="row-cost"]')).toContainText(expected.cost)
  /**
   * The basis lives in the same cell as the figure, on purpose — they are
   * computed together in session-cost.ts so they cannot describe different
   * arithmetic. Asserting it here is what stops the explanation silently
   * disappearing while the number stays.
   */
  if (expected.basis) {
    await expect(row.locator('[data-testid="row-cost"]')).toContainText(expected.basis)
  }
}

/**
 * Deletes the probe vendor's row wherever it currently sits, using a page
 * FORCED to a desktop viewport regardless of which project is calling this —
 * same reasoning as the requests spec's cleanup: it sidesteps any mobile
 * markup differences for the purpose of cleanup, so a mobile test run can
 * still reliably remove what it created.
 *
 * Delete here goes through a Radix AlertDialog (`delete-dialog` /
 * `delete-confirm`), NOT a native `confirm()` — unlike the requests tab, so
 * this registers no `page.on('dialog')` handler; there is nothing to
 * auto-dismiss and no `if (!confirm(...))` bail path to worry about.
 *
 * `deleteSession` only revalidates the path server-side (`revalidatePath`,
 * not `router.refresh()`); the client removes the row from its own local
 * state. So there is no reload/navigation to await here — the DOM update from
 * `setSessions(...)` is synchronous with the click, and a `reload()` after is
 * what proves the deletion reached the database rather than just the local
 * array.
 */
async function removeProbeIfPresent(browser: Browser) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
  await page.goto('/roasting?tab=sessions')
  await page.waitForLoadState('networkidle')
  await hideOverlays(page)

  const probeRow = () =>
    page
      .locator('[data-testid="session-row"]')
      .filter({ has: page.locator('[data-testid="row-vendor"]', { hasText: /^ZZZ Probe Roastery/ }) })

  for (let i = 0; i < 6; i++) {
    const count = await probeRow().count()
    if (count === 0) break
    await probeRow().first().locator('[data-testid="session-menu"]').click()
    await page.locator('[data-testid="menu-delete"]').click()
    await expect(page.locator('[data-testid="delete-dialog"]')).toBeVisible()
    await page.locator('[data-testid="delete-confirm"]').click()
    // No reload/router.refresh() follows the delete client-side, so the next
    // loop iteration's `probeRow().count()` needs the local state update to
    // have actually applied before it re-queries.
    await expect(page.locator('[data-testid="delete-dialog"]')).toBeHidden()
  }

  await page.close()
}

test.describe.configure({ mode: 'serial' })

test.describe('roasting sessions capabilities', () => {
  test.beforeAll(async ({ browser }) => {
    // Defensive for BOTH projects' probe vendors, not just this project's — an
    // interrupted run of the OTHER project could just as easily have left its
    // probe behind, and a leftover row shifts the "how many sessions" count
    // every other test on this page implicitly depends on.
    await removeProbeIfPresent(browser)
  })

  // Unconditional, same reasoning as beforeAll: a mid-run failure must not
  // leave the probe in the shared fixture, where it changes row counts and
  // stat totals for every other spec that touches this page.
  test.afterAll(async ({ browser }) => {
    await removeProbeIfPresent(browser)
  })

  // ── 1. observe ─────────────────────────────────────────────────────────
  test('observe: the seeded session shows batches, green, roasted, loss, and cost', async ({
    page,
  }, testInfo) => {
    await openSessions(page)

    // Seeded fixture: Loring S15 Falcon, 2 batches, 10600 g green and 8960 g
    // roasted in STORAGE, displayed as 23.4 and 19.8 lb; 15.5% loss; $106.25
    // billed as 1.3 h x $85.00.
    //
    // These moved from grams to pounds at the restyle, and that edit being
    // required HERE is the design working: the values are literal strings
    // rather than computed, so a unit change cannot be absorbed silently. The
    // requests tab's quantity column went through exactly the same step.
    //
    // Green weight is desktop-only — see expectRowStats' doc comment: the
    // mobile card does not render total green weight at all.
    const seeded = sessionRows(page).filter({ hasText: 'Loring S15 Falcon' })
    await expect(seeded, 'seeded session row is missing').toHaveCount(1)
    await expectRowStats(seeded, testInfo.project.name, {
      batches: '2',
      green: '23.4',
      roasted: '19.8',
      loss: '15.5%',
      cost: '$106.25',
      basis: '1.3 h × $85.00',
    })
  })

  // ── 2. create ──────────────────────────────────────────────────────────
  test('create: a new session appears in the list', async ({ page }, testInfo) => {
    const vendor = probeVendor(testInfo)

    await openSessions(page)
    const before = await sessionRows(page).count()

    // "New Session" has no working data-testid (see the gap note above) —
    // driven by accessible role+name instead.
    // Testid, not the label. Copy is exactly what a restyle is allowed to
    // change, and this spec has to survive one — the contract is the testid.
    await page.locator('[data-testid="new-session"]').click()
    await expect(page.locator('[data-testid="session-dialog"]')).toBeVisible()

    // The date field is left at its default (today) — createSession only
    // requires A session date, not a particular one, and the default is
    // exactly what a real user submits without touching the date picker.
    // Located by native id (`sessionDate`), which MerninInput DOES forward
    // even though it drops data-testid.
    await page.locator('#vendorName').fill(vendor)
    // Cost mode defaults to Toll Roasting, which is the branch requiring
    // rate-per-hour — filled here so the dialog's own validation doesn't
    // block the submit with an alert().
    await page.locator('#ratePerHour').fill('50')

    // handleCreate ends in `router.push` to the new session's detail page,
    // NOT a reload and not a same-page state update — this is a real
    // client-side navigation, so the effect to wait for is the URL changing
    // to the new session's detail route, not a 'load' event.
    await page.locator('[data-testid="dialog-submit"]').click()
    await page.waitForURL(/\/roasting\/sessions\/[0-9a-f-]+$/)

    // The effect: navigating back to the list (a fresh server request, since
    // this page has no client list carried across a navigation) shows one
    // more row, carrying the vendor just entered, freshly at 0 batches/green/
    // roasted. Reading it back after a fresh navigation is what proves the
    // insert reached the database, not just the local state the reducer set
    // optimistically before the push.
    await openSessions(page)
    await expect(sessionRows(page), 'session row count did not increase').toHaveCount(before + 1)
    const probeRow = sessionRows(page).filter({ hasText: vendor })
    await expect(probeRow).toHaveCount(1)
    // Green is desktop-only in this assertion too, same gap as observe:
    // the mobile card never renders total green weight, brand-new session
    // or not.
    await expectRowStats(probeRow, testInfo.project.name, {
      batches: '0',
      // Pounds, to one decimal — a brand-new session has no batches, so this is
      // "0.0 lb" and not "0". Missed when the surface moved off grams: the
      // seeded row's values were updated and this one was not.
      green: '0.0',
      roasted: '0.0',
      cost: '$0.00',
    })
  })

  // ── 3. delete ──────────────────────────────────────────────────────────
  test('delete: removes the session from the list', async ({ page }, testInfo) => {
    const vendor = probeVendor(testInfo)

    await openSessions(page)
    const before = await sessionRows(page).count()
    const probeRow = sessionRows(page).filter({ hasText: vendor })
    await expect(probeRow).toHaveCount(1)

    /**
     * The two viewports reach delete differently, and this is a DRIVER
     * difference — what the test asserts below is identical either way.
     *
     * Desktop puts delete behind the row's dropdown. The mobile card has no
     * dropdown at all: it renders a direct trash IconButton beside "View
     * Session". Driving the desktop path on mobile times out on a menu that
     * does not exist, which reads as "the row vanished".
     */
    if (testInfo.project.name === 'mobile') {
      await probeRow.locator('[data-testid="session-delete"]').click()
    } else {
      await probeRow.locator('[data-testid="session-menu"]').click()
      await page.locator('[data-testid="menu-delete"]').click()
    }

    // A Radix AlertDialog, not a native confirm() — unlike the requests tab's
    // delete. Asserting it opened (rather than assuming) is what proves this
    // exercises the confirm step at all, not a stray click that happened to
    // remove nothing.
    await expect(page.locator('[data-testid="delete-dialog"]')).toBeVisible()
    await page.locator('[data-testid="delete-confirm"]').click()

    // handleDelete only updates local React state (`setSessions(...filter)`)
    // — no reload, no router.refresh(). So the immediate effect to assert is
    // the row leaving the CURRENT page's DOM, synchronously with the confirm
    // click, not after any navigation event.
    await expect(sessionRows(page).filter({ hasText: vendor }), 'row still present after delete').toHaveCount(0)
    await expect(sessionRows(page)).toHaveCount(before - 1)

    // Survives a reload: `deleteSession` calls `revalidatePath`, so a fresh
    // request re-reads the server and must NOT show the row again — proving
    // the delete reached the database, not just the client array.
    await page.reload()
    await page.waitForLoadState('networkidle')
    await expect(sessionRows(page).filter({ hasText: vendor })).toHaveCount(0)
  })

  // ── 4. navigate ────────────────────────────────────────────────────────
  test('navigate: opening a row goes to its detail page', async ({ page }) => {
    await openSessions(page)

    const seeded = sessionRows(page).filter({ hasText: 'Loring S15 Falcon' })
    await expect(seeded).toHaveCount(1)

    // Another instance of the testid-contract gap: `row-date` only exists on
    // the DESKTOP table row (sessions-client.tsx puts it on that `<Link>`
    // alone). The mobile `md:hidden` card's date `<Link>` — and its "View
    // Session" `Btn` link right below it — carry no testid at all, the same
    // gap category as `new-session`/`dialog-submit` above, just on a
    // different element. Confirmed empirically: `[data-testid="row-date"]`
    // resolves to nothing under the mobile card.
    //
    // The next-most-stable handle actually in the markup is the `href` every
    // one of these links shares — `/roasting/sessions/${id}` — which is true
    // of the desktop row's date link, the mobile card's date link, AND its
    // "View Session" button alike. `.first()` picks whichever appears first
    // in DOM order for the `seeded` row/card that `hasText` already scoped to
    // the one session that matters, so this one selector drives both
    // projects without branching on viewport.
    await seeded.locator('a[href^="/roasting/sessions/"]').first().click()
    await expect(page).toHaveURL(/\/roasting\/sessions\/[0-9a-f-]+$/)
  })
})

# Order Packing block — manual QA checklist & deploy runbook

Feature: a Shopify admin block on the order details page
(`admin.order-details.block.render`) that lets an operator record what
materials packed an order, quick-create a missing material, record what they
paid for shipping, and see the order's COGS/margin — without opening the
CoffeeOS dashboard.

This document is the only verification these four routes have. There are no
automated tests for `app/api/shopify/block/{packing-state,packing,component,shipping-cost}/route.ts`
(deliberately — they are thin orchestration over unit-tested modules:
`lib/shopify-block/session.ts`, `lib/shopify-block/auth.ts`,
`lib/orders/prefill.ts`, `lib/orders/sync.ts`, `lib/orders/cogs.ts`,
`lib/products/costing.ts` all have unit tests under `tests/unit/`; the routes
themselves do not). Run this checklist before every deploy that touches any
file listed above, or `extensions/order-packing/src/BlockExtension.tsx`.

---

## Before you start

Run these in order — each depends on the one before it.

### 1. Apply migration `scripts/025_shopify_block_support.sql`

This has **not been applied to any database**. The block is unusable without
it: the packing-state routes write `orders.total_shipping` and call the
`replace_order_packing` RPC, and **both fail without this migration.**

- [ ] Apply `scripts/025_shopify_block_support.sql` to the target database.
- [ ] Run the verification block at the bottom of that file (it is a trailing
      comment, not executed by the migration itself — copy/paste it manually):
  - [ ] Confirm the column:
    ```sql
    SELECT column_name, data_type, numeric_precision, numeric_scale
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'total_shipping';
    -- expect one row: total_shipping | numeric | 10 | 2
    ```
  - [ ] Confirm the function:
    ```sql
    SELECT routine_name, routine_type, security_type
    FROM information_schema.routines
    WHERE routine_schema = 'public' AND routine_name = 'replace_order_packing';
    -- expect one row: replace_order_packing | FUNCTION | INVOKER
    ```
  - [ ] Smoke test the empty-array case against a real, disposable order id you
        own (this clears that order's packing list — use a test/staging order):
    ```sql
    SELECT public.replace_order_packing('<REAL_ORDER_ID>'::uuid, '[]'::jsonb);
    -- expect: no error
    SELECT count(*) FROM public.order_components WHERE order_id = '<REAL_ORDER_ID>'::uuid;
    -- expect: 0
    ```

### 2. Apply migration `scripts/026_packing_uniqueness.sql`

Apply this **after** 025, on the same database. It closes a check-then-write
race in the component-create and shipping-cost routes by adding two unique
indexes and replacing their SELECT-then-INSERT/UPDATE with a single atomic
RPC each: `create_component_or_conflict` (component quick-create) and
`upsert_order_shipping_cost` (shipping save). **Both routes now call these
RPCs with no fallback path** — quick-create and shipping-save are unusable
without this migration, exactly as packing-save and sync-on-demand are
unusable without 025. Applying 025 alone is not enough to exercise the whole
feature: `packing-state` (load) and "Save packing" will work, then
quick-create and "Save shipping" will 500, which reads like a partial,
confusing failure if you don't know 026 is a separate, later migration.

- [ ] **Pre-flight — run both of these BEFORE applying.** `CREATE UNIQUE
      INDEX` fails outright if any existing rows would violate it, and unlike
      025 this migration is not simply re-runnable past that failure without
      first resolving the collision:
  - [ ] Components that would collide on `(user_id, lower(name))`:
    ```sql
    SELECT user_id, lower(name) AS name_ci, count(*), array_agg(id) AS ids
    FROM public.components
    GROUP BY user_id, lower(name)
    HAVING count(*) > 1;
    ```
    If this returns rows: for each group, pick the canonical row (usually the
    oldest, or whichever is referenced by `product_components` /
    `order_components`), repoint any references at it, then **delete** the
    duplicate(s).
  - [ ] Orders with more than one "Shipping"-ish custom cost row:
    ```sql
    SELECT order_id, count(*), array_agg(id) AS ids, array_agg(amount) AS amounts
    FROM public.order_custom_costs
    WHERE lower(description) = 'shipping'
    GROUP BY order_id
    HAVING count(*) > 1;
    ```
    If this returns rows, keep the oldest row per `order_id` (the block's own
    tie-break) and delete the rest.
  - [ ] **In both cases, the fix is to merge or delete the duplicate rows —
        never to weaken the index** (e.g. dropping the uniqueness requirement,
        or making it non-unique, to force the migration to apply). Doing that
        silently brings back the exact race this migration exists to close.
- [ ] Apply `scripts/026_packing_uniqueness.sql`.
- [ ] Run its verification block (trailing comment in the file, not executed
      by the migration itself):
  - [ ] Confirm both indexes exist:
    ```sql
    SELECT indexname, indexdef FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname IN ('components_user_id_lower_name_key', 'order_custom_costs_shipping_unique');
    -- expect two rows, the second showing the partial WHERE clause.
    ```
  - [ ] Confirm both functions exist:
    ```sql
    SELECT routine_name, routine_type, security_type
    FROM information_schema.routines
    WHERE routine_schema = 'public'
      AND routine_name IN ('create_component_or_conflict', 'upsert_order_shipping_cost');
    -- expect two rows, both | FUNCTION | INVOKER
    ```
  - [ ] Smoke test the shipping upsert is idempotent, against a real order id
        you own (mutates data):
    ```sql
    SELECT * FROM public.upsert_order_shipping_cost('<REAL_ORDER_ID>'::uuid, 5.00);
    SELECT * FROM public.upsert_order_shipping_cost('<REAL_ORDER_ID>'::uuid, 7.50);
    SELECT count(*), array_agg(amount) FROM public.order_custom_costs
    WHERE order_id = '<REAL_ORDER_ID>'::uuid AND lower(description) = 'shipping';
    -- expect: count = 1, amount = 7.50
    ```

### 3. Confirm env vars

- [ ] `SHOPIFY_CLIENT_ID` and `SHOPIFY_CLIENT_SECRET` are set in the target
      environment. `lib/shopify-block/auth.ts` (`blockContextFromRequest`)
      reads both directly from `process.env` and returns a bare 500
      (`{"error":"Server misconfigured"}`) if either is missing — this is easy
      to mistake for a broken feature rather than a missing env var, so check
      it first if every block request 500s.
  - These are the same client id/secret already used by the OAuth flow
    (`app/api/shopify/callback/route.ts`, `app/api/shopify/auth/route.ts`)
    and by the existing `app/api/shopify/session-token/route.ts` — if Shopify
    OAuth already works in this environment, they're already set.

### 4. Resolve the extension's dependency install gap

`extensions/order-packing/package.json` declares `@shopify/ui-extensions`
and `@shopify/ui-extensions-react` (both pinned `2024.10.2`) plus `react`, but
**`pnpm install` inside `extensions/order-packing/` currently no-ops**: the
repo root's `pnpm-workspace.yaml` has no `packages:` key (it exists only to
set `allowBuilds: { sharp: true }`), so pnpm does not treat this directory as
a workspace member and never installs its dependencies.

Consequence: `BlockExtension.tsx` **has never been type-checked or built**,
and as of this writing it fails to compile with a TypeScript error for the
missing `@shopify/ui-extensions-react/admin` module.

- [ ] Before doing anything else with the extension, get it installed. Two
      options, pick one:
  - **(a) Add it to the workspace.** Add a `packages:` key to
    `pnpm-workspace.yaml` that includes `extensions/*`, then run `pnpm
    install` from the repo root.
  - **(b) Install it standalone.** `cd extensions/order-packing && npm
    install` (or `pnpm install --ignore-workspace`), bypassing the root
    workspace entirely.
- [ ] Confirm `node_modules/@shopify/ui-extensions-react` exists inside (or is
      resolvable from) `extensions/order-packing/` before proceeding.

---

## Expect to fix things on first run

These are known-unverified, not signs the feature is broken. Each one is a
real, named risk taken during the build with no way to verify it locally.
Read this section before you start clicking around, so the first `shopify app
dev` session doesn't get mistaken for a broken feature.

- [ ] **TypeScript error on the admin extension types.** Symptom: `tsc` (or
      `shopify app dev`'s build step) fails on the
      `@shopify/ui-extensions-react/admin` import in `BlockExtension.tsx`.
      Fix: resolved once step 3 above is done and the package actually
      installs; if it still fails, check that the installed version really is
      `2024.10.2` and that its type defs export an `/admin` subpath.
- [ ] **Wrong component/prop names.** `AdminBlock`, `BlockStack`,
      `InlineStack`, `Text`, `Button`, `TextField`, `NumberField`, `Select`,
      `Divider`, `Badge`, `Banner`, `ProgressIndicator`, and props like
      `tone` / `onPress` / `variant` are a best-effort guess at the `2024-10`
      admin UI extensions API, not verified against real type defs. Shopify
      renames these between releases. Symptom: build errors naming one of
      these identifiers, or a component that renders nothing / throws at
      runtime. Fix: check the installed package's `.d.ts` files (or run
      `shopify app dev` against a real dev store) and correct names/props to
      match. Expect to touch this on the very first build.
- [ ] **`sessionToken` shape/name on `useApi(TARGET)`.** The block explicitly
      fetches a fresh session token per request (`sessionToken.get()`, off
      the object `useApi(TARGET)` returns) and attaches it itself as
      `Authorization: Bearer <token>` — see the `AUTH` note at the top of
      `BlockExtension.tsx` and `blockFetch`'s `token` parameter. This is
      Shopify's documented pattern for admin UI extensions (there is no
      ambient App Bridge session for a same-app `fetch` to piggyback on), but
      the exact export name/shape of `sessionToken` on the object
      `useApi(TARGET)` returns has **not** been confirmed against the
      installed `2024.10.2` type defs. Symptom: a build/runtime error
      destructuring `sessionToken` from `useApi(TARGET)`, or every block
      action showing "Something went sideways" / "Missing bearer token" (the
      token fetch silently produced something that isn't a valid token). Fix:
      check the installed package's `.d.ts` files for the real shape and
      correct the `SessionTokenApi` interface/destructure in
      `BlockExtension.tsx` to match.
      (Note: an **earlier** version of this file assumed Shopify would
      auto-attach a token to a plain same-app `fetch` with no manual header
      wiring. That assumption was replaced with the explicit
      `sessionToken.get()` call described above — if you see a stale comment
      inside `blockFetch` still describing the old auto-attach assumption,
      that comment is leftover and does not describe the code beneath it;
      trust the `AUTH` note at the top of the file and the code, not that one
      paragraph.)
- [ ] **`data.selected[0].id` shape.** `App()` in `BlockExtension.tsx` reads
      the order gid as `data.selected?.[0]?.id` off `useApi(TARGET)`. This is
      assumed, not confirmed, for `admin.order-details.block.render` on
      `2024-10`. Symptom: the block permanently shows "No order in context."
      on every real order page. Fix: log `data` from `useApi(TARGET)` on a
      real dev store and correct the accessor.
- [ ] **Migration 025 not applied.** If you skipped "Before you start" step
      1, `packing-state` (initial load) and "Save packing" 500 — the
      `replace_order_packing` RPC and the `orders.total_shipping` column
      don't exist. Symptom: "Could not save the packing list", or a 500 on
      the very first load of the block.
- [ ] **Migration 026 not applied.** If you skipped step 2, quick-create and
      "Save shipping" 500 — `create_component_or_conflict` and
      `upsert_order_shipping_cost` don't exist. Symptom: "Could not create
      component" or "Could not save shipping cost", while packing-state load
      and "Save packing" work fine (025 alone is enough for those two). Do
      **not** attribute a component-create or shipping-save 500 to 025 — as
      of the `7ee8b99` hardening commit, those two routes no longer touch
      `replace_order_packing` at all; they depend entirely on 026.

---

## Auth and tenancy

`lib/shopify-block/session.ts` verifies the Shopify session-token JWT
(HMAC-SHA256 only — never dispatches on the token's own `alg` header),
requires a numeric, non-expired `exp`, checks `aud` against
`SHOPIFY_CLIENT_ID`, and derives the shop **only** from the verified `dest`
claim. `lib/shopify-block/auth.ts` (`resolveBlockContext`) then resolves that
shop to a `shopify_settings` row.

### Positive

- [ ] On a store connected to CoffeeOS (has a `shopify_settings` row with a
      `user_id`), opening any order's admin page loads the block without an
      auth error.

### Negative — store not connected

- [ ] Using a shop with **no** `shopify_settings` row (or one with a null
      `user_id`), the block shows the load-error state: Banner titled
      "Something went sideways" with body **"This store is not connected to a
      CoffeeOS account."** — sourced verbatim from
      `resolveBlockContext`'s 404 branch in `lib/shopify-block/auth.ts`.
- [ ] Confirm via `curl` directly (replace host/order id as needed — no
      Authorization header at all):
  ```bash
  curl -i "https://coffeeos.io/api/shopify/block/packing-state?shopify_order_id=123456"
  ```
  Expect **`401`**, body `{"error":"Missing bearer token"}`.

### Negative — tampered/expired token

- [ ] `curl` with a syntactically-valid-looking but unsigned/garbage bearer
      token:
  ```bash
  curl -i "https://coffeeos.io/api/shopify/block/packing-state?shopify_order_id=123456" \
    -H "Authorization: Bearer not.a.real.token"
  ```
  Expect **`401`**, body `{"error":"Invalid or expired token"}` — the HMAC
  signature check in `verifyShopifySessionToken` fails and returns `null`
  before any DB lookup happens.
- [ ] If you have a real session token to tamper with (e.g. captured from a
      dev-store network request), flip one character in the signature segment
      (the third `.`-separated part) and repeat the same request. Same
      expectation: `401`, `"Invalid or expired token"`.
- [ ] An expired token (real signature, `exp` in the past) — if you can mint
      one, or just wait out a captured token's expiry — also returns `401`,
      `"Invalid or expired token"` (the code does not distinguish "expired"
      from "bad signature" in its response).
- [ ] Multi-tenant boundary sanity check: confirm a shop A's token can never
      surface shop B's order or component data. `resolveBlockContext` derives
      `shop` only from the verified `dest` claim, never from any
      caller-supplied value, so this should hold by construction — but
      exercise it once: open the block on shop A, then hand-craft (or reuse a
      captured) shop-A token against an order id you know belongs to a
      *different* connected shop's Shopify store. Expect the sync-on-demand
      path in `packing-state` to 404 with `"Order not found on Shopify"` (shop
      A's Admin API token cannot see shop B's order — see the comment in
      `app/api/shopify/block/packing-state/route.ts` above the sync-on-demand
      branch), never shop B's actual data.

### Data-integrity 500 (distinguish from 404)

- [ ] Not easily reproducible in a normal store, but know what it looks like:
      if a `store_domain` somehow has more than one `shopify_settings` row,
      `blockContextFromRequest`'s Supabase lookup errors, and
      `resolveBlockContext` returns **`500`**, `{"error":"Settings lookup
      failed"}` — deliberately never the `404` "not connected" shape, so an
      infra/data fault is never mistaken for a routine uninstalled state.

---

## Packing flow

- [ ] **Fresh order, no packing yet.** Open the block on an order that has
      never been packed. If a similar recent order (same set of product ids)
      has packing recorded, the block pre-fills those lines and shows an info
      Banner: "Suggested from a recent similar order" / "These lines are
      pre-filled from a similar recent order and have not been recorded yet.
      Save packing to make them official."
- [ ] **Suggestion persists nothing until Save.** With the suggestion showing,
      close and reopen the order (or refresh) *without* clicking "Save
      packing." Confirm nothing was written — reopening shows the same
      suggestion again (not a saved line), and the dashboard order detail
      page's "Additional Components" panel is still empty for this order.
- [ ] **Save.** Adjust quantities / add or remove a line, click "Save
      packing." Confirm: the request is `POST /api/shopify/block/packing`
      with `{shopifyOrderId, lines: [{componentId, quantity}, ...]}`; on
      success the block re-syncs to the server response (`fromSuggestion`
      clears, `dirty` clears).
- [ ] **Edit round-trip.** Change a quantity on an already-saved line and Save
      again. Confirm the new quantity persists (reload the block).
- [ ] **Remove round-trip.** Remove one line (via the Remove button, or by
      setting quantity to 0 — `updateQuantity` in `BlockExtension.tsx` treats
      `quantity <= 0` as a removal) and Save. Confirm that line is gone on
      reload.
- [ ] **Dashboard parity — lines and quantities.** After any save, open the
      same order in the CoffeeOS dashboard at `/orders/<order-id>` →
      "Additional Components" panel. Confirm it lists the **identical**
      component names and quantities the block just saved (same
      `order_components` rows — `replace_order_packing` is the only writer
      for both surfaces).

---

## Quick-create

`POST /api/shopify/block/component`. **Requires migration 026** — the route
calls the `create_component_or_conflict` RPC (an atomic `INSERT ... ON
CONFLICT DO NOTHING`, backed by the unique index on `(user_id, lower(name))`)
with no fallback; there is no longer a separate SELECT-then-INSERT in the
route itself. The match is an exact, case-insensitive equality
(`lower(name) = lower(p_name)`), not a pattern/`ilike` match.

- [ ] Create a new material with a name that doesn't exist yet. Confirm:
      `inserted: true` comes back from the RPC, it appears in the block's
      "Add material" list immediately, and — per `handleCreateComponent` — is
      added to the *local, unsaved* working lines automatically (creating a
      component does **not** itself save the packing list; a separate "Save
      packing" is still required).
- [ ] **Duplicate name (409).** Create a component whose name matches an
      existing one exactly, and again with different case (e.g. `Small Box`
      vs `small box`). Confirm: `POST /component` returns **`409`**, body
      `{"error":"A component named \"<existing name>\" already exists","existingComponentId":"<id>"}`
      (the RPC returned `inserted: false`, and the route mapped that to this
      shape). In the block, this surfaces as a Banner titled "Couldn't create
      material" with that exact error text as the body, **plus** a new
      recovery action: a "Add existing material to packing list instead"
      button (`useExistingComponent` in `BlockExtension.tsx`).
- [ ] **Duplicate recovery button.** Click "Add existing material to packing
      list instead." Confirm it adds the *existing* component (matched by
      `existingComponentId` from the 409 body) to the local, unsaved working
      lines — not a new component — closes the new-material form, and clears
      the error. Like plain quick-create, this does **not** itself save the
      packing list.
- [ ] Confirm no duplicate row was created in `components` (the existing row's
      id comes back in `existingComponentId`, nothing new is inserted) — this
      now holds even under a genuine race (two near-simultaneous creates for
      the same name), because the uniqueness is enforced by the index inside
      one atomic statement, not by a check the route does beforehand.
- [ ] **Cost upper bound.** Try a `costPerUnit` at or above `1e10`. Confirm
      the route rejects it with **`400`**, `{"error":"Invalid request
      body"}`, before it ever reaches the RPC (`components.cost_per_unit` is
      `DECIMAL(18,8)`; this cap exists so an oversized value can't overflow
      the COGS math to `Infinity`, which `JSON.stringify` would silently turn
      into `null`).

---

## Shipping

`POST /api/shopify/block/shipping-cost`. **Requires migration 026** — the
route calls the `upsert_order_shipping_cost` RPC, a single atomic `INSERT ...
ON CONFLICT (order_id) WHERE lower(description) = 'shipping' DO UPDATE`
statement, backed by the partial unique index
`order_custom_costs_shipping_unique`. There is no separate SELECT-for-
existing-row in the route anymore — Postgres itself resolves "update the
existing row vs. insert a new one" as part of the one statement, closing a
race where two near-simultaneous saves (double-click, two devices, a retried
request) could previously both miss an existing row and both insert.

- [ ] **First save.** Enter an amount under "What you paid for shipping" and
      Save. Confirm a new `order_custom_costs` row appears with description
      exactly `Shipping` and the entered amount.
- [ ] **Re-save with a different amount.** Change the amount and Save again.
      Confirm the **same** row is updated in place (check its `id` before and
      after) — do **not** get a second row.
- [ ] **Exactly one "Shipping" row.** After the two saves above, open the
      order in the dashboard's Custom Costs panel (`/orders/<id>`) and count
      rows whose description matches "shipping" case-insensitively. Expect
      **exactly one**.
- [ ] **Adopts a hand-typed row.** If an operator already added a custom cost
      named "shipping" (any case) via the dashboard's own "Add Cost" dialog
      *before* ever using the block, confirm the block's first shipping save
      updates that existing row rather than creating a second one. This is
      now guaranteed structurally, not by a tie-break: the partial unique
      index means at most one `lower(description) = 'shipping'` row can exist
      per order (026's own pre-flight step requires resolving any pre-
      existing duplicates before the index can even be created), so
      `ON CONFLICT` always has exactly one candidate row to resolve into.
- [ ] **Doesn't false-match a similar description.** Add a custom cost named
      something that merely *contains* "shipping" but isn't an exact
      case-insensitive match — e.g. "Shipping insurance" — via the
      dashboard's Add Cost dialog. Then use the block to save a shipping
      amount. Confirm the block does **not** treat "Shipping insurance" as
      the existing shipping row: it should insert/update a *separate* row
      literally named `Shipping`, leaving "Shipping insurance" untouched.
      (The block's own prefill match, `findShippingCustomCost` in
      `BlockExtension.tsx`, deliberately mirrors the RPC's predicate with an
      exact `lower(description) === "shipping"` comparison, not a substring
      test, specifically to prevent this false-match case — see the comment
      above that function.)
- [ ] **Amount upper bound.** Try an amount at or above `1e8`. Confirm the
      route rejects it with **`400`**, `{"error":"Invalid request body"}`
      (`order_custom_costs.amount` is `DECIMAL(10,2)`; same overflow-to-
      `Infinity` rationale as the component cost bound above).
- [ ] **Customer-paid shipping reference figure.** If the order has
      `orders.total_shipping` populated (written by `upsertShopifyOrder` on
      sync), confirm the block shows "Customer paid $X.XX (revenue, not your
      cost)" beneath the shipping input, and that this text never changes as
      a result of saving your own shipping cost (it's a separate,
      Shopify-sourced field, not derived from what you just saved).

---

## Sync-on-demand

- [ ] Place a **brand-new** order in the connected Shopify test store.
      Immediately open that order's admin page — before running any
      CoffeeOS dashboard sync (do not visit `/orders` or trigger a bulk
      sync first).
- [ ] Confirm the block loads successfully: `GET /packing-state` finds no
      matching `orders` row for this tenant (`getPackingState` returns
      `null`), falls into the sync-on-demand branch in
      `app/api/shopify/block/packing-state/route.ts`, calls
      `fetchShopifyOrderById` against the shop's own Admin API token, upserts
      the order via `upsertShopifyOrder`/`buildLineItemRows`, and re-fetches
      packing state — all in one request. Expect the block to show the
      order's real line items and (if applicable) a prefill suggestion, not
      an error.
- [ ] Confirm the same order now also appears correctly in the dashboard's
      `/orders` list (proving the sync-on-demand upsert is the same code path
      as the dashboard's own sync, not a shadow copy).
- [ ] **Admin token not configured.** If the connected shop's
      `shopify_settings.admin_access_token` is null (OAuth incomplete),
      confirm this same fresh-order case returns **`409`**,
      `{"error":"Shopify admin access is not configured for this store"}`,
      rather than a generic failure.
- [ ] **Order genuinely doesn't exist.** Hand-edit the URL/order id to a
      numeric id that doesn't exist on this shop at all. Expect **`404`**,
      `{"error":"Order not found on Shopify"}`.

---

## COGS parity

`lib/orders/packing-state.ts` computes COGS via `lib/orders/cogs.ts`
(`classifyOrder`, `getOrderCogs`) fed by `lib/products/costing.ts`'s
`buildProductLookup`, which reads **both** product-level (`product_components`)
and variant-level (`product_variant_components`) recipes. This is the exact
same lookup construction as `app/(dashboard)/orders/page.tsx` (the **`/orders`
list page**) — so that page, not the order-detail page, is the correct
apples-to-apples comparison target. See the callout below.

> **Compare against `/orders` (the list/worksheet page), not
> `/orders/<id>` (the detail page).** The order-detail page
> (`app/(dashboard)/orders/[id]/order-detail-client.tsx`) has its own,
> separate `calculateCOGS()` that reads **only** `products.product_components`
> — it never queries `product_variant_components` at all, and its
> `page.tsx` doesn't even select that relation. For a product costed *only*
> at the variant level, the detail page will show a COGS/margin that is
> **lower than** (or zero, relative to) both the block and the `/orders` list
> page — that is a pre-existing gap in the dashboard's own detail page, not a
> regression introduced by this feature. Do not fail this checklist on that
> mismatch; do flag it separately if you want it tracked.

- [ ] **Baseline parity.** Pick any already-costed order. Open it in the
      block and note COGS total + margin. Open `/orders`, find the same order
      row, expand it if needed. Confirm `row-cogs` equals the block's "COGS
      $X.XX" exactly, and `row-margin` (`X.X%`) equals the block's margin
      badge (`X.X% margin`) to one decimal place.
- [ ] **Variant-level recipe case (the real bug this guards against).**
      Find or create a product that has **no** product-level recipe
      (`product_components` empty) but **does** have a variant-level recipe
      on every variant, all agreeing (`product_variant_components` populated
      and equal cost across variants — see `buildProductLookup`'s
      "every variant costed and all agree" rule in
      `lib/products/costing.ts`). Place/find an order containing that
      product. Confirm:
  - [ ] The block shows `costability: "costed"` (no "Margin unavailable"
        text) and a real COGS/margin number — **not** zero, **not**
        "unlinked"/"uncosted".
  - [ ] That number is **identical** to what `/orders` shows for the same
        order (both use `buildProductLookup`, so they must agree).
  - [ ] (Informational only, see callout above) `/orders/<id>` will likely
        show a *different*, lower number for this same order — expected, not
        a defect in this feature.
- [ ] **Null-margin cases and exact badge text.** For each `costability`
      value, confirm the block shows exactly:
  | `costability` | Block behavior |
  | --- | --- |
  | `"costed"`, margin computable (`total_price > 0`) | Badge, tone `success` if margin ≥ 0 else `critical`, text **`"<margin>.<d>% margin"`** (one decimal) |
  | `"costed"`, but `total_price` is `0` (margin stays `null` even though costed — see `packing-state.ts`: `margin` requires `revenue > 0`) | Plain text **`"Margin unavailable."`** |
  | `"unlinked"` | Plain text **`"Margin unavailable — items on this order aren't linked to products yet."`** |
  | `"uncosted"` | Plain text **`"Margin unavailable — the linked products are missing cost data."`** |
  For `"unlinked"`/`"uncosted"` orders, also confirm the row on `/orders`
  shows the matching lowercase badge (`unlinked` or `uncosted`, tone `danger`
  or `warning` respectively — see `OrdersWorksheetTable.tsx`) and that the
  block's COGS total still matches whatever partial figure (if any) `/orders`
  computes for that order — `getOrderCogs` sums line items + components +
  custom costs regardless of classification; only the *margin* is withheld.

---

## Empty-list save

- [ ] On an order with at least one saved packing line, remove **every** line
      (Remove each one, or set each quantity to 0) and click "Save packing."
  - [ ] Confirm the request succeeds (`200`, not an error) — the client sends
        `lines: []`, which `parseBody` in
        `app/api/shopify/block/packing/route.ts` accepts (an empty array
        passes every check trivially, including the duplicate-id check), and
        `replace_order_packing`'s empty-array case deletes existing rows and
        inserts nothing (see migration 025's own inline comment on this
        exact behavior).
  - [ ] Confirm the order's packing list is now genuinely empty — both in the
        block (shows "Nothing packed yet. Add a material below.") and in the
        dashboard's Additional Components panel (shows "No additional
        components added").
  - [ ] Confirm this does **not** re-trigger the prefill suggestion on
        reload — `load()` in `BlockExtension.tsx` only falls back to
        `fetched.suggestion` when `fetched.packing.length === 0`, which is
        true here (an explicitly emptied order looks identical, over the
        wire, to a never-packed one), so **expect the suggestion to
        reappear** if a similar packed order exists. That's the documented
        heuristic behavior, not a bug — but confirm you understand it before
        signing off, since "I cleared it and it came back" reads like a
        defect if you don't know this going in.

---

## Deploy

Ordered — do not reorder these steps.

1. [ ] **Migration 025 first.** Confirm migration 025 is applied to the
   **production** database (not just a dev/staging one) — repeat the
   verification queries from "Before you start" step 1 against production.
2. [ ] **Migration 026 next.** Run 026's pre-flight collision queries against
   **production** (not just dev/staging — production is exactly where
   pre-existing duplicate component names or duplicate "Shipping" custom-cost
   rows are most likely to already exist), resolve any collisions found, then
   apply 026 and repeat its verification queries from "Before you start" step
   2. Do not skip the pre-flight step because dev/staging came back clean —
   production has more data and more history to have accumulated duplicates.
3. [ ] **Env vars.** Confirm `SHOPIFY_CLIENT_ID` / `SHOPIFY_CLIENT_SECRET` are
   set in the production Next.js deployment (Vercel or wherever CoffeeOS
   runs) — these routes 500 immediately without them.
4. [ ] **Deploy the Next.js app** (the four `/api/shopify/block/*` routes)
   through the normal CoffeeOS deploy path. These routes are additive — they
   don't touch any existing route — so this is safe to ship ahead of the
   extension itself; the extension simply won't exist yet to call them.
5. [ ] **Deploy the extension**: `pnpm shopify:deploy` (root `package.json`
   script → `shopify app deploy`). This is the actual release switch — until
   this runs, no merchant sees the block at all, regardless of what's live on
   the API side. Requires Shopify CLI auth in whoever runs this step; that is
   out of scope for this document (see the "Do NOT authenticate to Shopify"
   constraint this checklist was written under — a human runs this step).
6. [ ] **What merchants see.** After deploy, existing installs pick up the
   new admin block automatically on their next order-details page load — no
   merchant-side action, re-install, or scope re-approval needed, since the
   extension adds a UI surface rather than new access scopes (`shopify.app.toml`
   scopes remain `read_orders,read_products`, unchanged by this feature).
7. [ ] **Rollback path.**
   - Extension: `shopify app deploy` a prior version (or an empty/removed
     `[[extensions]]` block) — the previous release stays reachable via the
     Partner Dashboard's extension version history if a fast revert is
     needed.
   - API routes: rolling back the Next.js deploy removes the four routes;
     since they're purely additive, this has no effect on any other part of
     the app. If the extension is still live pointing at a rolled-back API,
     merchants will see the block fail with a generic error (fetches 404 at
     the framework level) — so roll back the **extension** before or
     alongside the API if you must roll back either.
   - Migrations: **not reversible via this checklist.** `total_shipping`,
     `replace_order_packing` (025), the two unique indexes, and
     `create_component_or_conflict` / `upsert_order_shipping_cost` (026) are
     all additive and safe to leave in place even if the feature is rolled
     back — no rollback SQL is provided for either migration. If you need to
     actually drop any of them, treat that as its own reviewed change, not a
     fast-path rollback step. Note that 026's unique indexes have a
     real-world side effect beyond this feature: once applied, they will
     also reject any *other* future write that would create a duplicate
     component name or a second "Shipping" custom cost row on an order —
     that's the point, but it's a behavior change outside this feature's own
     surface, so mention it if anyone else's rollback investigation touches
     `components` or `order_custom_costs`.

---

## Sign-off

| Field | Value |
| --- | --- |
| Run by | |
| Date | |
| Environment tested (store domain / DB) | |
| Migration 025 applied & verified? | ☐ Yes ☐ No |
| Migration 026 applied & verified (pre-flight collision checks run first)? | ☐ Yes ☐ No |
| Extension dependency install resolved (option a/b above)? | ☐ a ☐ b |
| All sections above passed? | ☐ Yes ☐ No — see exceptions |
| Exceptions taken (what, and why it's acceptable to ship anyway) | |
| Deployed to production? | ☐ Yes ☐ No |

import { test, expect } from '@playwright/test'
import { isConnected, isBillingActive, workspaceStatus } from '../../lib/settings/status'

/**
 * The three states /settings can be in, as a PURE function.
 *
 * These live in lib/settings/status.ts rather than in the page so they can be
 * asserted without a browser and without writing three shopify_settings rows for
 * the same account tests/e2e/baselines.spec.ts photographs — the ordering hazard
 * /orders already paid for.
 *
 * tests/unit/settings-tokens.spec.ts then asserts that the page CALLS this
 * module. Both halves are needed: a correct module nothing calls is exactly the
 * split-brain CoffeeOS#100 closed on /orders, where the detail page carried its
 * own costing formula while the shared one was right, and 239 of 319 orders
 * displayed a margin the system had no basis to compute.
 */

const CONNECTED = {
  store_domain: 'demo-coffeeos.myshopify.com',
  shop_name: 'CoffeeOS Demo Roastery',
  connected_via_oauth: true,
  has_admin_credentials: true,
  billing_status: 'ACTIVE',
  billing_plan_name: 'Roastery',
  billing_current_period_end: '2026-08-26',
  billing_test: false,
}

test('a connected store with active billing is live', () => {
  expect(workspaceStatus(CONNECTED).tone).toBe('live')
  expect(workspaceStatus(CONNECTED).label).toBe('Live')
})

test('a connected store without active billing is blocked', () => {
  expect(workspaceStatus({ ...CONNECTED, billing_status: null }).tone).toBe('blocked')
  expect(workspaceStatus({ ...CONNECTED, billing_status: 'PENDING' }).tone).toBe('blocked')
  // The seeded demo workspace, exactly: connected, billing_status null.
  expect(workspaceStatus({ ...CONNECTED, billing_status: null }).label).toBe('Blocked')
})

test('no shopify row at all is not connected', () => {
  expect(workspaceStatus(null).tone).toBe('idle')
  expect(workspaceStatus(null).label).toBe('Not connected')
})

test('OAuth without admin credentials is NOT connected', () => {
  // The edge that matters. A store can complete OAuth and still carry no admin
  // token, in which case every action on the page fails. Narrowing this check to
  // connected_via_oauth alone is the plausible mistake — one field, reads as
  // obviously correct — and it renders "Live" over a workspace that cannot do
  // anything. Same shape as CoffeeOS#100: a narrower check, rendered
  // confidently.
  const half = { ...CONNECTED, has_admin_credentials: false }
  expect(isConnected(half)).toBe(false)
  expect(workspaceStatus(half).tone).toBe('idle')
})

test('billing is active only for the exact ACTIVE status', () => {
  // Preserved verbatim from settings-client.tsx's `=== "ACTIVE"`. Case matters:
  // loosening it here would silently grant access the pre-conversion page denied.
  expect(isBillingActive({ ...CONNECTED, billing_status: 'active' })).toBe(false)
  expect(isBillingActive({ ...CONNECTED, billing_status: '' })).toBe(false)
  expect(isBillingActive(null)).toBe(false)
  expect(isBillingActive(CONNECTED)).toBe(true)
})

test('a connected store is only connected with BOTH fields', () => {
  expect(isConnected({ ...CONNECTED, connected_via_oauth: false })).toBe(false)
  expect(isConnected({ ...CONNECTED, has_admin_credentials: false })).toBe(false)
  expect(isConnected(CONNECTED)).toBe(true)
  expect(isConnected(null)).toBe(false)
})

import { test, expect } from '@playwright/test'
import { createHmac } from 'crypto'
import { resolveBlockContext } from '../../lib/shopify-block/auth'

const SECRET = 'test-secret'
const CLIENT_ID = 'test-client-id'

function signToken(shop: string, secret: string): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const body = Buffer.from(
    JSON.stringify({
      dest: `https://${shop}`,
      aud: CLIENT_ID,
      exp: Math.floor(Date.now() / 1000) + 60,
    })
  ).toString('base64url')
  const sig = createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url')
  return `${header}.${body}.${sig}`
}

function makeToken(shop: string): string {
  return signToken(shop, SECRET)
}

const settings = {
  user_id: 'user-1',
  store_domain: 'my-store.myshopify.com',
  admin_access_token: 'shpat_x',
}

const deps = (found: typeof settings | null) => ({
  secret: SECRET,
  clientId: CLIENT_ID,
  getSettingsByShop: async (shop: string) =>
    shop === 'my-store.myshopify.com' ? found : null,
})

test('resolves a connected shop to its CoffeeOS user', async () => {
  const ctx = await resolveBlockContext(
    `Bearer ${makeToken('my-store.myshopify.com')}`,
    deps(settings)
  )
  expect(ctx).toEqual({
    ok: true,
    userId: 'user-1',
    storeDomain: 'my-store.myshopify.com',
    adminAccessToken: 'shpat_x',
  })
})

test('401s a missing or malformed authorization header', async () => {
  expect(await resolveBlockContext(null, deps(settings))).toMatchObject({ ok: false, status: 401 })
  expect(await resolveBlockContext('Token abc', deps(settings))).toMatchObject({ ok: false, status: 401 })
})

test('401s an invalid token', async () => {
  const ctx = await resolveBlockContext('Bearer not-a-jwt', deps(settings))
  expect(ctx).toMatchObject({ ok: false, status: 401 })
})

test('404s a shop with no CoffeeOS account', async () => {
  const ctx = await resolveBlockContext(
    `Bearer ${makeToken('unknown.myshopify.com')}`,
    deps(settings)
  )
  expect(ctx).toMatchObject({ ok: false, status: 404 })
})

test('rejects a token signed with the wrong secret even when it names a real connected shop', async () => {
  const forgedToken = signToken('my-store.myshopify.com', 'wrong-secret')
  const ctx = await resolveBlockContext(`Bearer ${forgedToken}`, deps(settings))
  expect(ctx).toMatchObject({ ok: false, status: 401 })
})

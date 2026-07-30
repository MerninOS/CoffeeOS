import { test, expect } from '@playwright/test'
import { createHmac } from 'crypto'
import { verifyShopifySessionToken } from '../../lib/shopify-block/session'

const SECRET = 'test-secret'
const CLIENT_ID = 'test-client-id'

function makeToken(
  payload: Record<string, unknown>,
  { secret = SECRET }: { secret?: string } = {}
): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url')
  return `${header}.${body}.${sig}`
}

const validPayload = () => ({
  dest: 'https://my-store.myshopify.com',
  aud: CLIENT_ID,
  exp: Math.floor(Date.now() / 1000) + 60,
})

test('accepts a valid token and returns the shop hostname', () => {
  const result = verifyShopifySessionToken(makeToken(validPayload()), SECRET, CLIENT_ID)
  expect(result).toEqual({ shop: 'my-store.myshopify.com' })
})

test('rejects a token signed with the wrong secret', () => {
  const token = makeToken(validPayload(), { secret: 'attacker' })
  expect(verifyShopifySessionToken(token, SECRET, CLIENT_ID)).toBeNull()
})

test('rejects an expired token', () => {
  const token = makeToken({ ...validPayload(), exp: Math.floor(Date.now() / 1000) - 10 })
  expect(verifyShopifySessionToken(token, SECRET, CLIENT_ID)).toBeNull()
})

test('rejects a token for a different app (aud mismatch)', () => {
  const token = makeToken({ ...validPayload(), aud: 'some-other-app' })
  expect(verifyShopifySessionToken(token, SECRET, CLIENT_ID)).toBeNull()
})

test('accepts aud as an array containing the client id', () => {
  const token = makeToken({ ...validPayload(), aud: [CLIENT_ID] })
  expect(verifyShopifySessionToken(token, SECRET, CLIENT_ID)).toEqual({
    shop: 'my-store.myshopify.com',
  })
})

test('rejects garbage input', () => {
  expect(verifyShopifySessionToken('not-a-jwt', SECRET, CLIENT_ID)).toBeNull()
  expect(verifyShopifySessionToken('', SECRET, CLIENT_ID)).toBeNull()
})

test('rejects a token whose dest is not a valid URL', () => {
  const token = makeToken({ ...validPayload(), dest: '::::' })
  expect(verifyShopifySessionToken(token, SECRET, CLIENT_ID)).toBeNull()
})

test('rejects a token with no exp claim', () => {
  const { exp: _exp, ...noExp } = validPayload()
  expect(verifyShopifySessionToken(makeToken(noExp), SECRET, CLIENT_ID)).toBeNull()
})

test('ignores the alg header and still requires a valid HMAC signature', () => {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')
  const body = Buffer.from(JSON.stringify(validPayload())).toString('base64url')
  expect(verifyShopifySessionToken(`${header}.${body}.`, SECRET, CLIENT_ID)).toBeNull()
})

test('rejects a payload that decodes to a non-object', () => {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const body = Buffer.from(JSON.stringify(null)).toString('base64url')
  const sig = createHmac('sha256', SECRET).update(`${header}.${body}`).digest('base64url')
  expect(verifyShopifySessionToken(`${header}.${body}.${sig}`, SECRET, CLIENT_ID)).toBeNull()
})

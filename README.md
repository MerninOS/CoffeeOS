# CoffeeOS Shopify App

CoffeeOS is now wired to run as an installable Shopify app with OAuth, embedded app entry routing, and uninstall cleanup webhook handling.

## What Was Added

- Shopify app entrypoint: `/app` (for Shopify Admin launches).
- Install/auth bootstrap endpoint: `/api/shopify/install`.
- OAuth flow endpoints:
  - `/api/shopify/auth`
  - `/api/shopify/callback`
- Uninstall webhook endpoint:
  - `/api/shopify/webhooks/app-uninstalled`
- Shopify CLI config files:
  - `shopify.app.toml`
  - `shopify.web.toml`

## Required Environment Variables

Set these in local `.env.local` and in your production host:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (required for uninstall webhook cleanup)
- `SHOPIFY_CLIENT_ID`
- `SHOPIFY_CLIENT_SECRET`
- `SHOPIFY_BILLING_PLAN_NAME` (example: `CoffeeOS Pro`)
- `SHOPIFY_BILLING_AMOUNT` (example: `49`)
- `SHOPIFY_BILLING_CURRENCY` (example: `USD`)
- `SHOPIFY_BILLING_INTERVAL` (`EVERY_30_DAYS` or `ANNUAL`)
- `SHOPIFY_BILLING_TRIAL_DAYS` (optional integer, example: `14`)
- `SHOPIFY_BILLING_TEST` (`true` in dev, `false` in production)

## Shopify Partner Dashboard Setup

In your Shopify Partner Dashboard, for your app:

1. Set **App URL** to:
   - `https://your-app-domain.com/app`
2. Set **Allowed redirection URL(s)** to include:
   - `https://your-app-domain.com/api/shopify/callback`
3. In **Configuration > Admin API integration**, enable scopes:
   - `read_products`
   - `read_orders`
4. In **Webhooks**, add topic:
   - `app/uninstalled`
   - Endpoint: `https://your-app-domain.com/api/shopify/webhooks/app-uninstalled`

If you manage config with Shopify CLI, update placeholders in `shopify.app.toml` and push:

```bash
npm run shopify:config:push
```

## Billing Setup Notes

- Apply DB migration `scripts/018_add_shopify_billing.sql`.
- Ensure Shopify app scopes include:
  - `read_own_subscription`
  - `write_own_subscription`
- After users connect Shopify, the app now creates/checks a Shopify App Subscription and only allows app access when billing status is `ACTIVE`.

## Local Development

```bash
npm install
npm run dev
```

For Shopify CLI tunnel + app lifecycle:

```bash
npm run shopify:dev
```

## Production Notes

- Keep your app domain HTTPS.
- Do not commit real production secrets.
- If your app requests protected customer/order data categories, submit the protected customer data request in Partner Dashboard before distributing publicly.

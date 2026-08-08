-- 028: payment processing fee per order (CoffeeOS#133)
--
-- Both columns nullable: null means "not yet known" — an order synced before
-- this feature, or one not yet paid. Distinct from a true $0 fee (a free
-- order), which stores 0 / 'actual'. Same null-discipline as total_shipping
-- (migration 025). No backfill here: the bulk re-sync is the backfill, via
-- the shared upsert in lib/orders/sync.ts.

-- IF NOT EXISTS and DECIMAL(10,2) both match 025, which this file claims
-- kinship with. These migrations are applied BY HAND through a scratchpad pg
-- client, so a repeated or partial run is a realistic operator move and must
-- be a no-op rather than an error. The fixed scale matters as much: an
-- unbounded `numeric` accepts 1.41157, which every consumer then renders with
-- toFixed(2) — a money column that reconciles against Shopify by a fraction
-- of a cent no UI can show. The 2-decimal discipline belongs in the column,
-- not only in round2() inside TypeScript.
alter table orders
  add column if not exists total_processing_fee decimal(10, 2),
  add column if not exists processing_fee_source text
    check (processing_fee_source in ('actual', 'estimated'));

comment on column orders.total_processing_fee is
  'Payment processing fee for the order, summed across Shopify transaction fees. Null = not yet known (pre-feature or unpaid). See CoffeeOS#133.';
comment on column orders.processing_fee_source is
  'actual = summed from Shopify transactions.fees; estimated = plan-rate formula (see lib/orders/fees.ts). Null iff total_processing_fee is null.';

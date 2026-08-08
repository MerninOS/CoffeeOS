-- 028: payment processing fee per order (CoffeeOS#133)
--
-- Both columns nullable: null means "not yet known" — an order synced before
-- this feature, or one not yet paid. Distinct from a true $0 fee (a free
-- order), which stores 0 / 'actual'. Same null-discipline as total_shipping
-- (migration 025). No backfill here: the bulk re-sync is the backfill, via
-- the shared upsert in lib/orders/sync.ts.

alter table orders
  add column total_processing_fee numeric,
  add column processing_fee_source text
    check (processing_fee_source in ('actual', 'estimated'));

comment on column orders.total_processing_fee is
  'Payment processing fee for the order, summed across Shopify transaction fees. Null = not yet known (pre-feature or unpaid). See CoffeeOS#133.';
comment on column orders.processing_fee_source is
  'actual = summed from Shopify transactions.fees; estimated = plan-rate formula (see lib/orders/fees.ts). Null iff total_processing_fee is null.';

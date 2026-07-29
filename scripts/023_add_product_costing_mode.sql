-- CoffeeOS#69 — make the costing source an explicit, stored choice.
--
-- WHY THIS COLUMN EXISTS
--
-- A product can carry a recipe at product level, at variant level, or both.
-- Today which one gets billed is INFERRED from which rows happen to exist
-- (app/(dashboard)/orders/page.tsx, now lib/products/costing.ts): product level
-- wins wherever it exists. Nothing records the operator's intent, and
-- /products/[id] compounded it by hiding the product-level recipe entirely once
-- a product had variants — so the operator edited one number while the invoice
-- used another.
--
-- WHY IT IS SAFE TO ADD NOW
--
-- The backfill agrees with the current precedence rule in every case, so no
-- product's resolved COGS changes when this runs. That is deliberate and it is
-- what spec Criterion 7 asserts: a column that changes nothing on arrival needs
-- no kill switch, and the follow-up that makes it AUTHORITATIVE over /orders is
-- where a flag will earn its place. Nothing reads this column on /orders today
-- (verified by grep, not by a test — an earlier version of this comment claimed
-- an enforcing test that does not exist; adding one is a follow-up).
--
-- THE RULE, stated once and mirrored as a pure function in
-- lib/products/costing.ts `backfillCostingMode` (unit-tested there):
--
--     variant rows AND no product rows  ->  'variant'
--     everything else                   ->  'product'
--
-- "Everything else" deliberately covers two cases that look like they want
-- something different:
--
--   BOTH bases      -> 'product', because that is what is billed today.
--                      Backfilling 'variant' here would silently re-cost those
--                      products the moment anything trusted the column.
--   NEITHER basis   -> 'product', so a first recipe is written at product
--                      level, which is where a product with no variants wants
--                      it. 91 of 123 products are in this state.
--
-- Measured immediately before applying, across all users:
--   both 2 · none 91 · product 16  -> 'product'  (109)
--   variant 14                     -> 'variant'  (14)

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS costing_mode TEXT NOT NULL DEFAULT 'product';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'products_costing_mode_check'
  ) THEN
    ALTER TABLE products
      ADD CONSTRAINT products_costing_mode_check
      CHECK (costing_mode IN ('product', 'variant'));
  END IF;
END $$;

-- The whole backfill. `DEFAULT 'product'` has already covered every other case.
UPDATE products p
SET costing_mode = 'variant'
WHERE EXISTS (
        SELECT 1
        FROM product_variants v
        JOIN product_variant_components vc ON vc.product_variant_id = v.id
        WHERE v.product_id = p.id)
  AND NOT EXISTS (
        SELECT 1 FROM product_components pc WHERE pc.product_id = p.id);

COMMENT ON COLUMN products.costing_mode IS
  'Which recipe basis is billed: ''product'' or ''variant''. Backfilled by 023 to agree with the precedence rule in lib/products/costing.ts, so adding it changed no resolved COGS. See CoffeeOS#69.';

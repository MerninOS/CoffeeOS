-- scripts/025_shopify_block_support.sql
-- Support for the Shopify admin packing block.

-- 1. Customer-paid shipping, shown in the block as a reference figure next to
--    the merchant's own shipping cost. Written by the shared order upsert.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS total_shipping DECIMAL(10, 2);

-- 2. Atomic replace of an order's packing lines. The block's Save writes the
--    whole list in one statement-level transaction so a dashboard tab open at
--    the same time can never observe (or interleave with) a half-written list.
--    Called via the service-role client only; ownership is checked in the API
--    layer before invoking. Runs as the calling role (no SECURITY DEFINER) —
--    service role bypasses RLS, which is the existing block-route pattern
--    (see lib/supabase/admin.ts createAdminClient; no table here has FORCE
--    ROW LEVEL SECURITY, so the service role's implicit RLS bypass applies).
--
--    p_lines is a JSONB array of {"component_id": uuid, "quantity": number}.
--    An empty array ('[]'::jsonb) is a valid payload — jsonb_array_elements()
--    over an empty array yields zero rows, so the INSERT...SELECT below simply
--    inserts nothing, leaving the order fully unpacked. That's how the block
--    saves "operator removed every line."
--
--    NOT safe against a duplicate component_id within one payload:
--    order_components has UNIQUE(order_id, component_id) (006), so a payload
--    with the same component_id twice violates that constraint and the whole
--    call errors out — nothing commits, including the DELETE, because there's
--    no exception handler here to swallow it. That's intentional: the API
--    layer is specified to de-duplicate lines before calling this function,
--    and failing loudly on a violation is preferable to silently dropping or
--    summing duplicate lines.
--
--    SET search_path is pinned even though every reference is already
--    schema-qualified and this function has no elevated privileges to
--    protect (SECURITY INVOKER) — it costs nothing, keeps behavior
--    independent of the caller's search_path, and avoids the Supabase
--    linter's "function search path mutable" warning.
CREATE OR REPLACE FUNCTION public.replace_order_packing(
  p_order_id UUID,
  p_lines JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  DELETE FROM public.order_components WHERE order_id = p_order_id;

  INSERT INTO public.order_components (order_id, component_id, quantity)
  SELECT
    p_order_id,
    (line->>'component_id')::uuid,
    (line->>'quantity')::numeric
  FROM jsonb_array_elements(p_lines) AS line;
END;
$$;

-- ---------------------------------------------------------------------------
-- VERIFICATION (run manually after applying this migration; not executed by
-- the migration itself)
-- ---------------------------------------------------------------------------
--
-- 1. Confirm the column exists:
--
--   SELECT column_name, data_type, numeric_precision, numeric_scale
--   FROM information_schema.columns
--   WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'total_shipping';
--   -- expect one row: total_shipping | numeric | 10 | 2
--
-- 2. Confirm the function exists:
--
--   SELECT routine_name, routine_type, security_type
--   FROM information_schema.routines
--   WHERE routine_schema = 'public' AND routine_name = 'replace_order_packing';
--   -- expect one row: replace_order_packing | FUNCTION | INVOKER
--
-- 3. Smoke test the empty-array case. Substitute a real order id you own
--    (and are OK temporarily clearing the packing list for) below — this
--    mutates data, so run it against a test/staging order, not production,
--    unless you intend to actually clear that order's packing list:
--
--   -- <REPLACE_WITH_REAL_ORDER_ID> must be an existing public.orders.id
--   SELECT public.replace_order_packing(
--     '<REPLACE_WITH_REAL_ORDER_ID>'::uuid,
--     '[]'::jsonb
--   );
--   -- expect: no error, statement returns successfully.
--
--   SELECT count(*) FROM public.order_components
--   WHERE order_id = '<REPLACE_WITH_REAL_ORDER_ID>'::uuid;
--   -- expect: 0
--
-- 4. Optional: smoke test a real payload (again, substitute real, existing
--    ids for both the order and a component you own):
--
--   SELECT public.replace_order_packing(
--     '<REPLACE_WITH_REAL_ORDER_ID>'::uuid,
--     '[{"component_id": "<REPLACE_WITH_REAL_COMPONENT_ID>", "quantity": 2}]'::jsonb
--   );
--
--   SELECT * FROM public.order_components
--   WHERE order_id = '<REPLACE_WITH_REAL_ORDER_ID>'::uuid;
--   -- expect: one row, quantity = 2
-- ---------------------------------------------------------------------------

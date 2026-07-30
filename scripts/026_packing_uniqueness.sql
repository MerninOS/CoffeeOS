-- scripts/026_packing_uniqueness.sql
-- Closes two check-then-write races in the Shopify admin packing block's
-- mutation routes (app/api/shopify/block/component, .../shipping-cost):
-- a SELECT-for-duplicate followed by a separate INSERT/UPDATE is not atomic,
-- so two near-simultaneous requests (double-click, two devices, a retried
-- request after a slow response) can both pass the SELECT and both write.
--
-- For shipping cost this is the serious case: order_custom_costs has no
-- uniqueness at all, getOrderCogs() sums custom costs additively, and two
-- inserted "Shipping" rows silently inflate COGS and deflate margin — wrong
-- numbers with no error anywhere. For components it's lower stakes (a
-- duplicate library entry, not corrupted COGS) but the same root cause.
--
-- Both are fixed the same way: a real unique index, plus a single atomic
-- SQL statement (INSERT ... ON CONFLICT) that replaces the old
-- check-then-write from the route. See create_component_or_conflict and
-- upsert_order_shipping_cost below.

-- -----------------------------------------------------------------------
-- PRE-FLIGHT — run BOTH of these manually before applying this migration.
-- CREATE UNIQUE INDEX fails outright if any existing rows would violate it,
-- and unlike the rest of this file this migration is NOT re-runnable past
-- that failure without first resolving the collision — do not respond to a
-- failure here by dropping the uniqueness requirement (e.g. a non-unique
-- index) to make the migration apply; that silently brings back the exact
-- bug this migration exists to close.
-- -----------------------------------------------------------------------
--
-- A. Components that would collide on (user_id, lower(name)):
--
--   SELECT user_id, lower(name) AS name_ci, count(*), array_agg(id) AS ids
--   FROM public.components
--   GROUP BY user_id, lower(name)
--   HAVING count(*) > 1;
--
--   If this returns rows: for each group, decide which row is canonical
--   (usually the oldest, or whichever is referenced by product_components /
--   order_components), repoint any references at it, then delete the
--   duplicate(s). Do not rename one to dodge the check — that just leaves a
--   near-duplicate name and defeats the dedup guarantee this migration adds.
--
-- B. Orders with more than one "Shipping"-ish custom cost row (the exact
--    predicate the new partial index below uses):
--
--   SELECT order_id, count(*), array_agg(id) AS ids, array_agg(amount) AS amounts
--   FROM public.order_custom_costs
--   WHERE lower(description) = 'shipping'
--   GROUP BY order_id
--   HAVING count(*) > 1;
--
--   If this returns rows, they are almost certainly the product of the race
--   this migration closes — the amounts are likely identical or near-
--   identical duplicates from the same save. Keep one row per order_id
--   (oldest by created_at is the block's own tie-break for "which row to
--   update," so keep that one) and delete the rest before applying.
-- -----------------------------------------------------------------------

-- 1. At most one component per tenant with a given name, compared
--    case-insensitively — matches the duplicate-name guarantee the block's
--    component-create route promises the operator.
CREATE UNIQUE INDEX IF NOT EXISTS components_user_id_lower_name_key
  ON public.components (user_id, lower(name));

-- 2. At most one "Shipping" custom cost per order. The predicate
--    (lower(description) = 'shipping') is an exact case-insensitive match,
--    not a pattern — it mirrors what the route matches when it looks for the
--    row to update ("Shipping", "shipping", "SHIPPING" all collide; a
--    hand-typed "Shipping label" does not). Partial, not a full unique
--    index, because order_custom_costs allows arbitrary other cost rows
--    (multiple non-shipping lines) per order.
CREATE UNIQUE INDEX IF NOT EXISTS order_custom_costs_shipping_unique
  ON public.order_custom_costs (order_id)
  WHERE lower(description) = 'shipping';

-- 3. Atomic insert-or-detect-duplicate for component quick-create. Replaces
--    a SELECT-then-INSERT in the route with one statement, so two
--    concurrent requests for the same name can no longer both pass a
--    duplicate check and both insert — the second hits the unique index
--    from statement (1) and DO NOTHING no-ops it, then the function reads
--    back whichever row won.
--
--    inserted = true means this call created the row; false means an
--    existing row (this call's own conflict, or another concurrent one)
--    already has that name for this tenant. The route maps false to its
--    409 "already exists" response using the returned id/name, so the
--    client always learns about whichever row is actually live, not
--    necessarily the one it thought it might be creating.
--
--    SECURITY INVOKER (no SECURITY DEFINER) and SET search_path, matching
--    replace_order_packing's rationale in 025: called only via the
--    service-role client (lib/supabase/admin.ts), which already bypasses
--    RLS, so this function needs no elevated privileges of its own.
CREATE OR REPLACE FUNCTION public.create_component_or_conflict(
  p_user_id UUID,
  p_name TEXT,
  p_type TEXT,
  p_unit TEXT,
  p_cost_per_unit NUMERIC
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  type TEXT,
  unit TEXT,
  cost_per_unit NUMERIC,
  inserted BOOLEAN
)
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  INSERT INTO public.components (user_id, name, type, unit, cost_per_unit)
  VALUES (p_user_id, p_name, p_type, p_unit, p_cost_per_unit)
  ON CONFLICT (user_id, lower(name)) DO NOTHING
  RETURNING
    components.id,
    components.name,
    components.type,
    components.unit,
    components.cost_per_unit,
    TRUE;

  -- RETURN QUERY sets FOUND same as any other query: true if it returned at
  -- least one row. DO NOTHING suppresses RETURNING on the conflicting row,
  -- so a conflict means the INSERT above returned zero rows and FOUND is
  -- false here — that's how a race is distinguished from a fresh insert.
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT c.id, c.name, c.type, c.unit, c.cost_per_unit, FALSE
    FROM public.components c
    WHERE c.user_id = p_user_id AND lower(c.name) = lower(p_name)
    LIMIT 1;
  END IF;
END;
$$;

-- 4. Atomic upsert for the order's shipping cost row. Replaces a
--    SELECT-then-INSERT/UPDATE in the route with one statement — the
--    ON CONFLICT target is the partial index from statement (2), so
--    Postgres itself serializes concurrent saves instead of the route
--    racing a SELECT against its own later write. A repeat save always
--    updates the same row rather than accumulating a second "Shipping"
--    line, which is the point: getOrderCogs sums these additively, so two
--    rows silently inflates COGS.
CREATE OR REPLACE FUNCTION public.upsert_order_shipping_cost(
  p_order_id UUID,
  p_amount NUMERIC
)
RETURNS TABLE (
  id UUID,
  description TEXT,
  amount NUMERIC
)
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  INSERT INTO public.order_custom_costs (order_id, description, amount)
  VALUES (p_order_id, 'Shipping', p_amount)
  ON CONFLICT (order_id) WHERE lower(description) = 'shipping'
  DO UPDATE SET amount = EXCLUDED.amount, updated_at = NOW()
  RETURNING
    order_custom_costs.id,
    order_custom_costs.description,
    order_custom_costs.amount;
END;
$$;

-- ---------------------------------------------------------------------------
-- VERIFICATION (run manually after applying this migration; not executed by
-- the migration itself)
-- ---------------------------------------------------------------------------
--
-- 1. Confirm both indexes exist:
--
--   SELECT indexname, indexdef FROM pg_indexes
--   WHERE schemaname = 'public'
--     AND indexname IN ('components_user_id_lower_name_key', 'order_custom_costs_shipping_unique');
--   -- expect two rows, the second showing the partial WHERE clause.
--
-- 2. Confirm both functions exist:
--
--   SELECT routine_name, routine_type, security_type
--   FROM information_schema.routines
--   WHERE routine_schema = 'public'
--     AND routine_name IN ('create_component_or_conflict', 'upsert_order_shipping_cost');
--   -- expect two rows, both | FUNCTION | INVOKER
--
-- 3. Smoke test the component race is closed. Substitute a real user_id you
--    own below — this mutates data:
--
--   SELECT * FROM public.create_component_or_conflict(
--     '<REPLACE_WITH_REAL_USER_ID>'::uuid, 'Test Dedup Component', 'other', 'unit', 1
--   );
--   -- expect: one row, inserted = true
--
--   SELECT * FROM public.create_component_or_conflict(
--     '<REPLACE_WITH_REAL_USER_ID>'::uuid, 'test dedup component', 'other', 'unit', 2
--   );
--   -- expect: one row, inserted = false, returning the FIRST call's id/name
--   -- (the differently-cased name and cost_per_unit are ignored — no second
--   -- row was created).
--
--   -- Clean up:
--   DELETE FROM public.components WHERE user_id = '<REPLACE_WITH_REAL_USER_ID>'::uuid
--     AND lower(name) = 'test dedup component';
--
-- 4. Smoke test the shipping upsert is idempotent. Substitute a real
--    order id you own below — this mutates data:
--
--   SELECT * FROM public.upsert_order_shipping_cost('<REPLACE_WITH_REAL_ORDER_ID>'::uuid, 5.00);
--   SELECT * FROM public.upsert_order_shipping_cost('<REPLACE_WITH_REAL_ORDER_ID>'::uuid, 7.50);
--
--   SELECT count(*), array_agg(amount) FROM public.order_custom_costs
--   WHERE order_id = '<REPLACE_WITH_REAL_ORDER_ID>'::uuid AND lower(description) = 'shipping';
--   -- expect: count = 1, amount = 7.50 (the second call updated the same row)
-- ---------------------------------------------------------------------------

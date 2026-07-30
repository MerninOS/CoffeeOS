-- scripts/027_fix_ambiguous_column_refs.sql
-- Fixes a runtime failure in the two RPCs added by 026
-- (create_component_or_conflict, upsert_order_shipping_cost). Both raise
-- Postgres 42702 ("column reference ... is ambiguous ... could refer to
-- either a PL/pgSQL variable or a table column") the first time they're
-- actually called. 026 has already shipped, so this is a NEW migration
-- rather than an edit to it.
--
-- WHY THE BARE REFERENCES WERE AMBIGUOUS (read this before writing the next
-- RETURNS TABLE plpgsql function in this codebase — it's an easy trap):
--
-- A plpgsql function declared `RETURNS TABLE (col1 type1, col2 type2, ...)`
-- implicitly declares col1, col2, ... as OUT parameters. Those parameter
-- names are in scope as plpgsql variables for the entire function body —
-- including inside embedded SQL commands, where plpgsql scans every bare
-- identifier and asks "could this name be a variable, or a column of a
-- table this SQL command touches?" If both are possible, and the function
-- hasn't said which to prefer, plpgsql's default (`plpgsql.variable_conflict
-- = error`) is to raise exactly the 42702 error above — at EXECUTION time,
-- not at CREATE FUNCTION time, because the embedded SQL isn't planned until
-- the function actually runs. That's why the migration applied cleanly and
-- nothing caught this until the routes were driven against a live server.
--
-- create_component_or_conflict RETURNS TABLE (..., name TEXT, ...) — `name`
-- collides with components.name inside `ON CONFLICT (user_id, lower(name))`.
-- upsert_order_shipping_cost RETURNS TABLE (..., description TEXT, ...) —
-- `description` collides with order_custom_costs.description inside
-- `ON CONFLICT (order_id) WHERE lower(description) = 'shipping'`.
--
-- replace_order_packing (025) never hit this: it RETURNS VOID, so it has no
-- OUT parameters to collide with anything.
--
-- THE FIX: `#variable_conflict use_column` as the first line of each
-- function body. This plpgsql compiler directive tells the substitution
-- pass, for the rest of the function, to resolve a bare name that's
-- ambiguous between an OUT parameter and a table column by preferring the
-- column — for every embedded SQL command in the function, which includes
-- the ON CONFLICT arbiter's WHERE predicate and conflict-target column list
-- just as much as an ordinary SELECT list or WHERE clause. That's the
-- mechanism that matters here: the ON CONFLICT arbiter must see the exact
-- same expression as the partial/expression unique index it's inferring
-- against (lower(description) = 'shipping', or lower(name)) — both defined
-- purely in terms of table columns in 026 — for Postgres to recognize it as
-- a match. Resolving to the OUT-parameter variable instead would silently
-- substitute a parameter value into that expression and break arbiter
-- inference outright (a different, if more obviously wrong, failure), which
-- is corroborating evidence that "prefer the column" is the only reading
-- that can possibly work here, not just the reading we'd prefer.
--
-- Qualifying the identifiers as table.column is NOT an available escape
-- hatch inside an ON CONFLICT inference expression — Postgres requires the
-- arbiter predicate/index expression list to match the index definition
-- syntactically, and the index itself is necessarily just `lower(name)` /
-- `lower(description)`, unqualified. #variable_conflict is the documented
-- tool for exactly this situation (PostgreSQL docs, "PL/pgSQL Variable
-- Substitution").
--
-- CREATE OR REPLACE, not a drop/recreate — same signature (arguments AND
-- RETURNS TABLE column list, in the same order, with the same names), same
-- SECURITY INVOKER, same SET search_path, same conflict targets, same
-- `inserted` boolean semantics, same re-runnable/idempotent style as 025
-- and 026. Column names returned to callers are unchanged, so
-- app/api/shopify/block/component/route.ts and .../shipping-cost/route.ts
-- need no changes.

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
#variable_conflict use_column
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
#variable_conflict use_column
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
-- 1. Confirm both functions still exist with unchanged signatures:
--
--   SELECT routine_name, routine_type, security_type
--   FROM information_schema.routines
--   WHERE routine_schema = 'public'
--     AND routine_name IN ('create_component_or_conflict', 'upsert_order_shipping_cost');
--   -- expect two rows, both | FUNCTION | INVOKER
--
--   SELECT routine_name, ordinal_position, parameter_name, data_type
--   FROM information_schema.parameters
--   WHERE specific_schema = 'public'
--     AND specific_name IN (
--       SELECT specific_name FROM information_schema.routines
--       WHERE routine_schema = 'public'
--         AND routine_name IN ('create_component_or_conflict', 'upsert_order_shipping_cost')
--     )
--   ORDER BY routine_name, ordinal_position;
--   -- expect the OUT columns still named id/name/type/unit/cost_per_unit/inserted
--   -- and id/description/amount, in that order — unchanged from 026.
--
-- 2. Reproduce the exact failure, then confirm it's gone. Substitute a real
--    user_id you own — this mutates data:
--
--   SELECT * FROM public.create_component_or_conflict(
--     '<REPLACE_WITH_REAL_USER_ID>'::uuid, 'Test 027 Fix', 'other', 'unit', 1
--   );
--   -- expect: one row, inserted = true — NOT a 42702 error.
--
--   SELECT * FROM public.create_component_or_conflict(
--     '<REPLACE_WITH_REAL_USER_ID>'::uuid, 'test 027 fix', 'other', 'unit', 2
--   );
--   -- expect: one row, inserted = false, returning the FIRST call's id/name.
--
--   -- Clean up:
--   DELETE FROM public.components WHERE user_id = '<REPLACE_WITH_REAL_USER_ID>'::uuid
--     AND lower(name) = 'test 027 fix';
--
-- 3. Same for shipping cost. Substitute a real order id you own:
--
--   SELECT * FROM public.upsert_order_shipping_cost('<REPLACE_WITH_REAL_ORDER_ID>'::uuid, 5.00);
--   -- expect: one row, description = 'Shipping', amount = 5.00 — NOT a 42702 error.
--
--   SELECT * FROM public.upsert_order_shipping_cost('<REPLACE_WITH_REAL_ORDER_ID>'::uuid, 7.50);
--   SELECT count(*), array_agg(amount) FROM public.order_custom_costs
--   WHERE order_id = '<REPLACE_WITH_REAL_ORDER_ID>'::uuid AND lower(description) = 'shipping';
--   -- expect: count = 1, amount = 7.50 (updated the same row, not a second insert)
-- ---------------------------------------------------------------------------

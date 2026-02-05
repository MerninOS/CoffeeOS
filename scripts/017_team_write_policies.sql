-- Fix RLS write policies for team members (admin + roaster roles).
-- The existing _insert_own, _update_own, _delete_own policies only check auth.uid() = user_id.
-- Team members write data with user_id = owner_id (the team owner's ID),
-- so their auth.uid() doesn't match user_id, causing RLS violations.
-- This migration replaces write policies to also allow writes when 
-- user_id matches the authenticated user's owner_id from their profile.

-- Helper: get_user_owner_id(auth.uid()) already exists from migration 015.
-- It returns the owner_id from profiles for the given user (SECURITY DEFINER, bypasses RLS).

-- ============================================================
-- green_coffee_inventory: Roasters need full CRUD
-- ============================================================
DROP POLICY IF EXISTS "green_coffee_inventory_insert_own" ON public.green_coffee_inventory;
CREATE POLICY "green_coffee_inventory_insert_team" ON public.green_coffee_inventory 
  FOR INSERT WITH CHECK (
    auth.uid() = user_id 
    OR user_id = public.get_user_owner_id(auth.uid())
  );

DROP POLICY IF EXISTS "green_coffee_inventory_update_own" ON public.green_coffee_inventory;
CREATE POLICY "green_coffee_inventory_update_team" ON public.green_coffee_inventory 
  FOR UPDATE USING (
    auth.uid() = user_id 
    OR user_id = public.get_user_owner_id(auth.uid())
  );

DROP POLICY IF EXISTS "green_coffee_inventory_delete_own" ON public.green_coffee_inventory;
CREATE POLICY "green_coffee_inventory_delete_team" ON public.green_coffee_inventory 
  FOR DELETE USING (
    auth.uid() = user_id 
    OR user_id = public.get_user_owner_id(auth.uid())
  );

-- ============================================================
-- coffee_inventory_changes: Roasters need INSERT + SELECT
-- ============================================================
DROP POLICY IF EXISTS "coffee_inventory_changes_select_own" ON public.coffee_inventory_changes;
CREATE POLICY "coffee_inventory_changes_select_team" ON public.coffee_inventory_changes 
  FOR SELECT USING (
    auth.uid() = user_id 
    OR user_id = public.get_user_owner_id(auth.uid())
  );

DROP POLICY IF EXISTS "coffee_inventory_changes_insert_own" ON public.coffee_inventory_changes;
CREATE POLICY "coffee_inventory_changes_insert_team" ON public.coffee_inventory_changes 
  FOR INSERT WITH CHECK (
    auth.uid() = user_id 
    OR user_id = public.get_user_owner_id(auth.uid())
  );

DROP POLICY IF EXISTS "coffee_inventory_changes_delete_own" ON public.coffee_inventory_changes;
CREATE POLICY "coffee_inventory_changes_delete_team" ON public.coffee_inventory_changes 
  FOR DELETE USING (
    auth.uid() = user_id 
    OR user_id = public.get_user_owner_id(auth.uid())
  );

-- ============================================================
-- roasting_sessions: Roasters need full CRUD
-- ============================================================
DROP POLICY IF EXISTS "roasting_sessions_insert_own" ON public.roasting_sessions;
CREATE POLICY "roasting_sessions_insert_team" ON public.roasting_sessions 
  FOR INSERT WITH CHECK (
    auth.uid() = user_id 
    OR user_id = public.get_user_owner_id(auth.uid())
  );

DROP POLICY IF EXISTS "roasting_sessions_update_own" ON public.roasting_sessions;
CREATE POLICY "roasting_sessions_update_team" ON public.roasting_sessions 
  FOR UPDATE USING (
    auth.uid() = user_id 
    OR user_id = public.get_user_owner_id(auth.uid())
  );

DROP POLICY IF EXISTS "roasting_sessions_delete_own" ON public.roasting_sessions;
CREATE POLICY "roasting_sessions_delete_team" ON public.roasting_sessions 
  FOR DELETE USING (
    auth.uid() = user_id 
    OR user_id = public.get_user_owner_id(auth.uid())
  );

-- ============================================================
-- roasting_batches: Roasters need full CRUD
-- ============================================================
DROP POLICY IF EXISTS "roasting_batches_insert_own" ON public.roasting_batches;
CREATE POLICY "roasting_batches_insert_team" ON public.roasting_batches 
  FOR INSERT WITH CHECK (
    auth.uid() = user_id 
    OR user_id = public.get_user_owner_id(auth.uid())
  );

DROP POLICY IF EXISTS "roasting_batches_update_own" ON public.roasting_batches;
CREATE POLICY "roasting_batches_update_team" ON public.roasting_batches 
  FOR UPDATE USING (
    auth.uid() = user_id 
    OR user_id = public.get_user_owner_id(auth.uid())
  );

DROP POLICY IF EXISTS "roasting_batches_delete_own" ON public.roasting_batches;
CREATE POLICY "roasting_batches_delete_team" ON public.roasting_batches 
  FOR DELETE USING (
    auth.uid() = user_id 
    OR user_id = public.get_user_owner_id(auth.uid())
  );

-- ============================================================
-- roast_requests: Roasters need full CRUD
-- ============================================================
DROP POLICY IF EXISTS "roast_requests_insert_own" ON public.roast_requests;
CREATE POLICY "roast_requests_insert_team" ON public.roast_requests 
  FOR INSERT WITH CHECK (
    auth.uid() = user_id 
    OR user_id = public.get_user_owner_id(auth.uid())
  );

DROP POLICY IF EXISTS "roast_requests_update_own" ON public.roast_requests;
CREATE POLICY "roast_requests_update_team" ON public.roast_requests 
  FOR UPDATE USING (
    auth.uid() = user_id 
    OR user_id = public.get_user_owner_id(auth.uid())
  );

DROP POLICY IF EXISTS "roast_requests_delete_own" ON public.roast_requests;
CREATE POLICY "roast_requests_delete_team" ON public.roast_requests 
  FOR DELETE USING (
    auth.uid() = user_id 
    OR user_id = public.get_user_owner_id(auth.uid())
  );

-- ============================================================
-- roast_request_fulfillments: accessed via roast_requests ownership
-- ============================================================
DROP POLICY IF EXISTS "roast_request_fulfillments_select_own" ON public.roast_request_fulfillments;
CREATE POLICY "roast_request_fulfillments_select_team" ON public.roast_request_fulfillments 
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.roast_requests rr 
      WHERE rr.id = roast_request_id 
      AND (rr.user_id = auth.uid() OR rr.user_id = public.get_user_owner_id(auth.uid()))
    )
  );

DROP POLICY IF EXISTS "roast_request_fulfillments_insert_own" ON public.roast_request_fulfillments;
CREATE POLICY "roast_request_fulfillments_insert_team" ON public.roast_request_fulfillments 
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.roast_requests rr 
      WHERE rr.id = roast_request_id 
      AND (rr.user_id = auth.uid() OR rr.user_id = public.get_user_owner_id(auth.uid()))
    )
  );

DROP POLICY IF EXISTS "roast_request_fulfillments_delete_own" ON public.roast_request_fulfillments;
CREATE POLICY "roast_request_fulfillments_delete_team" ON public.roast_request_fulfillments 
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.roast_requests rr 
      WHERE rr.id = roast_request_id 
      AND (rr.user_id = auth.uid() OR rr.user_id = public.get_user_owner_id(auth.uid()))
    )
  );

-- ============================================================
-- components: Roasters may create components from batches
-- ============================================================
DROP POLICY IF EXISTS "components_insert_own" ON public.components;
CREATE POLICY "components_insert_team" ON public.components 
  FOR INSERT WITH CHECK (
    auth.uid() = user_id 
    OR user_id = public.get_user_owner_id(auth.uid())
  );

DROP POLICY IF EXISTS "components_update_own" ON public.components;
CREATE POLICY "components_update_team" ON public.components 
  FOR UPDATE USING (
    auth.uid() = user_id 
    OR user_id = public.get_user_owner_id(auth.uid())
  );

DROP POLICY IF EXISTS "components_delete_own" ON public.components;
CREATE POLICY "components_delete_team" ON public.components 
  FOR DELETE USING (
    auth.uid() = user_id 
    OR user_id = public.get_user_owner_id(auth.uid())
  );

-- ============================================================
-- roasting_settings: Roasters need SELECT + INSERT + UPDATE
-- ============================================================
DROP POLICY IF EXISTS "roasting_settings_select_own" ON public.roasting_settings;
CREATE POLICY "roasting_settings_select_team" ON public.roasting_settings 
  FOR SELECT USING (
    auth.uid() = user_id 
    OR user_id = public.get_user_owner_id(auth.uid())
  );

DROP POLICY IF EXISTS "roasting_settings_insert_own" ON public.roasting_settings;
CREATE POLICY "roasting_settings_insert_team" ON public.roasting_settings 
  FOR INSERT WITH CHECK (
    auth.uid() = user_id 
    OR user_id = public.get_user_owner_id(auth.uid())
  );

DROP POLICY IF EXISTS "roasting_settings_update_own" ON public.roasting_settings;
CREATE POLICY "roasting_settings_update_team" ON public.roasting_settings 
  FOR UPDATE USING (
    auth.uid() = user_id 
    OR user_id = public.get_user_owner_id(auth.uid())
  );

DROP POLICY IF EXISTS "roasting_settings_delete_own" ON public.roasting_settings;
CREATE POLICY "roasting_settings_delete_team" ON public.roasting_settings 
  FOR DELETE USING (
    auth.uid() = user_id 
    OR user_id = public.get_user_owner_id(auth.uid())
  );

-- ============================================================
-- product_components: accessed via product ownership
-- ============================================================
DROP POLICY IF EXISTS "product_components_select" ON public.product_components;
CREATE POLICY "product_components_select_team" ON public.product_components 
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.products p 
      WHERE p.id = product_components.product_id 
      AND (p.user_id = auth.uid() OR p.user_id = public.get_user_owner_id(auth.uid()))
    )
  );

DROP POLICY IF EXISTS "product_components_insert" ON public.product_components;
CREATE POLICY "product_components_insert_team" ON public.product_components 
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.products p 
      WHERE p.id = product_components.product_id 
      AND (p.user_id = auth.uid() OR p.user_id = public.get_user_owner_id(auth.uid()))
    )
  );

DROP POLICY IF EXISTS "product_components_update" ON public.product_components;
CREATE POLICY "product_components_update_team" ON public.product_components 
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.products p 
      WHERE p.id = product_components.product_id 
      AND (p.user_id = auth.uid() OR p.user_id = public.get_user_owner_id(auth.uid()))
    )
  );

DROP POLICY IF EXISTS "product_components_delete" ON public.product_components;
CREATE POLICY "product_components_delete_team" ON public.product_components 
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.products p 
      WHERE p.id = product_components.product_id 
      AND (p.user_id = auth.uid() OR p.user_id = public.get_user_owner_id(auth.uid()))
    )
  );

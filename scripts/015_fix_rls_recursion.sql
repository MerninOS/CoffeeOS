-- Fix infinite recursion in profiles RLS policy.
-- The issue: profiles_select policy queries profiles table to check owner_id,
-- which triggers the same policy check again, causing infinite recursion.
-- Solution: Use a SECURITY DEFINER function that bypasses RLS to look up owner_id.

-- 1. Create a helper function that bypasses RLS to get the owner_id for a user
CREATE OR REPLACE FUNCTION public.get_user_owner_id(user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT owner_id FROM public.profiles WHERE id = user_id;
$$;

-- 2. Fix profiles policies
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT USING (
  auth.uid() = id 
  OR owner_id = auth.uid()
  OR (
    owner_id IS NOT NULL 
    AND owner_id = public.get_user_owner_id(auth.uid())
  )
);

DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE USING (
  auth.uid() = id OR owner_id = auth.uid()
);

-- 3. Fix all data table policies that reference profiles
DROP POLICY IF EXISTS "products_select_team" ON public.products;
CREATE POLICY "products_select_team" ON public.products FOR SELECT USING (
  auth.uid() = user_id 
  OR user_id = public.get_user_owner_id(auth.uid())
);

DROP POLICY IF EXISTS "components_select_team" ON public.components;
CREATE POLICY "components_select_team" ON public.components FOR SELECT USING (
  auth.uid() = user_id 
  OR user_id = public.get_user_owner_id(auth.uid())
);

DROP POLICY IF EXISTS "shopify_settings_select_team" ON public.shopify_settings;
CREATE POLICY "shopify_settings_select_team" ON public.shopify_settings FOR SELECT USING (
  auth.uid() = user_id 
  OR user_id = public.get_user_owner_id(auth.uid())
);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'orders' AND schemaname = 'public') THEN
    DROP POLICY IF EXISTS "orders_select_team" ON public.orders;
    EXECUTE 'CREATE POLICY "orders_select_team" ON public.orders FOR SELECT USING (
      auth.uid() = user_id 
      OR user_id = public.get_user_owner_id(auth.uid())
    )';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'roasting_sessions' AND schemaname = 'public') THEN
    DROP POLICY IF EXISTS "roasting_sessions_select_team" ON public.roasting_sessions;
    EXECUTE 'CREATE POLICY "roasting_sessions_select_team" ON public.roasting_sessions FOR SELECT USING (
      auth.uid() = user_id 
      OR user_id = public.get_user_owner_id(auth.uid())
    )';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'green_coffee_inventory' AND schemaname = 'public') THEN
    DROP POLICY IF EXISTS "green_coffee_inventory_select_own" ON public.green_coffee_inventory;
    DROP POLICY IF EXISTS "coffee_inventory_select_team" ON public.green_coffee_inventory;
    EXECUTE 'CREATE POLICY "green_coffee_inventory_select_team" ON public.green_coffee_inventory FOR SELECT USING (
      auth.uid() = user_id 
      OR user_id = public.get_user_owner_id(auth.uid())
    )';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'roasting_batches' AND schemaname = 'public') THEN
    DROP POLICY IF EXISTS "roasting_batches_select_team" ON public.roasting_batches;
    EXECUTE 'CREATE POLICY "roasting_batches_select_team" ON public.roasting_batches FOR SELECT USING (
      auth.uid() = user_id 
      OR user_id = public.get_user_owner_id(auth.uid())
    )';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'roast_requests' AND schemaname = 'public') THEN
    DROP POLICY IF EXISTS "roast_requests_select_team" ON public.roast_requests;
    EXECUTE 'CREATE POLICY "roast_requests_select_team" ON public.roast_requests FOR SELECT USING (
      auth.uid() = user_id 
      OR user_id = public.get_user_owner_id(auth.uid())
    )';
  END IF;
END $$;

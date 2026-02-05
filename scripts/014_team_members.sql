-- Team Members Migration
-- Adds team member support with admin and roaster roles.
-- Team members are linked to an owner via owner_id in profiles.
-- All data remains scoped to the owner's user_id, 
-- but team members can access it through their owner_id link.

-- 1. Update role constraint to support new roles
ALTER TABLE public.profiles 
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles 
  ADD CONSTRAINT profiles_role_check 
  CHECK (role IN ('owner', 'admin', 'roaster', 'employee'));

-- 2. Add owner_id column to link team members to their owner
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'owner_id'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;

  -- Add first_name and last_name if they don't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'first_name'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN first_name TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'last_name'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN last_name TEXT;
  END IF;

  -- Add invited_by column to track who invited the user
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'invited_by'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 3. Create team_invitations table for pending invitations
CREATE TABLE IF NOT EXISTS public.team_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'roaster')),
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(owner_id, email)
);

ALTER TABLE public.team_invitations ENABLE ROW LEVEL SECURITY;

-- Owner can see their own invitations
DROP POLICY IF EXISTS "team_invitations_select_owner" ON public.team_invitations;
CREATE POLICY "team_invitations_select_owner" ON public.team_invitations 
  FOR SELECT USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "team_invitations_insert_owner" ON public.team_invitations;
CREATE POLICY "team_invitations_insert_owner" ON public.team_invitations 
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "team_invitations_delete_owner" ON public.team_invitations;
CREATE POLICY "team_invitations_delete_owner" ON public.team_invitations 
  FOR DELETE USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "team_invitations_update_owner" ON public.team_invitations;
CREATE POLICY "team_invitations_update_owner" ON public.team_invitations 
  FOR UPDATE USING (auth.uid() = owner_id);

-- 4. Update RLS policies for profiles so owners/admins can see team members
-- Drop existing policies first
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;

-- Users can see their own profile + profiles of team members in their org
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT USING (
  auth.uid() = id 
  OR owner_id = auth.uid()
  OR (owner_id IS NOT NULL AND owner_id = (SELECT p.owner_id FROM public.profiles p WHERE p.id = auth.uid()))
);

-- Users can insert their own profile
CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Users can update their own profile, owners can update team member profiles
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE USING (
  auth.uid() = id OR owner_id = auth.uid()
);

-- 5. Update data table RLS policies so team members can access owner's data
-- Products: team members should read via owner_id
DROP POLICY IF EXISTS "products_select_own" ON public.products;
CREATE POLICY "products_select_team" ON public.products FOR SELECT USING (
  auth.uid() = user_id 
  OR user_id = (SELECT p.owner_id FROM public.profiles p WHERE p.id = auth.uid())
);

-- Components: team members should read via owner_id
DROP POLICY IF EXISTS "components_select_own" ON public.components;
CREATE POLICY "components_select_team" ON public.components FOR SELECT USING (
  auth.uid() = user_id 
  OR user_id = (SELECT p.owner_id FROM public.profiles p WHERE p.id = auth.uid())
);

-- Shopify settings: team members should read via owner_id (for admin role)
DROP POLICY IF EXISTS "shopify_settings_select_own" ON public.shopify_settings;
CREATE POLICY "shopify_settings_select_team" ON public.shopify_settings FOR SELECT USING (
  auth.uid() = user_id 
  OR user_id = (SELECT p.owner_id FROM public.profiles p WHERE p.id = auth.uid())
);

-- Orders: team members can see owner's orders
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'orders' AND schemaname = 'public') THEN
    DROP POLICY IF EXISTS "orders_select_own" ON public.orders;
    EXECUTE 'CREATE POLICY "orders_select_team" ON public.orders FOR SELECT USING (
      auth.uid() = user_id 
      OR user_id = (SELECT p.owner_id FROM public.profiles p WHERE p.id = auth.uid())
    )';
  END IF;
END $$;

-- Roasting sessions: team members can see and manage
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'roasting_sessions' AND schemaname = 'public') THEN
    DROP POLICY IF EXISTS "roasting_sessions_select_own" ON public.roasting_sessions;
    EXECUTE 'CREATE POLICY "roasting_sessions_select_team" ON public.roasting_sessions FOR SELECT USING (
      auth.uid() = user_id 
      OR user_id = (SELECT p.owner_id FROM public.profiles p WHERE p.id = auth.uid())
    )';
  END IF;
END $$;

-- Coffee inventory: team members can see 
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'coffee_inventory' AND schemaname = 'public') THEN
    DROP POLICY IF EXISTS "coffee_inventory_select_own" ON public.coffee_inventory;
    EXECUTE 'CREATE POLICY "coffee_inventory_select_team" ON public.coffee_inventory FOR SELECT USING (
      auth.uid() = user_id 
      OR user_id = (SELECT p.owner_id FROM public.profiles p WHERE p.id = auth.uid())
    )';
  END IF;
END $$;

-- Roasting batches: team members can see and manage
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'roasting_batches' AND schemaname = 'public') THEN
    DROP POLICY IF EXISTS "roasting_batches_select_own" ON public.roasting_batches;
    EXECUTE 'CREATE POLICY "roasting_batches_select_team" ON public.roasting_batches FOR SELECT USING (
      auth.uid() = user_id 
      OR user_id = (SELECT p.owner_id FROM public.profiles p WHERE p.id = auth.uid())
    )';
  END IF;
END $$;

-- Roast requests: team members can see
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'roast_requests' AND schemaname = 'public') THEN
    DROP POLICY IF EXISTS "roast_requests_select_own" ON public.roast_requests;
    EXECUTE 'CREATE POLICY "roast_requests_select_team" ON public.roast_requests FOR SELECT USING (
      auth.uid() = user_id 
      OR user_id = (SELECT p.owner_id FROM public.profiles p WHERE p.id = auth.uid())
    )';
  END IF;
END $$;

-- Index for team member lookups
CREATE INDEX IF NOT EXISTS idx_profiles_owner_id ON public.profiles(owner_id);
CREATE INDEX IF NOT EXISTS idx_team_invitations_email ON public.team_invitations(email);
CREATE INDEX IF NOT EXISTS idx_team_invitations_token ON public.team_invitations(token);

-- 6. Update the handle_new_user trigger to handle first_name and last_name
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, first_name, last_name, role, owner_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NULL),
    COALESCE(NEW.raw_user_meta_data ->> 'first_name', NULL),
    COALESCE(NEW.raw_user_meta_data ->> 'last_name', NULL),
    COALESCE(NEW.raw_user_meta_data ->> 'role', 'employee'),
    CASE 
      WHEN NEW.raw_user_meta_data ->> 'owner_id' IS NOT NULL 
      THEN (NEW.raw_user_meta_data ->> 'owner_id')::UUID
      ELSE NULL
    END
  )
  ON CONFLICT (id) DO UPDATE SET
    first_name = COALESCE(EXCLUDED.first_name, public.profiles.first_name),
    last_name = COALESCE(EXCLUDED.last_name, public.profiles.last_name),
    owner_id = COALESCE(EXCLUDED.owner_id, public.profiles.owner_id);
  RETURN NEW;
END;
$$;

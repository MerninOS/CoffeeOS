-- Shopify OAuth Schema
-- Adds OAuth support for Shopify App Store distribution

-- Create table to store OAuth states for CSRF protection
CREATE TABLE IF NOT EXISTS public.shopify_oauth_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  state TEXT NOT NULL UNIQUE,
  shop TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for looking up states
CREATE INDEX IF NOT EXISTS idx_shopify_oauth_states_state ON public.shopify_oauth_states(state);
CREATE INDEX IF NOT EXISTS idx_shopify_oauth_states_expires ON public.shopify_oauth_states(expires_at);

-- Enable RLS on shopify_oauth_states
ALTER TABLE public.shopify_oauth_states ENABLE ROW LEVEL SECURITY;

-- RLS policy - users can only see their own states
DROP POLICY IF EXISTS "shopify_oauth_states_select_own" ON public.shopify_oauth_states;
CREATE POLICY "shopify_oauth_states_select_own" ON public.shopify_oauth_states 
FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "shopify_oauth_states_insert_own" ON public.shopify_oauth_states;
CREATE POLICY "shopify_oauth_states_insert_own" ON public.shopify_oauth_states 
FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "shopify_oauth_states_delete_own" ON public.shopify_oauth_states;
CREATE POLICY "shopify_oauth_states_delete_own" ON public.shopify_oauth_states 
FOR DELETE USING (auth.uid() = user_id);

-- Add OAuth-related columns to shopify_settings if they don't exist
DO $$ 
BEGIN
  -- Add shop_name column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'shopify_settings' 
    AND column_name = 'shop_name'
  ) THEN
    ALTER TABLE public.shopify_settings ADD COLUMN shop_name TEXT;
  END IF;

  -- Add connected_via_oauth column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'shopify_settings' 
    AND column_name = 'connected_via_oauth'
  ) THEN
    ALTER TABLE public.shopify_settings ADD COLUMN connected_via_oauth BOOLEAN DEFAULT false;
  END IF;

  -- Add oauth_scope column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'shopify_settings' 
    AND column_name = 'oauth_scope'
  ) THEN
    ALTER TABLE public.shopify_settings ADD COLUMN oauth_scope TEXT;
  END IF;

  -- Add oauth_connected_at column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'shopify_settings' 
    AND column_name = 'oauth_connected_at'
  ) THEN
    ALTER TABLE public.shopify_settings ADD COLUMN oauth_connected_at TIMESTAMPTZ;
  END IF;
END $$;

-- Function to clean up expired OAuth states (can be called periodically)
CREATE OR REPLACE FUNCTION public.cleanup_expired_oauth_states()
RETURNS void AS $$
BEGIN
  DELETE FROM public.shopify_oauth_states
  WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.cleanup_expired_oauth_states() TO authenticated;

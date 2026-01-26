-- Roasting Module Database Schema

-- Roasting Settings table (default values for sessions)
CREATE TABLE IF NOT EXISTS public.roasting_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  default_billing_granularity_minutes INTEGER NOT NULL DEFAULT 15,
  default_setup_minutes INTEGER NOT NULL DEFAULT 0,
  default_cleanup_minutes INTEGER NOT NULL DEFAULT 0,
  default_allocation_mode TEXT NOT NULL DEFAULT 'time_weighted' CHECK (default_allocation_mode IN ('time_weighted', 'mass_weighted')),
  default_kwh_rate DECIMAL(10, 4),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Roasting Sessions table
CREATE TABLE IF NOT EXISTS public.roasting_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vendor_name TEXT NOT NULL,
  rate_per_hour DECIMAL(10, 2) NOT NULL,
  setup_minutes INTEGER NOT NULL DEFAULT 0,
  cleanup_minutes INTEGER NOT NULL DEFAULT 0,
  billing_minimum_minutes INTEGER,
  billing_granularity_minutes INTEGER NOT NULL DEFAULT 15,
  allocation_mode TEXT NOT NULL DEFAULT 'time_weighted' CHECK (allocation_mode IN ('time_weighted', 'mass_weighted')),
  session_date DATE NOT NULL,
  notes TEXT,
  -- Computed/cached values (updated on batch changes)
  billable_minutes INTEGER,
  session_toll_cost DECIMAL(10, 2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Roasting Batches table
CREATE TABLE IF NOT EXISTS public.roasting_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.roasting_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  coffee_name TEXT NOT NULL,
  lot_code TEXT,
  -- Green coffee pricing
  price_basis TEXT NOT NULL CHECK (price_basis IN ('per_lb', 'per_kg')),
  price_value DECIMAL(10, 4) NOT NULL,
  -- Weights (all stored in grams)
  green_weight_g DECIMAL(10, 2) NOT NULL,
  roasted_weight_g DECIMAL(10, 2) NOT NULL,
  rejects_g DECIMAL(10, 2) NOT NULL DEFAULT 0,
  -- Roast details
  roast_minutes INTEGER NOT NULL,
  batch_date DATE NOT NULL,
  -- Energy (optional)
  energy_kwh DECIMAL(10, 4),
  kwh_rate DECIMAL(10, 4),
  -- Computed values (updated on session recompute)
  sellable_g DECIMAL(10, 2),
  loss_percent DECIMAL(5, 2),
  green_cost_per_g DECIMAL(10, 6),
  toll_cost_per_g DECIMAL(10, 6),
  energy_cost_per_g DECIMAL(10, 6),
  total_cost_per_g DECIMAL(10, 6),
  batch_toll_allocated DECIMAL(10, 2),
  -- Component link (when batch is turned into a component)
  component_id UUID REFERENCES public.components(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.roasting_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roasting_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roasting_batches ENABLE ROW LEVEL SECURITY;

-- RLS Policies for roasting_settings
CREATE POLICY "roasting_settings_select_own" ON public.roasting_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "roasting_settings_insert_own" ON public.roasting_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "roasting_settings_update_own" ON public.roasting_settings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "roasting_settings_delete_own" ON public.roasting_settings FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for roasting_sessions
CREATE POLICY "roasting_sessions_select_own" ON public.roasting_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "roasting_sessions_insert_own" ON public.roasting_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "roasting_sessions_update_own" ON public.roasting_sessions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "roasting_sessions_delete_own" ON public.roasting_sessions FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for roasting_batches
CREATE POLICY "roasting_batches_select_own" ON public.roasting_batches FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "roasting_batches_insert_own" ON public.roasting_batches FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "roasting_batches_update_own" ON public.roasting_batches FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "roasting_batches_delete_own" ON public.roasting_batches FOR DELETE USING (auth.uid() = user_id);

-- Add update triggers
CREATE TRIGGER roasting_settings_updated_at BEFORE UPDATE ON public.roasting_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER roasting_sessions_updated_at BEFORE UPDATE ON public.roasting_sessions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER roasting_batches_updated_at BEFORE UPDATE ON public.roasting_batches FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_roasting_sessions_user_id ON public.roasting_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_roasting_sessions_date ON public.roasting_sessions(session_date);
CREATE INDEX IF NOT EXISTS idx_roasting_batches_session_id ON public.roasting_batches(session_id);
CREATE INDEX IF NOT EXISTS idx_roasting_batches_user_id ON public.roasting_batches(user_id);
CREATE INDEX IF NOT EXISTS idx_roasting_batches_component_id ON public.roasting_batches(component_id);
CREATE INDEX IF NOT EXISTS idx_roasting_batches_date ON public.roasting_batches(batch_date);

-- Coffee Inventory Database Schema
-- Tracks green coffee inventory with pricing, usage, and change history

-- Green Coffee Inventory table
CREATE TABLE IF NOT EXISTS public.green_coffee_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  origin TEXT,
  lot_code TEXT,
  -- Pricing (stored per lb, can be entered as per_lb or per_kg)
  price_per_lb DECIMAL(10, 4) NOT NULL,
  -- Quantities in grams
  initial_quantity_g DECIMAL(12, 2) NOT NULL,
  current_green_quantity_g DECIMAL(12, 2) NOT NULL DEFAULT 0,
  current_roasted_quantity_g DECIMAL(12, 2) NOT NULL DEFAULT 0,
  -- Metadata
  supplier TEXT,
  purchase_date DATE,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Coffee Inventory Change Log (tracks all changes to inventory)
CREATE TABLE IF NOT EXISTS public.coffee_inventory_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coffee_id UUID NOT NULL REFERENCES public.green_coffee_inventory(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  changed_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  change_type TEXT NOT NULL CHECK (change_type IN ('initial', 'roast_deduct', 'roast_add', 'sale_deduct', 'manual_green_adjust', 'manual_roasted_adjust', 'price_change')),
  -- Quantities (positive = add, negative = deduct)
  green_quantity_change_g DECIMAL(12, 2) DEFAULT 0,
  roasted_quantity_change_g DECIMAL(12, 2) DEFAULT 0,
  -- Price changes
  old_price_per_lb DECIMAL(10, 4),
  new_price_per_lb DECIMAL(10, 4),
  -- Reference to source (batch_id, order_id, etc.)
  reference_id UUID,
  reference_type TEXT CHECK (reference_type IN ('roasting_batch', 'order', 'manual', NULL)),
  -- Notes explaining the change
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Link roasting_batches to green_coffee_inventory
ALTER TABLE public.roasting_batches
ADD COLUMN IF NOT EXISTS green_coffee_id UUID REFERENCES public.green_coffee_inventory(id) ON DELETE SET NULL;

-- Create index for better lookups
CREATE INDEX IF NOT EXISTS idx_roasting_batches_green_coffee_id ON public.roasting_batches(green_coffee_id);

-- Enable Row Level Security
ALTER TABLE public.green_coffee_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coffee_inventory_changes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for green_coffee_inventory
CREATE POLICY "green_coffee_inventory_select_own" ON public.green_coffee_inventory FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "green_coffee_inventory_insert_own" ON public.green_coffee_inventory FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "green_coffee_inventory_update_own" ON public.green_coffee_inventory FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "green_coffee_inventory_delete_own" ON public.green_coffee_inventory FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for coffee_inventory_changes
CREATE POLICY "coffee_inventory_changes_select_own" ON public.coffee_inventory_changes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "coffee_inventory_changes_insert_own" ON public.coffee_inventory_changes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "coffee_inventory_changes_delete_own" ON public.coffee_inventory_changes FOR DELETE USING (auth.uid() = user_id);

-- Add update triggers
CREATE TRIGGER green_coffee_inventory_updated_at BEFORE UPDATE ON public.green_coffee_inventory FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_green_coffee_inventory_user_id ON public.green_coffee_inventory(user_id);
CREATE INDEX IF NOT EXISTS idx_green_coffee_inventory_is_active ON public.green_coffee_inventory(is_active);
CREATE INDEX IF NOT EXISTS idx_coffee_inventory_changes_coffee_id ON public.coffee_inventory_changes(coffee_id);
CREATE INDEX IF NOT EXISTS idx_coffee_inventory_changes_created_at ON public.coffee_inventory_changes(created_at DESC);

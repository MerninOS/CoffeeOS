-- Roasted Coffee Stock Schema
-- Tracks roasted coffee inventory and order assignments

-- Add roasted stock tracking columns to roasting_batches
ALTER TABLE public.roasting_batches 
ADD COLUMN IF NOT EXISTS roasted_stock_remaining_g DECIMAL(10, 2);

-- Initialize roasted_stock_remaining_g to sellable_g for existing batches
UPDATE public.roasting_batches 
SET roasted_stock_remaining_g = sellable_g 
WHERE roasted_stock_remaining_g IS NULL;

-- Create table to track roasted coffee assigned to orders
CREATE TABLE IF NOT EXISTS public.order_roasted_coffee (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  roasting_batch_id UUID NOT NULL REFERENCES public.roasting_batches(id) ON DELETE CASCADE,
  quantity_g DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add ready_to_ship status to orders
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS ready_to_ship BOOLEAN DEFAULT FALSE;

ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS ready_to_ship_at TIMESTAMPTZ;

-- Enable Row Level Security on order_roasted_coffee
ALTER TABLE public.order_roasted_coffee ENABLE ROW LEVEL SECURITY;

-- RLS Policies for order_roasted_coffee (through order ownership)
CREATE POLICY "order_roasted_coffee_select_own" ON public.order_roasted_coffee 
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.orders 
    WHERE orders.id = order_roasted_coffee.order_id 
    AND orders.user_id = auth.uid()
  )
);

CREATE POLICY "order_roasted_coffee_insert_own" ON public.order_roasted_coffee 
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.orders 
    WHERE orders.id = order_roasted_coffee.order_id 
    AND orders.user_id = auth.uid()
  )
);

CREATE POLICY "order_roasted_coffee_update_own" ON public.order_roasted_coffee 
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.orders 
    WHERE orders.id = order_roasted_coffee.order_id 
    AND orders.user_id = auth.uid()
  )
);

CREATE POLICY "order_roasted_coffee_delete_own" ON public.order_roasted_coffee 
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.orders 
    WHERE orders.id = order_roasted_coffee.order_id 
    AND orders.user_id = auth.uid()
  )
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_order_roasted_coffee_order_id ON public.order_roasted_coffee(order_id);
CREATE INDEX IF NOT EXISTS idx_order_roasted_coffee_batch_id ON public.order_roasted_coffee(roasting_batch_id);
CREATE INDEX IF NOT EXISTS idx_roasting_batches_stock_remaining ON public.roasting_batches(roasted_stock_remaining_g);

-- Add update trigger for order_roasted_coffee
CREATE TRIGGER order_roasted_coffee_updated_at 
BEFORE UPDATE ON public.order_roasted_coffee 
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

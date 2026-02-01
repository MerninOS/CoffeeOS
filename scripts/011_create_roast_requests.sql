-- Roast Requests Database Schema
-- Tracks roast requests created from orders or manually

-- Roast Requests table
CREATE TABLE IF NOT EXISTS public.roast_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Link to source order (optional - can be manual request)
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  -- Link to green coffee inventory
  green_coffee_id UUID REFERENCES public.green_coffee_inventory(id) ON DELETE SET NULL,
  -- Coffee details (denormalized for display even if green_coffee is deleted)
  coffee_name TEXT NOT NULL,
  -- Quantities in grams
  requested_roasted_g DECIMAL(12, 2) NOT NULL,
  fulfilled_roasted_g DECIMAL(12, 2) NOT NULL DEFAULT 0,
  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'fulfilled', 'cancelled')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  -- Notes
  notes TEXT,
  -- Timestamps
  due_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fulfilled_at TIMESTAMPTZ
);

-- Roast Request Fulfillments table (tracks batches used to fulfill requests)
CREATE TABLE IF NOT EXISTS public.roast_request_fulfillments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  roast_request_id UUID NOT NULL REFERENCES public.roast_requests(id) ON DELETE CASCADE,
  roasting_batch_id UUID REFERENCES public.roasting_batches(id) ON DELETE SET NULL,
  -- How much roasted coffee was allocated from this batch
  quantity_g DECIMAL(12, 2) NOT NULL,
  -- Source - either from existing inventory or new batch
  source_type TEXT NOT NULL CHECK (source_type IN ('batch', 'inventory')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.roast_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roast_request_fulfillments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for roast_requests
CREATE POLICY "roast_requests_select_own" ON public.roast_requests FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "roast_requests_insert_own" ON public.roast_requests FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "roast_requests_update_own" ON public.roast_requests FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "roast_requests_delete_own" ON public.roast_requests FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for roast_request_fulfillments (access through roast_requests)
CREATE POLICY "roast_request_fulfillments_select_own" ON public.roast_request_fulfillments 
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.roast_requests rr WHERE rr.id = roast_request_id AND rr.user_id = auth.uid())
  );
CREATE POLICY "roast_request_fulfillments_insert_own" ON public.roast_request_fulfillments 
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.roast_requests rr WHERE rr.id = roast_request_id AND rr.user_id = auth.uid())
  );
CREATE POLICY "roast_request_fulfillments_delete_own" ON public.roast_request_fulfillments 
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.roast_requests rr WHERE rr.id = roast_request_id AND rr.user_id = auth.uid())
  );

-- Add update trigger
CREATE TRIGGER roast_requests_updated_at BEFORE UPDATE ON public.roast_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_roast_requests_user_id ON public.roast_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_roast_requests_status ON public.roast_requests(status);
CREATE INDEX IF NOT EXISTS idx_roast_requests_order_id ON public.roast_requests(order_id);
CREATE INDEX IF NOT EXISTS idx_roast_requests_green_coffee_id ON public.roast_requests(green_coffee_id);
CREATE INDEX IF NOT EXISTS idx_roast_request_fulfillments_request_id ON public.roast_request_fulfillments(roast_request_id);
CREATE INDEX IF NOT EXISTS idx_roast_request_fulfillments_batch_id ON public.roast_request_fulfillments(roasting_batch_id);

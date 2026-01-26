-- Add admin_access_token to shopify_settings for Admin API access (orders)
ALTER TABLE public.shopify_settings 
ADD COLUMN IF NOT EXISTS admin_access_token TEXT;

-- Create orders table to cache synced orders
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shopify_order_id TEXT NOT NULL,
  shopify_order_number TEXT,
  order_name TEXT,
  created_at_shopify TIMESTAMPTZ,
  financial_status TEXT,
  fulfillment_status TEXT,
  total_price DECIMAL(10, 2),
  subtotal_price DECIMAL(10, 2),
  total_tax DECIMAL(10, 2),
  currency TEXT DEFAULT 'USD',
  customer_email TEXT,
  customer_name TEXT,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(shopify_order_id, user_id)
);

-- Create order line items table
CREATE TABLE IF NOT EXISTS public.order_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  shopify_line_item_id TEXT,
  shopify_product_id TEXT,
  shopify_variant_id TEXT,
  title TEXT NOT NULL,
  variant_title TEXT,
  sku TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  price DECIMAL(10, 2),
  total_price DECIMAL(10, 2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_line_items ENABLE ROW LEVEL SECURITY;

-- Orders policies
DROP POLICY IF EXISTS "orders_select_own" ON public.orders;
CREATE POLICY "orders_select_own" ON public.orders FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "orders_insert_own" ON public.orders;
CREATE POLICY "orders_insert_own" ON public.orders FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "orders_update_own" ON public.orders;
CREATE POLICY "orders_update_own" ON public.orders FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "orders_delete_own" ON public.orders;
CREATE POLICY "orders_delete_own" ON public.orders FOR DELETE USING (auth.uid() = user_id);

-- Order line items policies (through order ownership)
DROP POLICY IF EXISTS "order_line_items_select" ON public.order_line_items;
CREATE POLICY "order_line_items_select" ON public.order_line_items FOR SELECT 
USING (EXISTS (SELECT 1 FROM public.orders WHERE orders.id = order_line_items.order_id AND orders.user_id = auth.uid()));

DROP POLICY IF EXISTS "order_line_items_insert" ON public.order_line_items;
CREATE POLICY "order_line_items_insert" ON public.order_line_items FOR INSERT 
WITH CHECK (EXISTS (SELECT 1 FROM public.orders WHERE orders.id = order_line_items.order_id AND orders.user_id = auth.uid()));

DROP POLICY IF EXISTS "order_line_items_delete" ON public.order_line_items;
CREATE POLICY "order_line_items_delete" ON public.order_line_items FOR DELETE 
USING (EXISTS (SELECT 1 FROM public.orders WHERE orders.id = order_line_items.order_id AND orders.user_id = auth.uid()));

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at_shopify DESC);
CREATE INDEX IF NOT EXISTS idx_order_line_items_order_id ON public.order_line_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_line_items_product_id ON public.order_line_items(product_id);

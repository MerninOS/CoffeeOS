-- Add wholesale pricing fields to products table
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS wholesale_price DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS wholesale_minimum_qty INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS wholesale_enabled BOOLEAN DEFAULT false;

-- Create wholesale price tiers table for volume discounts
CREATE TABLE IF NOT EXISTS wholesale_price_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  min_quantity INTEGER NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_wholesale_price_tiers_product_id ON wholesale_price_tiers(product_id);

-- Enable RLS
ALTER TABLE wholesale_price_tiers ENABLE ROW LEVEL SECURITY;

-- RLS policies for wholesale_price_tiers
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'wholesale_tiers_select_own' AND tablename = 'wholesale_price_tiers') THEN
    CREATE POLICY wholesale_tiers_select_own ON wholesale_price_tiers FOR SELECT
      USING (product_id IN (SELECT id FROM products WHERE user_id = auth.uid()));
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'wholesale_tiers_insert_own' AND tablename = 'wholesale_price_tiers') THEN
    CREATE POLICY wholesale_tiers_insert_own ON wholesale_price_tiers FOR INSERT
      WITH CHECK (product_id IN (SELECT id FROM products WHERE user_id = auth.uid()));
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'wholesale_tiers_update_own' AND tablename = 'wholesale_price_tiers') THEN
    CREATE POLICY wholesale_tiers_update_own ON wholesale_price_tiers FOR UPDATE
      USING (product_id IN (SELECT id FROM products WHERE user_id = auth.uid()));
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'wholesale_tiers_delete_own' AND tablename = 'wholesale_price_tiers') THEN
    CREATE POLICY wholesale_tiers_delete_own ON wholesale_price_tiers FOR DELETE
      USING (product_id IN (SELECT id FROM products WHERE user_id = auth.uid()));
  END IF;
END $$;

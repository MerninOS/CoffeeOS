-- Create order_custom_costs table for storing arbitrary costs per order
CREATE TABLE IF NOT EXISTS order_custom_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_order_custom_costs_order_id ON order_custom_costs(order_id);

-- Enable RLS
ALTER TABLE order_custom_costs ENABLE ROW LEVEL SECURITY;

-- RLS policy: users can manage custom costs on their own orders
CREATE POLICY "Users can view custom costs on their orders"
  ON order_custom_costs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_custom_costs.order_id
      AND orders.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert custom costs on their orders"
  ON order_custom_costs
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_custom_costs.order_id
      AND orders.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update custom costs on their orders"
  ON order_custom_costs
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_custom_costs.order_id
      AND orders.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete custom costs on their orders"
  ON order_custom_costs
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_custom_costs.order_id
      AND orders.user_id = auth.uid()
    )
  );

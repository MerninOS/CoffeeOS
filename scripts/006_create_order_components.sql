-- Create order_components table to store additional components added to orders
-- This allows tracking per-order costs like packaging, shipping labels, etc.

CREATE TABLE IF NOT EXISTS order_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  component_id UUID NOT NULL REFERENCES components(id) ON DELETE CASCADE,
  quantity NUMERIC NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(order_id, component_id)
);

-- Enable RLS
ALTER TABLE order_components ENABLE ROW LEVEL SECURITY;

-- RLS policies - users can only access order_components for orders they own
CREATE POLICY order_components_select ON order_components
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM orders WHERE orders.id = order_components.order_id AND orders.user_id = auth.uid()
    )
  );

CREATE POLICY order_components_insert ON order_components
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders WHERE orders.id = order_components.order_id AND orders.user_id = auth.uid()
    )
  );

CREATE POLICY order_components_update ON order_components
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM orders WHERE orders.id = order_components.order_id AND orders.user_id = auth.uid()
    )
  );

CREATE POLICY order_components_delete ON order_components
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM orders WHERE orders.id = order_components.order_id AND orders.user_id = auth.uid()
    )
  );

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_order_components_order_id ON order_components(order_id);
CREATE INDEX IF NOT EXISTS idx_order_components_component_id ON order_components(component_id);

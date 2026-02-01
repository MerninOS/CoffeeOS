-- Add coffee_inventory_id to roasting_batches
ALTER TABLE roasting_batches 
ADD COLUMN IF NOT EXISTS coffee_inventory_id UUID REFERENCES green_coffee_inventory(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_roasting_batches_coffee_inventory_id ON roasting_batches(coffee_inventory_id);

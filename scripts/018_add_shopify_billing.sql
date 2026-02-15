-- Add billing state fields to Shopify settings.
ALTER TABLE public.shopify_settings
  ADD COLUMN IF NOT EXISTS billing_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS billing_plan_name TEXT,
  ADD COLUMN IF NOT EXISTS billing_status TEXT,
  ADD COLUMN IF NOT EXISTS billing_test BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS billing_current_period_end TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS billing_checked_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_shopify_settings_billing_status
  ON public.shopify_settings(billing_status);

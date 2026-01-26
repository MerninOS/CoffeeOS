-- Add OAuth client credentials columns to shopify_settings
ALTER TABLE shopify_settings 
ADD COLUMN IF NOT EXISTS client_id TEXT,
ADD COLUMN IF NOT EXISTS client_secret TEXT;

-- We'll keep admin_access_token for caching the token
-- The token will be refreshed when expired (24 hour expiry)
ALTER TABLE shopify_settings
ADD COLUMN IF NOT EXISTS admin_token_expires_at TIMESTAMPTZ;

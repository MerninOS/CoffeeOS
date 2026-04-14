-- Add co-roasting cost mode: charged per pound of green coffee
ALTER TABLE public.roasting_sessions
  ADD COLUMN IF NOT EXISTS rate_per_lb DECIMAL(10,4);

ALTER TABLE public.roasting_sessions
  DROP CONSTRAINT IF EXISTS roasting_sessions_cost_mode_check;

ALTER TABLE public.roasting_sessions
  ADD CONSTRAINT roasting_sessions_cost_mode_check
  CHECK (cost_mode IN ('toll_roasting', 'power_usage', 'co_roasting'));

-- Increase component cost precision for per-gram costing
ALTER TABLE public.components
  ALTER COLUMN cost_per_unit TYPE DECIMAL(18,8);

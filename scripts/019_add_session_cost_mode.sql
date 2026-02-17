-- Add session-level costing mode for toll roasting vs machine power usage
ALTER TABLE public.roasting_sessions
  ADD COLUMN IF NOT EXISTS cost_mode TEXT NOT NULL DEFAULT 'toll_roasting',
  ADD COLUMN IF NOT EXISTS machine_energy_kwh_per_hour DECIMAL(10,4),
  ADD COLUMN IF NOT EXISTS kwh_rate DECIMAL(10,4);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'roasting_sessions_cost_mode_check'
  ) THEN
    ALTER TABLE public.roasting_sessions
      ADD CONSTRAINT roasting_sessions_cost_mode_check
      CHECK (cost_mode IN ('toll_roasting', 'power_usage'));
  END IF;
END $$;

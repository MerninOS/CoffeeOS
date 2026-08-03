export interface Session {
  id: string;
  session_date: string;
  vendor_name: string;
  rate_per_hour: number;
  cost_mode: "toll_roasting" | "power_usage" | "co_roasting";
  rate_per_lb: number | null;
  machine_energy_kwh_per_hour: number | null;
  kwh_rate: number | null;
  setup_minutes: number;
  cleanup_minutes: number;
  billing_granularity_minutes: number;
  allocation_mode: string;
  billable_minutes: number | null;
  session_toll_cost: number | null;
  /** The arithmetic behind session_toll_cost, e.g. "1.3 h × $85.00". Computed
   *  with the cost in session-cost.ts so the two cannot disagree. */
  cost_basis: string;
  /** Short label for the billing mode, e.g. "Toll · per hour". */
  cost_mode_label: string;
  notes: string | null;
  created_at: string;
  batch_count: number;
  total_green_weight_g: number;
  total_roasted_weight_g: number;
}

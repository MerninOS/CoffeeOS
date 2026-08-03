export interface Batch {
  id: string;
  coffee_name: string;
  lot_code: string | null;
  price_basis: "per_lb" | "per_kg";
  price_value: number;
  green_weight_g: number;
  roasted_weight_g: number;
  rejects_g: number;
  sellable_g: number;
  loss_percent: number;
  roast_minutes: number;
  batch_date: string;
  energy_kwh: number | null;
  kwh_rate: number | null;
  green_cost_per_g: number;
  component_id: string | null;
  created_at: string;
  roasting_sessions: {
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
    session_toll_cost: number | null;
  } | null;
  components: {
    id: string;
    name: string;
  } | null;
}

export interface ExistingComponent {
  id: string;
  name: string;
  cost_per_unit: number;
  unit: string;
  type: string;
}

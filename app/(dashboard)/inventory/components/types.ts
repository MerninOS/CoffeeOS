/**
 * The shapes `/inventory` passes around, moved out of the client component
 * (CoffeeOS#72 Stage 3).
 *
 * `CoffeeInventory` mirrors a `green_coffee_inventory` row as `page.tsx`
 * selects it (`select("*")`). Quantities are GRAMS — the `_g` suffixes are
 * load-bearing, and `lib/inventory/units.ts` is the only thing that should be
 * turning them into pounds.
 *
 * `is_active` is in the row and read by NOTHING in the application. Kept here
 * because the select returns it and dropping it from the type would hide that
 * fact; wiring it up is a product decision, not a conversion.
 */
export interface CoffeeInventory {
  id: string;
  name: string;
  origin: string;
  lot_code: string | null;
  supplier: string | null;
  price_per_lb: number;
  initial_quantity_g: number;
  current_green_quantity_g: number;
  roasted_stock_g: number;
  purchase_date: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
}

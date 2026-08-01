/**
 * Shared types and option lists for /components.
 *
 * CoffeeOS#73 Stage A — extracted from components-client.tsx with no change in
 * value or meaning. `cost_per_unit` is typed non-null because the column is
 * `numeric NOT NULL DEFAULT 0`; the ticket's "null or 0" wording describes a
 * state the schema cannot produce, so uncosted is `=== 0` and nothing else.
 */

export interface Component {
  id: string;
  name: string;
  type: string;
  cost_per_unit: number;
  unit: string;
  notes: string | null;
  created_at: string;
}

export const COST_PER_UNIT_DECIMALS = 8;

export const COMPONENT_TYPES = [
  { value: "ingredient", label: "Ingredient" },
  { value: "labor", label: "Labor" },
  { value: "packaging", label: "Packaging" },
  { value: "other", label: "Other" },
];

export const UNITS = ["unit", "oz", "lb", "g", "kg", "ml", "L", "each", "hour"];

/** The create/edit form's shape. Distinct from `Component`: the form carries
 *  strings (an in-progress number is not a number) and uses the pre-existing
 *  `category` / `description` field names that map onto `type` / `notes`. */
export interface ComponentFormData {
  name: string;
  category: string;
  costPerUnit: string;
  unit: string;
  description: string;
}

/**
 * Shared row/entity shapes for the /orders surface.
 *
 * Moved verbatim out of orders-client.tsx so the extracted components can be
 * typed without importing from their own parent (which would be circular).
 * Field names and optionality are unchanged.
 */

export interface OrderLineItem {
  id: string;
  title: string;
  sku: string | null;
  quantity: number;
  price: number;
  total_price: number;
  product_id: string | null;
  shopify_product_id: string | null;
}

export interface ComponentData {
  id: string;
  name: string;
  cost_per_unit: number;
  unit: string;
  type: string;
}

export interface OrderComponent {
  id: string;
  component_id: string;
  quantity: number;
  components: ComponentData | null;
}

export interface OrderCustomCost {
  id: string;
  description: string;
  amount: number;
}

export interface Order {
  id: string;
  shopify_order_id: string;
  order_name: string;
  shopify_order_number: string;
  created_at_shopify: string;
  financial_status: string;
  fulfillment_status: string;
  subtotal_price: number;
  total_tax: number;
  total_price: number;
  currency: string;
  ready_to_ship: boolean;
  order_line_items: OrderLineItem[];
  order_components: OrderComponent[];
  order_custom_costs: OrderCustomCost[];
}

export interface CoffeeInventory {
  id: string;
  name: string;
  origin: string;
  current_green_quantity_g: number;
}

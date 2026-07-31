import type { ProductLookup } from "@/lib/orders/cogs";

/**
 * The row and entity shapes /orders/[id] renders.
 *
 * Moved out of order-detail-client.tsx unchanged (CoffeeOS#70 Stage A) so the
 * extracted panels can share them without importing from their own parent —
 * the same reason app/(dashboard)/orders/components/types.ts exists.
 */

export type OrderLineItem = {
  id: string;
  title: string;
  variant_title: string | null;
  sku: string | null;
  quantity: number;
  price: number;
  total_price: number;
  /**
   * The only thing costing needs from a line item. The nested `products` relation
   * that used to hang here fed `calculateCOGS` and nothing else — cost now comes
   * from the owner-wide ProductLookup, keyed by this id.
   *
   * Note the display fields above are the order's HISTORICAL values: `title` is
   * what the item was called when it sold, which is deliberately not the
   * product's current title. Anything naming a product to send an operator to
   * fix it must read the lookup instead (CoffeeOS#78).
   */
  product_id: string | null;
};

export type OrderComponent = {
  id: string;
  component_id: string;
  quantity: number;
  components: { id: string; name: string; type: string; cost_per_unit: number } | null;
};

export type OrderCustomCost = { id: string; description: string; amount: number };

export type OrderRoastedCoffee = {
  id: string;
  green_coffee_id: string;
  amount_g: number;
  assigned_at: string;
  green_coffee_inventory: { id: string; name: string } | null;
};

export type Order = {
  id: string;
  order_name: string;
  created_at_shopify: string;
  financial_status: string;
  fulfillment_status: string | null;
  subtotal_price: number;
  total_tax: number;
  total_price: number;
  currency: string;
  ready_to_ship: boolean;
  order_line_items: OrderLineItem[];
  order_components: OrderComponent[];
  order_custom_costs: OrderCustomCost[];
  order_roasted_coffee: OrderRoastedCoffee[];
};

export type CoffeeStock = {
  id: string;
  name: string;
  origin: string | null;
  roasted_stock_g: number;
};

export type Component = {
  id: string;
  name: string;
  type: string;
  cost_per_unit: number;
};

export interface OrderDetailClientProps {
  order: Order;
  /**
   * Every product the owner has, keyed by id — NOT just the ones on this order.
   * `classifyOrder` distinguishes "product no longer exists" from "product has no
   * recipe" by absence from this map, so a narrower lookup silently collapses
   * those two cases. Built server-side by `buildProductLookup`.
   */
  products: ProductLookup;
  coffeeStock: CoffeeStock[];
  components: Component[];
}

/** A coffee assignment flattened for display. Derived in the parent. */
export type AssignedCoffee = {
  id: string;
  greenCoffeeId: string;
  coffeeName: string;
  amountG: number;
  assignedAt: string;
};

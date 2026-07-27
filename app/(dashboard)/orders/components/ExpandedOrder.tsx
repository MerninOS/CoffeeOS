"use client";

import React from "react";
import { Plus, Minus, Trash2, X, Flame } from "lucide-react";
import { Button, IconButton, Input, InlineBanner } from "@merninos/ui/instrument";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { needsCogs } from "@/lib/orders/cogs";
import { mono, overline, sans, money } from "./tokens";
import type {
  Order,
  OrderLineItem,
  ComponentData,
  CoffeeInventory,
} from "./types";

/**
 * The expanded content of an order row — line items, additional components,
 * custom costs and the roast-request entry point.
 *
 * Rebuilt on the instrument design system. The layout model is a WORKSHEET:
 * ruled sub-blocks sitting directly on `--surface-sunken`, divided by hairlines.
 * Deliberately not nested cards — the old version wrapped every row in its own
 * bordered tile, which is the loud system's model and reads as noise at this
 * density.
 *
 * Prop names and handler wiring are UNCHANGED, and every `data-testid` is
 * carried across verbatim: tests/e2e/orders-capabilities.spec.ts drives the six
 * mutation flows through them and asserts the COGS actually moved, so a control
 * that renders perfectly and silently no-ops fails there rather than shipping.
 *
 * The component and roast-request pickers stay on the Radix (`@/components/ui`)
 * Select rather than the instrument one: instrument's Select is a NATIVE
 * `<select>`, and both the tests and the interaction model depend on a listbox
 * whose options can be clicked (`getByRole('option').click()`), which a native
 * select does not provide. Its trigger is retokenized inline instead.
 */

export interface OrderExpandedContentProps {
  order: Order;
  productCogsMap: Record<string, number>;
  allComponents: ComponentData[];
  coffeeInventory: CoffeeInventory[];
  getLineItemCogs: (item: OrderLineItem) => number;
  getOrderComponentsCogs: (order: Order) => number;
  getOrderCustomCostsTotal: (order: Order) => number;
  getTotalAdditionalCosts: (order: Order) => number;
  addingComponentTo: string | null;
  setAddingComponentTo: (id: string | null) => void;
  selectedComponentId: string;
  setSelectedComponentId: (id: string) => void;
  componentQuantity: number;
  setComponentQuantity: (qty: number) => void;
  handleAddComponent: (orderId: string) => void;
  handleUpdateQuantity: (orderComponentId: string, newQuantity: number) => void;
  handleRemoveComponent: (orderComponentId: string) => void;
  addingCustomCostTo: string | null;
  setAddingCustomCostTo: (id: string | null) => void;
  customCostDescription: string;
  setCustomCostDescription: (desc: string) => void;
  customCostAmount: string;
  setCustomCostAmount: (amount: string) => void;
  handleAddCustomCost: (orderId: string) => void;
  handleRemoveCustomCost: (customCostId: string) => void;
  setRoastRequestOrder: (order: Order | null) => void;
}

/** The Radix trigger, wearing instrument tokens. `style` reaches the underlying
 *  button through `...props`; the class list is left alone so the shadcn focus
 *  and open-state behaviour is untouched. */
const SELECT_TRIGGER: React.CSSProperties = {
  ...sans,
  width: "100%",
  height: 34,
  background: "var(--surface)",
  border: "1px solid var(--hairline-strong)",
  borderRadius: "var(--r-sm)",
  color: "var(--ink)",
  boxShadow: "none",
};

/** A ruled sub-block. Deliberately NOT a card — worksheet content sits on the
 *  surface and is divided by hairlines. */
function SubBlock({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section style={{ marginBottom: "var(--space-5)" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "var(--space-3)",
          paddingBottom: "var(--space-2)",
          borderBottom: "1px solid var(--hairline)",
          marginBottom: "var(--space-3)",
        }}
      >
        <h3 style={{ ...overline, color: "var(--ink-muted)" }}>{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

/** A hairline-ruled row inside a sub-block. */
const ruled = (isLast: boolean): React.CSSProperties => ({
  display: "flex",
  alignItems: "center",
  gap: "var(--space-3)",
  padding: "var(--space-2) 0",
  borderBottom: isLast ? "none" : "1px solid var(--hairline)",
});

export function ExpandedOrder({
  order,
  productCogsMap,
  allComponents,
  coffeeInventory,
  getOrderComponentsCogs,
  getOrderCustomCostsTotal,
  getTotalAdditionalCosts,
  addingComponentTo,
  setAddingComponentTo,
  selectedComponentId,
  setSelectedComponentId,
  componentQuantity,
  setComponentQuantity,
  handleAddComponent,
  handleUpdateQuantity,
  handleRemoveComponent,
  addingCustomCostTo,
  setAddingCustomCostTo,
  customCostDescription,
  setCustomCostDescription,
  customCostAmount,
  setCustomCostAmount,
  handleAddCustomCost,
  handleRemoveCustomCost,
  setRoastRequestOrder,
}: OrderExpandedContentProps) {
  const shipping =
    (order.total_price || 0) -
    (order.subtotal_price || 0) -
    (order.total_tax || 0);

  const components = order.order_components || [];
  const customCosts = order.order_custom_costs || [];
  const missing = needsCogs(order, productCogsMap);

  return (
    <div
      data-testid="order-expanded"
      onClick={(e) => e.stopPropagation()}
      style={{
        padding: "var(--space-5)",
        background: "var(--surface-sunken)",
        borderBottom: "1px solid var(--hairline)",
      }}
    >
      {missing && (
        <div style={{ marginBottom: "var(--space-4)" }}>
          <InlineBanner tone="warning" title="No product COGS assigned">
            This order&apos;s margin is revenue only. Assign components to its
            products so the figures below can be trusted.
          </InlineBanner>
        </div>
      )}

      <SubBlock title="Line items">
        {/* Column labels only exist in the wide layout — stacked, each figure
            carries its own, exactly as the worksheet rows do. */}
        <div
          className="hidden min-[900px]:grid gap-3 min-[900px]:grid-cols-[1fr_120px_64px_92px_92px]"
          style={{ ...overline, paddingBottom: "var(--space-2)", borderBottom: "1px solid var(--hairline)" }}
        >
          <span>Product</span>
          <span>SKU</span>
          <span className="text-right">Qty</span>
          <span className="text-right">Price</span>
          <span className="text-right">Unit COGS</span>
        </div>

        {order.order_line_items.map((item, i) => (
          <div
            key={item.id}
            className="grid gap-x-3 gap-y-1 grid-cols-3 min-[900px]:grid-cols-[1fr_120px_64px_92px_92px]"
            style={{
              ...sans,
              padding: "var(--space-2) 0",
              borderBottom:
                i < order.order_line_items.length - 1 ? "1px solid var(--hairline)" : "none",
            }}
          >
            <span className="col-span-3 min-[900px]:col-span-1">{item.title}</span>
            <span
              className="col-span-3 min-[900px]:col-span-1"
              style={{ ...mono, fontSize: "var(--fs-caption)", color: "var(--ink-subtle)" }}
            >
              {item.sku || "—"}
            </span>
            <span className="flex flex-col gap-0.5 min-[900px]:block min-[900px]:text-right">
              <span style={overline} className="min-[900px]:hidden">Qty</span>
              <span style={{ ...mono, color: "var(--ink-muted)" }}>{item.quantity}</span>
            </span>
            <span className="flex flex-col gap-0.5 min-[900px]:block min-[900px]:text-right">
              <span style={overline} className="min-[900px]:hidden">Price</span>
              <span style={mono}>{money(item.price || 0)}</span>
            </span>
            <span className="flex flex-col gap-0.5 min-[900px]:block min-[900px]:text-right">
              <span style={overline} className="min-[900px]:hidden">Unit COGS</span>
              {/*
                `not set` when there is no cost to show, NOT merely when the line
                item has no product_id.

                The earlier condition tested `item.product_id`, which only catches
                an unlinked line item. A linked product with no recipe still has a
                map entry — page.tsx assigns every product a total, so an uncosted
                one is 0, not undefined — so it rendered "$0.00". That reads as
                "this costs nothing", which is a claim about the product. The truth
                is that nobody has told CoffeeOS what it is made of, and only the
                roaster can. Printing a confident zero for missing data is how a
                94.9% margin looks credible.

                Same rule as the COGS column in OrdersWorksheetTable: no cost at
                all → "not set"; a real figure → the figure.
              */}
              {item.product_id && (productCogsMap[item.product_id] || 0) > 0 ? (
                <span style={mono} data-testid="line-item-cogs">
                  {money(productCogsMap[item.product_id])}
                </span>
              ) : (
                <span
                  style={{ ...mono, color: "var(--danger)" }}
                  data-testid="line-item-cogs"
                >
                  not set
                </span>
              )}
            </span>
          </div>
        ))}

        <div
          className="flex justify-end"
          style={{ marginTop: "var(--space-3)" }}
        >
          <div style={{ minWidth: 240 }}>
            {(
              [
                ["Subtotal", order.subtotal_price || 0],
                ["Shipping", shipping],
                ["Tax", order.total_tax || 0],
              ] as const
            ).map(([label, value]) => (
              <div
                key={label}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "var(--space-1) 0",
                  ...sans,
                  color: "var(--ink-muted)",
                }}
              >
                <span>{label}</span>
                <span style={mono}>{money(value)}</span>
              </div>
            ))}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                padding: "var(--space-2) 0 0",
                borderTop: "1px solid var(--hairline)",
                marginTop: "var(--space-1)",
              }}
            >
              <span style={{ ...overline, color: "var(--ink-muted)" }}>Order total</span>
              <span style={{ ...mono, fontSize: "var(--fs-data)", color: "var(--ink)" }}>
                {money(order.total_price || 0)}
              </span>
            </div>
          </div>
        </div>
      </SubBlock>

      <SubBlock
        title="Additional components"
        action={
          addingComponentTo !== order.id ? (
            <Button
              size="sm"
              variant="tertiary"
              data-testid="add-component-open"
              iconLeft={<Plus />}
              onClick={() => setAddingComponentTo(order.id)}
            >
              Add component
            </Button>
          ) : undefined
        }
      >
        {addingComponentTo === order.id && (
          <div
            className="flex flex-col gap-3 sm:flex-row sm:items-end"
            style={{
              padding: "var(--space-3)",
              background: "var(--surface)",
              border: "1px solid var(--hairline)",
              borderRadius: "var(--r-sm)",
              marginBottom: "var(--space-3)",
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <label htmlFor={`component-${order.id}`} style={{ ...overline, display: "block", marginBottom: 4 }}>
                Component
              </label>
              <Select value={selectedComponentId} onValueChange={setSelectedComponentId}>
                <SelectTrigger
                  id={`component-${order.id}`}
                  data-testid="component-select"
                  style={SELECT_TRIGGER}
                >
                  <SelectValue placeholder="Select component…" />
                </SelectTrigger>
                <SelectContent>
                  {allComponents.map((comp) => (
                    <SelectItem key={comp.id} value={comp.id}>
                      {comp.name} ({money(comp.cost_per_unit)}/{comp.unit})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-2">
              <div style={{ width: 84 }}>
                <label htmlFor={`component-qty-${order.id}`} style={{ ...overline, display: "block", marginBottom: 4 }}>
                  Qty
                </label>
                <Input
                  id={`component-qty-${order.id}`}
                  size="sm"
                  mono
                  type="number"
                  min="1"
                  data-testid="component-qty-input"
                  value={componentQuantity}
                  onChange={(e) => setComponentQuantity(parseInt(e.target.value) || 1)}
                />
              </div>
              <Button
                size="sm"
                data-testid="component-add-submit"
                onClick={() => handleAddComponent(order.id)}
                disabled={!selectedComponentId}
              >
                Add
              </Button>
              <IconButton
                size="sm"
                aria-label="Cancel adding a component"
                icon={<X />}
                onClick={() => {
                  setAddingComponentTo(null);
                  setSelectedComponentId("");
                  setComponentQuantity(1);
                }}
              />
            </div>
          </div>
        )}

        {components.length === 0 ? (
          <p style={{ ...sans, color: "var(--ink-subtle)", padding: "var(--space-1) 0" }}>
            None yet. Packaging, labels and labour go here.
          </p>
        ) : (
          components.map((oc, i) => (
            <div
              key={oc.id}
              data-testid="order-component-row"
              style={ruled(i === components.length - 1)}
            >
              <span style={{ ...sans, flex: 1, minWidth: 0 }}>
                {oc.components?.name || "Unknown"}
                <span
                  style={{
                    ...overline,
                    marginLeft: "var(--space-2)",
                  }}
                >
                  {oc.components?.type}
                </span>
              </span>
              <IconButton
                size="sm"
                aria-label={`Decrease quantity of ${oc.components?.name || "component"}`}
                icon={<Minus />}
                data-testid="component-qty-decrement"
                onClick={() => handleUpdateQuantity(oc.id, oc.quantity - 1)}
              />
              <span
                data-testid="component-qty-value"
                style={{ ...mono, width: 24, textAlign: "center", color: "var(--ink)" }}
              >
                {oc.quantity}
              </span>
              <IconButton
                size="sm"
                aria-label={`Increase quantity of ${oc.components?.name || "component"}`}
                icon={<Plus />}
                data-testid="component-qty-increment"
                onClick={() => handleUpdateQuantity(oc.id, oc.quantity + 1)}
              />
              <span
                data-testid="component-unit-cost"
                style={{ ...mono, width: 72, textAlign: "right", color: "var(--ink)" }}
              >
                {money(oc.components?.cost_per_unit || 0)}
              </span>
              <IconButton
                size="sm"
                aria-label={`Remove ${oc.components?.name || "component"}`}
                icon={<Trash2 />}
                data-testid="component-remove"
                onClick={() => handleRemoveComponent(oc.id)}
              />
            </div>
          ))
        )}
      </SubBlock>

      <SubBlock
        title="Custom costs"
        action={
          addingCustomCostTo !== order.id ? (
            <Button
              size="sm"
              variant="tertiary"
              data-testid="add-custom-cost-open"
              iconLeft={<Plus />}
              onClick={() => setAddingCustomCostTo(order.id)}
            >
              Add cost
            </Button>
          ) : undefined
        }
      >
        {addingCustomCostTo === order.id && (
          <div
            className="flex flex-col gap-3 sm:flex-row sm:items-end"
            style={{
              padding: "var(--space-3)",
              background: "var(--surface)",
              border: "1px solid var(--hairline)",
              borderRadius: "var(--r-sm)",
              marginBottom: "var(--space-3)",
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <label htmlFor={`cost-desc-${order.id}`} style={{ ...overline, display: "block", marginBottom: 4 }}>
                Description
              </label>
              <Input
                id={`cost-desc-${order.id}`}
                size="sm"
                placeholder="Shipping, gift wrap…"
                data-testid="custom-cost-description-input"
                value={customCostDescription}
                onChange={(e) => setCustomCostDescription(e.target.value)}
              />
            </div>
            <div className="flex items-end gap-2">
              <div style={{ width: 104 }}>
                <label htmlFor={`cost-amount-${order.id}`} style={{ ...overline, display: "block", marginBottom: 4 }}>
                  Amount ($)
                </label>
                <Input
                  id={`cost-amount-${order.id}`}
                  size="sm"
                  mono
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  data-testid="custom-cost-amount-input"
                  value={customCostAmount}
                  onChange={(e) => setCustomCostAmount(e.target.value)}
                />
              </div>
              <Button
                size="sm"
                data-testid="custom-cost-add-submit"
                onClick={() => handleAddCustomCost(order.id)}
                disabled={!customCostDescription.trim() || !customCostAmount}
              >
                Add
              </Button>
              <IconButton
                size="sm"
                aria-label="Cancel adding a custom cost"
                icon={<X />}
                onClick={() => {
                  setAddingCustomCostTo(null);
                  setCustomCostDescription("");
                  setCustomCostAmount("");
                }}
              />
            </div>
          </div>
        )}

        {customCosts.length === 0 ? (
          <p style={{ ...sans, color: "var(--ink-subtle)", padding: "var(--space-1) 0" }}>
            None yet. One-off charges like freight or gift wrapping go here.
          </p>
        ) : (
          customCosts.map((cc, i) => (
            <div key={cc.id} data-testid="custom-cost-row" style={ruled(i === customCosts.length - 1)}>
              <span style={{ ...sans, flex: 1, minWidth: 0 }}>{cc.description}</span>
              <span style={{ ...mono, color: "var(--ink)" }}>{money(cc.amount)}</span>
              <IconButton
                size="sm"
                aria-label={`Remove ${cc.description}`}
                icon={<Trash2 />}
                data-testid="custom-cost-remove"
                onClick={() => handleRemoveCustomCost(cc.id)}
              />
            </div>
          ))
        )}
      </SubBlock>

      {/* Roast request + the additional-cost tally, on one baseline. */}
      <div className="flex flex-wrap items-end justify-between gap-6">
        {coffeeInventory.length > 0 ? (
          <Button
            variant="secondary"
            iconLeft={<Flame />}
            data-testid="roast-request-open"
            onClick={() => setRoastRequestOrder(order)}
          >
            Request roast
          </Button>
        ) : (
          <span />
        )}

        {(components.length > 0 || customCosts.length > 0) && (
          <div style={{ minWidth: 240 }}>
            {components.length > 0 && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "var(--space-1) 0",
                  ...sans,
                  color: "var(--ink-muted)",
                }}
              >
                <span>Components</span>
                <span style={mono}>{money(getOrderComponentsCogs(order))}</span>
              </div>
            )}
            {customCosts.length > 0 && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "var(--space-1) 0",
                  ...sans,
                  color: "var(--ink-muted)",
                }}
              >
                <span>Custom costs</span>
                <span style={mono}>{money(getOrderCustomCostsTotal(order))}</span>
              </div>
            )}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                padding: "var(--space-2) 0 0",
                borderTop: "2px solid var(--ink)",
                marginTop: "var(--space-1)",
              }}
            >
              <span style={{ ...overline, color: "var(--ink-muted)" }}>Total additional</span>
              <span
                data-testid="total-additional"
                style={{ ...mono, fontSize: "var(--fs-data)", color: "var(--ink)" }}
              >
                {money(getTotalAdditionalCosts(order))}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

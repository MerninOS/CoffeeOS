/**
 * CoffeeOS Order Packing — admin.order-details.block.render
 *
 * Lets an operator record which materials packed a Shopify order (box,
 * coffee, label, tape), quick-create a missing material, record what they
 * paid for shipping, and see the order's COGS/margin — without leaving
 * Shopify admin.
 *
 * HARD RULE: this file never computes COGS or margin. Every number shown
 * comes from the server's `PackingState` (lib/orders/packing-state.ts on the
 * CoffeeOS side). After a local unsaved edit we show "Save to update totals"
 * instead of guessing a new total — recomputing here would break the parity
 * guarantee the whole feature exists for.
 *
 * VERIFICATION GAP: this file has not been run, rendered, or type-checked
 * against a real @shopify/ui-extensions-react install (see the package.json
 * next to this file and the PR/commit notes for why). Component and prop
 * names below (AdminBlock, BlockStack, InlineStack, Text, Button, TextField,
 * NumberField, Select, Divider, Badge, Banner, ProgressIndicator, and props
 * like `tone`/`onPress`/`variant`) are a best-effort match for the
 * `2024-10` admin UI extensions API, not a verified one. Confirm them
 * against the installed package's type definitions (or `shopify app dev`
 * on a real dev store) before trusting this file compiles.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  reactExtension,
  useApi,
  AdminBlock,
  BlockStack,
  InlineStack,
  Text,
  Button,
  TextField,
  NumberField,
  Select,
  Divider,
  Badge,
  Banner,
  ProgressIndicator,
} from "@shopify/ui-extensions-react/admin";

const TARGET = "admin.order-details.block.render";

export default reactExtension(TARGET, () => <App />);

// ---------------------------------------------------------------------------
// API contract (server side lives in lib/orders/packing-state.ts + the
// /api/shopify/block/* routes another agent is building on this branch —
// this file is written against the contract, not against a running server).
// ---------------------------------------------------------------------------

interface OrderLineItem {
  id: string;
  title: string;
  quantity: number;
}

interface PackingLine {
  id: string;
  componentId: string;
  name: string;
  unit: string;
  costPerUnit: number;
  quantity: number;
}

interface LibraryComponent {
  id: string;
  name: string;
  type: string;
  unit: string;
  costPerUnit: number;
}

interface CustomCost {
  id: string;
  description: string;
  amount: number;
}

type Costability = "costed" | "unlinked" | "uncosted";

interface PackingState {
  order: {
    id: string;
    shopifyOrderId: string;
    orderName: string | null;
    totalPrice: number | null;
    customerPaidShipping: number | null;
    lineItems: OrderLineItem[];
  };
  library: LibraryComponent[];
  packing: PackingLine[];
  customCosts: CustomCost[];
  suggestion: PackingLine[];
  costability: Costability;
  cogs: { total: number; margin: number | null };
}

// A working (possibly unsaved) line in the local editor. Mirrors PackingLine
// but doesn't require a real `order_components` row id yet.
interface WorkingLine {
  componentId: string;
  name: string;
  unit: string;
  costPerUnit: number;
  quantity: number;
}

const COMPONENT_TYPES = ["packaging", "ingredient", "labor", "other"] as const;
type ComponentType = (typeof COMPONENT_TYPES)[number];

// ---------------------------------------------------------------------------
// Networking
// ---------------------------------------------------------------------------

const API_BASE = "https://coffeeos.io/api/shopify/block";

/**
 * ASSUMPTION TO VERIFY ON A DEV STORE: admin UI extensions are documented to
 * attach a verified Shopify session token to `fetch` calls made to the app's
 * own domain (the domain configured as `application_url` in
 * shopify.app.toml, here coffeeos.io) automatically — no manual header
 * wiring needed. That's why this is a plain `fetch` and not something
 * pulled off the extension API object.
 *
 * lib/shopify-block/auth.ts requires a bearer token and 401s without one
 * ("Missing bearer token"). If requests come back 401 on a real dev store,
 * that assumption was wrong for the installed @shopify/ui-extensions-react
 * version (2024.10.2, pinned in package.json next to this file) — switch to
 * whatever authenticated-fetch mechanism that version's admin API object
 * exposes (check its type defs; historically this has been surfaced off the
 * object `useApi(TARGET)` returns) instead of raw `fetch`.
 */
async function blockFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });

  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // no body — fall through, `res.ok` still gates below
  }

  if (!res.ok) {
    const err = new BlockFetchError(
      (body as { error?: string } | null)?.error || `Request failed (${res.status})`,
      res.status,
      body
    );
    throw err;
  }

  return body as T;
}

class BlockFetchError extends Error {
  status: number;
  body: unknown;
  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

function getPackingState(shopifyOrderId: string) {
  return blockFetch<{ state: PackingState }>(
    `/packing-state?shopify_order_id=${encodeURIComponent(shopifyOrderId)}`
  );
}

function postPacking(shopifyOrderId: string, lines: WorkingLine[]) {
  return blockFetch<{ state: PackingState }>(`/packing`, {
    method: "POST",
    body: JSON.stringify({
      shopifyOrderId,
      lines: lines.map((l) => ({ componentId: l.componentId, quantity: l.quantity })),
    }),
  });
}

function postComponent(input: {
  name: string;
  type: ComponentType;
  unit: string;
  costPerUnit: number;
  shopifyOrderId: string;
}) {
  return blockFetch<{ component: LibraryComponent; state: PackingState }>(`/component`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

function postShippingCost(shopifyOrderId: string, amount: number) {
  return blockFetch<{ state: PackingState }>(`/shipping-cost`, {
    method: "POST",
    body: JSON.stringify({ shopifyOrderId, amount }),
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** `gid://shopify/Order/123456` -> `123456`. Returns null for anything that
 * doesn't end in a numeric id (including an absent/empty gid). */
function numericIdFromGid(gid: string | undefined | null): string | null {
  if (!gid) return null;
  const last = gid.split("/").pop();
  return last && /^\d+$/.test(last) ? last : null;
}

function toWorkingLine(l: PackingLine): WorkingLine {
  return { componentId: l.componentId, name: l.name, unit: l.unit, costPerUnit: l.costPerUnit, quantity: l.quantity };
}

function money(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return `$${n.toFixed(2)}`;
}

function costabilityReason(costability: Costability): string {
  switch (costability) {
    case "unlinked":
      return "Margin unavailable — items on this order aren't linked to products yet.";
    case "uncosted":
      return "Margin unavailable — the linked products are missing cost data.";
    default:
      return "Margin unavailable.";
  }
}

// Best-effort read of "what I paid for shipping" out of the generic
// customCosts bucket (order_custom_costs has no dedicated shipping field in
// the PackingState contract — the /shipping-cost route presumably records it
// as a custom cost line). Purely for pre-filling the input; never used for
// any total math.
function findShippingCustomCost(customCosts: CustomCost[]): CustomCost | undefined {
  return customCosts.find((c) => /shipping/i.test(c.description));
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

function App() {
  const { data } = useApi(TARGET);
  // `data.selected[0].id` is documented for admin.order-details targets as
  // the gid of the order currently being viewed.
  const orderGid = (data as { selected?: { id?: string }[] } | undefined)?.selected?.[0]?.id;
  const shopifyOrderId = numericIdFromGid(orderGid);

  if (!shopifyOrderId) {
    return (
      <AdminBlock title="Order packing">
        <Text>No order in context.</Text>
      </AdminBlock>
    );
  }

  return <PackingBlock shopifyOrderId={shopifyOrderId} />;
}

function PackingBlock({ shopifyOrderId }: { shopifyOrderId: string }) {
  const [state, setState] = useState<PackingState | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [lines, setLines] = useState<WorkingLine[]>([]);
  const [fromSuggestion, setFromSuggestion] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [savingPacking, setSavingPacking] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [addSelection, setAddSelection] = useState<string>("");

  const [showNewComponent, setShowNewComponent] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<ComponentType>("packaging");
  const [newUnit, setNewUnit] = useState("");
  const [newCost, setNewCost] = useState<number | undefined>(undefined);
  const [newComponentError, setNewComponentError] = useState<string | null>(null);
  const [creatingComponent, setCreatingComponent] = useState(false);

  const [shippingPaid, setShippingPaid] = useState<number | undefined>(undefined);
  const [shippingSaving, setShippingSaving] = useState(false);
  const [shippingError, setShippingError] = useState<string | null>(null);

  const applyServerState = useCallback((next: PackingState) => {
    setState(next);
    const existingShipping = findShippingCustomCost(next.customCosts);
    if (existingShipping) setShippingPaid(existingShipping.amount);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { state: fetched } = await getPackingState(shopifyOrderId);
      applyServerState(fetched);
      if (fetched.packing.length > 0) {
        setLines(fetched.packing.map(toWorkingLine));
        setFromSuggestion(false);
      } else {
        setLines(fetched.suggestion.map(toWorkingLine));
        setFromSuggestion(fetched.suggestion.length > 0);
      }
      setDirty(false);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Something went sideways");
    } finally {
      setLoading(false);
    }
  }, [shopifyOrderId, applyServerState]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopifyOrderId]);

  const libraryNotInLines = useMemo(() => {
    if (!state) return [];
    const usedIds = new Set(lines.map((l) => l.componentId));
    return state.library.filter((c) => !usedIds.has(c.id));
  }, [state, lines]);

  function updateQuantity(componentId: string, quantity: number) {
    setDirty(true);
    if (quantity <= 0) {
      setLines((prev) => prev.filter((l) => l.componentId !== componentId));
      return;
    }
    setLines((prev) =>
      prev.map((l) => (l.componentId === componentId ? { ...l, quantity } : l))
    );
  }

  function removeLine(componentId: string) {
    setDirty(true);
    setLines((prev) => prev.filter((l) => l.componentId !== componentId));
  }

  function addFromLibrary(componentId: string) {
    if (!state || !componentId) return;
    const comp = state.library.find((c) => c.id === componentId);
    if (!comp) return;
    setDirty(true);
    setLines((prev) => [
      ...prev,
      { componentId: comp.id, name: comp.name, unit: comp.unit, costPerUnit: comp.costPerUnit, quantity: 1 },
    ]);
    setAddSelection("");
  }

  async function handleSavePacking() {
    setSavingPacking(true);
    setSaveError(null);
    try {
      const { state: next } = await postPacking(shopifyOrderId, lines);
      applyServerState(next);
      setLines(next.packing.map(toWorkingLine));
      setFromSuggestion(false);
      setDirty(false);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Something went sideways");
    } finally {
      setSavingPacking(false);
    }
  }

  async function handleCreateComponent() {
    setNewComponentError(null);
    if (!newName.trim() || !newUnit.trim() || newCost === undefined) {
      setNewComponentError("Name, unit, and cost are required.");
      return;
    }
    setCreatingComponent(true);
    try {
      const { component, state: next } = await postComponent({
        name: newName.trim(),
        type: newType,
        unit: newUnit.trim(),
        costPerUnit: newCost,
        shopifyOrderId,
      });
      // Refresh server-truth state (library now includes the new component)
      // WITHOUT touching the local working `lines` from `next.packing` —
      // creating a component must never save the packing list.
      applyServerState(next);
      setDirty(true);
      setLines((prev) => [
        ...prev,
        { componentId: component.id, name: component.name, unit: component.unit, costPerUnit: component.costPerUnit, quantity: 1 },
      ]);
      setShowNewComponent(false);
      setNewName("");
      setNewUnit("");
      setNewCost(undefined);
      setNewType("packaging");
    } catch (e) {
      if (e instanceof BlockFetchError && e.status === 409) {
        setNewComponentError(e.message);
      } else {
        setNewComponentError(e instanceof Error ? e.message : "Something went sideways");
      }
    } finally {
      setCreatingComponent(false);
    }
  }

  async function handleSaveShipping() {
    if (shippingPaid === undefined) return;
    setShippingSaving(true);
    setShippingError(null);
    try {
      const { state: next } = await postShippingCost(shopifyOrderId, shippingPaid);
      applyServerState(next);
    } catch (e) {
      setShippingError(e instanceof Error ? e.message : "Something went sideways");
    } finally {
      setShippingSaving(false);
    }
  }

  if (loading) {
    return (
      <AdminBlock title="Order packing">
        <InlineStack gap="tight" blockAlignment="center">
          <ProgressIndicator size="small-100" />
          <Text>Brewing...</Text>
        </InlineStack>
      </AdminBlock>
    );
  }

  if (loadError || !state) {
    return (
      <AdminBlock title="Order packing">
        <BlockStack gap="base">
          <Banner tone="critical" title="Something went sideways">
            <Text>{loadError || "Could not load packing state."}</Text>
          </Banner>
          <Button onPress={load}>Retry</Button>
        </BlockStack>
      </AdminBlock>
    );
  }

  const margin = state.cogs.margin;

  return (
    <AdminBlock title="Order packing">
      <BlockStack gap="base">
        {fromSuggestion && lines.length > 0 && (
          <Banner tone="info" title="Suggested from a recent similar order">
            <Text>
              These lines are pre-filled from a similar recent order and have not been
              recorded yet. Save packing to make them official.
            </Text>
          </Banner>
        )}

        {lines.length === 0 && (
          <Text tone="subdued">Nothing packed yet. Add a material below.</Text>
        )}

        {lines.map((line) => (
          <InlineStack key={line.componentId} gap="base" blockAlignment="center">
            <Text>{line.name}</Text>
            <Text tone="subdued">
              {money(line.costPerUnit)}/{line.unit}
            </Text>
            <NumberField
              label="Quantity"
              labelHidden
              value={line.quantity}
              min={0}
              onChange={(value: number) => updateQuantity(line.componentId, value)}
            />
            <Button variant="tertiary" tone="critical" onPress={() => removeLine(line.componentId)}>
              Remove
            </Button>
          </InlineStack>
        ))}

        <Divider />

        <InlineStack gap="base" blockAlignment="center">
          <Select
            label="Add material"
            value={addSelection}
            onChange={(value: string) => addFromLibrary(value)}
            options={[
              { value: "", label: "Choose a material…" },
              ...libraryNotInLines.map((c) => ({
                value: c.id,
                label: `${c.name} (${money(c.costPerUnit)}/${c.unit})`,
              })),
            ]}
          />
          <Button variant="secondary" onPress={() => setShowNewComponent((v) => !v)}>
            {showNewComponent ? "Cancel new material" : "New material"}
          </Button>
        </InlineStack>

        {showNewComponent && (
          <BlockStack gap="tight">
            {newComponentError && (
              <Banner tone="critical" title="Couldn't create material">
                <Text>{newComponentError}</Text>
              </Banner>
            )}
            <TextField label="Name" value={newName} onChange={(v: string) => setNewName(v)} />
            <Select
              label="Type"
              value={newType}
              onChange={(v: string) => setNewType(v as ComponentType)}
              options={COMPONENT_TYPES.map((t) => ({ value: t, label: t }))}
            />
            <TextField label="Unit" value={newUnit} onChange={(v: string) => setNewUnit(v)} />
            <NumberField
              label="Cost per unit"
              value={newCost}
              min={0}
              onChange={(v: number) => setNewCost(v)}
            />
            <Button variant="primary" onPress={handleCreateComponent} disabled={creatingComponent}>
              {creatingComponent ? "Creating…" : "Create material"}
            </Button>
          </BlockStack>
        )}

        <Divider />

        <Button variant="primary" onPress={handleSavePacking} disabled={savingPacking}>
          {savingPacking ? "Saving…" : "Save packing"}
        </Button>
        {saveError && (
          <Banner tone="critical" title="Couldn't save packing">
            <Text>{saveError}</Text>
          </Banner>
        )}

        <Divider />

        <BlockStack gap="tight">
          <Text fontWeight="bold">Shipping</Text>
          <InlineStack gap="base" blockAlignment="center">
            <NumberField
              label="What you paid for shipping"
              value={shippingPaid}
              min={0}
              onChange={(v: number) => setShippingPaid(v)}
            />
            <Button variant="secondary" onPress={handleSaveShipping} disabled={shippingSaving || shippingPaid === undefined}>
              {shippingSaving ? "Saving…" : "Save"}
            </Button>
          </InlineStack>
          {shippingError && (
            <Banner tone="critical" title="Couldn't save shipping cost">
              <Text>{shippingError}</Text>
            </Banner>
          )}
          {state.order.customerPaidShipping !== null && (
            <Text tone="subdued">
              Customer paid {money(state.order.customerPaidShipping)} (revenue, not your cost)
            </Text>
          )}
        </BlockStack>

        <Divider />

        <BlockStack gap="tight">
          <InlineStack gap="base" blockAlignment="center">
            <Text fontWeight="bold">COGS {money(state.cogs.total)}</Text>
            {margin !== null ? (
              <Badge tone={margin >= 0 ? "success" : "critical"}>
                {`${margin.toFixed(1)}% margin`}
              </Badge>
            ) : (
              <Text tone="subdued">{costabilityReason(state.costability)}</Text>
            )}
          </InlineStack>
          {dirty && <Text tone="subdued">Save to update totals</Text>}
        </BlockStack>
      </BlockStack>
    </AdminBlock>
  );
}

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
 * TYPE-CHECKED: this file compiles against the real installed
 * @shopify/ui-extensions-react 2024.10.2 types (`cd extensions/order-packing
 * && pnpm exec tsc --noEmit`, zero errors). All component names (AdminBlock,
 * BlockStack, InlineStack, Text, Button, TextField, NumberField, Select,
 * Divider, Badge, Banner, ProgressIndicator) are confirmed correct. Prop
 * usage was corrected against the real types in the process: `gap` only
 * accepts `'none' | 'small' | 'base' | 'large'` (no `'tight'`), `Text` has no
 * `tone` prop (only Badge/Banner/Button/Icon/Link/ProgressIndicator do), and
 * `NumberField` has no `labelHidden`. What remains UNVERIFIED is behavior
 * that can only be seen by actually rendering in Shopify admin (layout,
 * `size="small-100"` on ProgressIndicator, real API responses) — a green
 * `tsc` run proves the file compiles, not that it looks or behaves right on
 * a dev store. See the must-verify list in the PR/commit notes.
 *
 * AUTH: admin UI extensions run in a sandboxed iframe separate from the
 * embedded app frame — there is no ambient App Bridge session for `fetch` to
 * piggyback on, so an unauthenticated `fetch` to the app's own domain does
 * NOT get an `Authorization` header attached automatically. The extension
 * calls `auth.idToken()` — off the `auth` object `useApi(TARGET)` returns —
 * before every request and sets `Authorization: Bearer <token>` itself;
 * `lib/shopify-block/auth.ts` 401s without exactly that header. `idToken()`
 * returns `Promise<string | null>` — a null token is a real, handled case
 * (see `requireToken` below), not sent as `Authorization: Bearer null`.
 * Tokens are short-lived (~60s), so a fresh one is fetched per request
 * rather than cached at mount — `blockFetch` below takes the token as a
 * parameter for that reason, and there is deliberately no refresh-on-401
 * retry loop (fetching per-request already avoids stale tokens).
 *
 * `auth.idToken()` is verified against the installed @shopify/ui-extensions-
 * react 2024.10.2 type defs (`pnpm exec tsc --noEmit` in this directory) —
 * this is no longer a guess.
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
 * The caller MUST pass a freshly-fetched Shopify ID token (see `requireToken`
 * below).
 *
 * Admin UI extensions run in their own sandboxed iframe and do NOT get a
 * session token attached automatically — unlike App Bridge's authenticatedFetch
 * in the main embedded-app frame. The token has to be pulled off the extension
 * API object (`auth.idToken()` from `useApi(TARGET)`) and set as a header
 * here. An earlier revision of this file assumed the opposite and sent no
 * Authorization header at all, which meant every request 401'd:
 * lib/shopify-block/auth.ts rejects a missing bearer token outright
 * ("Missing bearer token"). Do not "simplify" this back to a bare `fetch`.
 *
 * Tokens are short-lived (~60s), so each call site fetches a fresh one
 * immediately before its request rather than caching one at mount.
 */
async function blockFetch<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
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

function getPackingState(token: string, shopifyOrderId: string) {
  return blockFetch<{ state: PackingState }>(
    `/packing-state?shopify_order_id=${encodeURIComponent(shopifyOrderId)}`,
    token
  );
}

function postPacking(token: string, shopifyOrderId: string, lines: WorkingLine[]) {
  return blockFetch<{ state: PackingState }>(`/packing`, token, {
    method: "POST",
    body: JSON.stringify({
      shopifyOrderId,
      lines: lines.map((l) => ({ componentId: l.componentId, quantity: l.quantity })),
    }),
  });
}

function postComponent(
  token: string,
  input: {
    name: string;
    type: ComponentType;
    unit: string;
    costPerUnit: number;
    shopifyOrderId: string;
  }
) {
  return blockFetch<{ component: LibraryComponent; state: PackingState | null }>(
    `/component`,
    token,
    {
      method: "POST",
      body: JSON.stringify(input),
    }
  );
}

function postShippingCost(token: string, shopifyOrderId: string, amount: number) {
  return blockFetch<{ state: PackingState }>(`/shipping-cost`, token, {
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

// Read "what I paid for shipping" out of the generic customCosts bucket
// (order_custom_costs has no dedicated shipping field in the PackingState
// contract). MUST mirror the predicate app/api/shopify/block/shipping-cost/
// route.ts's `upsert_order_shipping_cost` RPC uses to find the row it
// updates — `lower(description) = 'shipping'`, an exact case-insensitive
// match enforced by the partial unique index `order_custom_costs_shipping_
// unique` in scripts/026_packing_uniqueness.sql (`WHERE lower(description) =
// 'shipping'`) — EXACTLY (no wildcards, no substring match). A looser match
// here (e.g. a substring test) can pick up an unrelated custom cost like
// "Shipping insurance", pre-fill its amount into this field, and get it
// saved back under a DIFFERENT description. The RPC would then find no
// existing row matching its own predicate and INSERT a second "Shipping"
// row — order_custom_costs sums additively, so that silently double-counts
// a cost that was never shipping. Purely for pre-filling the input; never
// used for any total math.
function findShippingCustomCost(customCosts: CustomCost[]): CustomCost | undefined {
  return customCosts.find((c) => c.description.toLowerCase() === "shipping");
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

// The real `auth` type off the installed @shopify/ui-extensions-react types
// for this target, extracted (not asserted) via the hook's own return type —
// avoids hand-rolling an interface or importing the (unexported) `Auth` type
// by name.
type AdminAuth = ReturnType<typeof useApi<typeof TARGET>>["auth"];

function App() {
  const { data, auth } = useApi(TARGET);
  // `data.selected[0].id` is documented for admin.order-details targets as
  // the gid of the order currently being viewed. `selected` is typed as
  // always present, but `[0]` is still guarded — an empty array at runtime
  // (no order selected) is a real possibility the type doesn't rule out.
  const orderGid = data.selected[0]?.id;
  const shopifyOrderId = numericIdFromGid(orderGid);

  if (!shopifyOrderId) {
    return (
      <AdminBlock title="Order packing">
        <Text>No order in context.</Text>
      </AdminBlock>
    );
  }

  return <PackingBlock shopifyOrderId={shopifyOrderId} auth={auth} />;
}

function PackingBlock({
  shopifyOrderId,
  auth,
}: {
  shopifyOrderId: string;
  auth: AdminAuth;
}) {
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
  const [duplicateComponentId, setDuplicateComponentId] = useState<string | null>(null);
  const [creatingComponent, setCreatingComponent] = useState(false);

  const [shippingPaid, setShippingPaid] = useState<number | undefined>(undefined);
  const [shippingSaving, setShippingSaving] = useState(false);
  const [shippingError, setShippingError] = useState<string | null>(null);

  const applyServerState = useCallback((next: PackingState) => {
    setState(next);
    const existingShipping = findShippingCustomCost(next.customCosts);
    if (existingShipping) setShippingPaid(existingShipping.amount);
  }, []);

  // `auth.idToken()` returns `Promise<string | null>` — null is a real,
  // documented possibility (not just a formality), so every call site routes
  // through this instead of sending `Authorization: Bearer null` and letting
  // the server's 401 stand in for the actual problem.
  const requireToken = useCallback(async (): Promise<string> => {
    const token = await auth.idToken();
    if (!token) {
      throw new Error("Could not verify your Shopify session — try reloading the page.");
    }
    return token;
  }, [auth]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const token = await requireToken();
      const { state: fetched } = await getPackingState(token, shopifyOrderId);
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
  }, [shopifyOrderId, requireToken, applyServerState]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopifyOrderId]);

  const libraryNotInLines = useMemo(() => {
    if (!state) return [];
    const usedIds = new Set(lines.map((l) => l.componentId));
    return state.library.filter((c) => !usedIds.has(c.id));
  }, [state, lines]);

  // Real production orders carry more than one shipping-flavored custom
  // cost under different names — e.g. "Mernin Shipping" $6.00 AND "Suurup
  // Shipping" $6.07 on the same order — which findShippingCustomCost's
  // exact `lower(description) === "shipping"` match (by design) does not
  // touch. Surface those here as read-only context so the operator isn't
  // shown an empty field as if nothing were recorded, without touching the
  // exact-match matcher itself (loosening that back to a substring match
  // reintroduces the "Shipping insurance" false-positive it was written to
  // prevent). These are display-only: never summed into any total shown by
  // this block, and never editable here — there is no route to edit an
  // arbitrary custom cost, only to upsert the one named exactly "Shipping".
  const unrecognizedShippingCosts = useMemo(() => {
    if (!state) return [];
    return state.customCosts.filter((c) => {
      const lower = c.description.toLowerCase();
      return lower.includes("shipping") && lower !== "shipping";
    });
  }, [state]);

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
      const token = await requireToken();
      const { state: next } = await postPacking(token, shopifyOrderId, lines);
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

  // Adds an already-existing library component to the packing list (no-op if
  // it's already a line). Shared by the "Add material" select and the 409
  // duplicate-name recovery path below.
  function useExistingComponent(componentId: string) {
    if (!lines.some((l) => l.componentId === componentId)) {
      addFromLibrary(componentId);
    }
    setShowNewComponent(false);
    setNewComponentError(null);
    setDuplicateComponentId(null);
    setNewName("");
    setNewUnit("");
    setNewCost(undefined);
    setNewType("packaging");
  }

  async function handleCreateComponent() {
    setNewComponentError(null);
    setDuplicateComponentId(null);
    if (!newName.trim() || !newUnit.trim() || newCost === undefined) {
      setNewComponentError("Name, unit, and cost are required.");
      return;
    }
    setCreatingComponent(true);
    try {
      const token = await requireToken();
      const { component, state: next } = await postComponent(token, {
        name: newName.trim(),
        type: newType,
        unit: newUnit.trim(),
        costPerUnit: newCost,
        shopifyOrderId,
      });
      // The route returns `state: null` when it wasn't given a
      // shopifyOrderId (a shared route used elsewhere without one). This
      // block always sends one, but guard anyway rather than assume.
      if (next) {
        // Refresh server-truth state (library now includes the new
        // component) WITHOUT touching the local working `lines` from
        // `next.packing` — creating a component must never save the
        // packing list.
        applyServerState(next);
      }
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
        const body = e.body as { existingComponentId?: string } | null;
        setDuplicateComponentId(body?.existingComponentId ?? null);
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
      const token = await requireToken();
      const { state: next } = await postShippingCost(token, shopifyOrderId, shippingPaid);
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
        <InlineStack gap="small" blockAlignment="center">
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
          <Text>Nothing packed yet. Add a material below.</Text>
        )}

        {lines.map((line) => (
          <InlineStack key={line.componentId} gap="base" blockAlignment="center">
            <Text>{line.name}</Text>
            <Text>
              {money(line.costPerUnit)}/{line.unit}
            </Text>
            <NumberField
              label="Quantity"
              value={line.quantity}
              min={0}
              disabled={savingPacking}
              onChange={(value: number) => updateQuantity(line.componentId, value)}
            />
            <Button
              variant="tertiary"
              tone="critical"
              disabled={savingPacking}
              onPress={() => removeLine(line.componentId)}
            >
              Remove
            </Button>
          </InlineStack>
        ))}

        <Divider />

        {/* Locked while a packing save is in flight — `handleSavePacking`
            closes over `lines` at call time, so an edit made mid-request
            would be silently dropped (never sent, then overwritten when the
            response applies server state) if these stayed live. */}
        <InlineStack gap="base" blockAlignment="center">
          <Select
            label="Add material"
            value={addSelection}
            disabled={savingPacking}
            onChange={(value: string) => addFromLibrary(value)}
            options={[
              { value: "", label: "Choose a material…" },
              ...libraryNotInLines.map((c) => ({
                value: c.id,
                label: `${c.name} (${money(c.costPerUnit)}/${c.unit})`,
              })),
            ]}
          />
          <Button
            variant="secondary"
            disabled={savingPacking}
            onPress={() => setShowNewComponent((v) => !v)}
          >
            {showNewComponent ? "Cancel new material" : "New material"}
          </Button>
        </InlineStack>

        {showNewComponent && (
          <BlockStack gap="small">
            {newComponentError && (
              <Banner tone="critical" title="Couldn't create material">
                <BlockStack gap="small">
                  <Text>{newComponentError}</Text>
                  {duplicateComponentId && (
                    <Button
                      variant="tertiary"
                      disabled={savingPacking}
                      onPress={() => useExistingComponent(duplicateComponentId)}
                    >
                      Add existing material to packing list instead
                    </Button>
                  )}
                </BlockStack>
              </Banner>
            )}
            <TextField
              label="Name"
              value={newName}
              disabled={savingPacking}
              onChange={(v: string) => setNewName(v)}
            />
            <Select
              label="Type"
              value={newType}
              disabled={savingPacking}
              onChange={(v: string) => setNewType(v as ComponentType)}
              options={COMPONENT_TYPES.map((t) => ({ value: t, label: t }))}
            />
            <TextField
              label="Unit"
              value={newUnit}
              disabled={savingPacking}
              onChange={(v: string) => setNewUnit(v)}
            />
            <NumberField
              label="Cost per unit"
              value={newCost}
              min={0}
              disabled={savingPacking}
              onChange={(v: number) => setNewCost(v)}
            />
            <Button
              variant="primary"
              onPress={handleCreateComponent}
              disabled={creatingComponent || savingPacking}
            >
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

        <BlockStack gap="small">
          <Text fontWeight="bold">Shipping</Text>

          {unrecognizedShippingCosts.length > 0 && (
            <BlockStack gap="small">
              <Banner tone="warning" title="This order already has other shipping costs">
                <Text>
                  They're already counted in this order's COGS. Saving the field below adds a
                  new, separate "Shipping" cost — it won't update or replace these.
                </Text>
              </Banner>
              <Text fontWeight="bold">Already on this order (view only):</Text>
              {unrecognizedShippingCosts.map((c) => (
                <InlineStack key={c.id} gap="base" blockAlignment="center">
                  <Text>{c.description}:</Text>
                  <Text>{money(c.amount)}</Text>
                </InlineStack>
              ))}
            </BlockStack>
          )}

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
            <Text>
              Customer paid {money(state.order.customerPaidShipping)} (revenue, not your cost)
            </Text>
          )}
        </BlockStack>

        <Divider />

        <BlockStack gap="small">
          <InlineStack gap="base" blockAlignment="center">
            <Text fontWeight="bold">COGS {money(state.cogs.total)}</Text>
            {margin !== null ? (
              <Badge tone={margin >= 0 ? "success" : "critical"}>
                {`${margin.toFixed(1)}% margin`}
              </Badge>
            ) : (
              <Text>{costabilityReason(state.costability)}</Text>
            )}
          </InlineStack>
          {dirty && <Text>Save to update totals</Text>}
        </BlockStack>
      </BlockStack>
    </AdminBlock>
  );
}

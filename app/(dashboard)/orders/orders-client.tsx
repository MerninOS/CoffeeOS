"use client";

import React from "react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Search, ShoppingCart, Settings } from "lucide-react";
import Link from "next/link";
import {
  Button,
  EmptyState,
  HeroMetric,
  InlineBanner,
  Input,
  SegmentedControl,
  StatStrip,
  type Stat,
} from "@merninos/ui/instrument";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  syncShopifyOrders,
  addOrderComponent,
  updateOrderComponentQuantity,
  removeOrderComponent,
  addOrderCustomCost,
  removeOrderCustomCost,
  createRoastRequestForOrder,
} from "./actions";
import {
  getLineItemCogs as cogsLineItem,
  getOrderComponentsCogs as cogsOrderComponents,
  getOrderCustomCostsTotal as cogsCustomCosts,
  getTotalAdditionalCosts as cogsAdditional,
  getOrderCogs as cogsOrder,
  classifyOrder,
  type ProductLookup,
} from "@/lib/orders/cogs";
import { type PeriodValue } from "@/lib/orders/constants";
import { OrdersWorksheetTable } from "./components/OrdersWorksheetTable";
import { PeriodControl } from "./components/PeriodControl";
import { mono, overline, sans, money } from "./components/tokens";
import type {
  Order,
  OrderLineItem,
  ComponentData,
  CoffeeInventory,
} from "./components/types";

/**
 * /orders on the instrument design system — a MARGIN WORKBENCH.
 *
 * The page's job is making COGS complete: margin is only trustworthy when it is,
 * so incompleteness is the loudest thing on the screen. That is exactly what
 * brand red means in this system ("happening now / needs you"), which is why the
 * only red here is the missing-COGS banner, the `not set` figures and the
 * margins those figures poison. Red is never a button fill — primary actions are
 * ink (`--action`).
 *
 * Design-system rule: instrument values are read as `var(--token)` through
 * inline styles, never through Tailwind classes. The Tailwind theme in this repo
 * is the LOUD Mernin' palette — its colour, border, shadow and type utilities all
 * resolve to the other design system, and would silently render it inside the
 * instrument shell. Tailwind appears below only for layout that needs a
 * breakpoint.
 */

// ── Types ───────────────────────────────────────────────────────────────────
//
// The row/entity shapes live in ./components/types so the extracted components
// can share them without importing from their own parent.

interface OrdersClientProps {
  initialOrders: Order[];
  products: ProductLookup;
  allComponents: ComponentData[];
  coffeeInventory: CoffeeInventory[];
  isAdminConfigured: boolean;
  /** Active window. The list below is only the orders inside it. */
  period: PeriodValue;
  /**
   * Aggregates over the WHOLE period, computed server-side. Not derived from
   * `initialOrders` — that array is one page, and summing it would under-report
   * as soon as a period exceeds the page limit.
   */
  totals: {
    /** COSTED orders only — the subset whose margin is knowable. */
    revenue: number;
    cogs: number;
    profit: number;
    margin: number;
    /**
     * EVERY order in the period, costed or not. The honest denominator, and the
     * only figure any copy naming the period may use.
     *
     * It is also what Criterion 5 must probe. `revenue` above covers a subset by
     * design, so "the aggregate exceeds the visible page" is no longer true of
     * it — and a test left pointing at it would fail for the right reason while
     * looking like a regression.
     */
    totalRevenue: number;
    excludedUnlinked: number;
    excludedUncosted: number;
  };
  /**
   * How many orders the period actually holds. `initialOrders` is one page of
   * at most ORDERS_PAGE_LIMIT, so it is NOT a period count and must never be
   * rendered as one — see the footer and the missing-COGS banner below.
   */
  rangeCount: number;
}

/** The costed/uncosted filter. Not a period — this one is purely a view of the
 *  page already fetched, so it stays client-side. */
type CogsFilter = "all" | "excluded" | "costed";

const COGS_FILTERS = [
  { value: "all", label: "All" },
  { value: "excluded", label: "Excluded" },
  { value: "costed", label: "Costed" },
];

/** The page title. `--fs-display` on the display axis is the system's one
 *  screen-title role. */
const title: React.CSSProperties = {
  fontFamily: "var(--font-display)",
  fontVariationSettings: "var(--display-settings)",
  fontWeight: "var(--display-weight)" as unknown as number,
  letterSpacing: "var(--display-tracking)",
  fontSize: "var(--fs-display)",
  textTransform: "uppercase",
  color: "var(--ink)",
  margin: 0,
};

/** Radix dialog surface, retokenized. See the note at the dialog itself for why
 *  `data-surface` has to be set on it. */
const DIALOG_LABEL: React.CSSProperties = {
  ...overline,
  display: "block",
  marginBottom: 4,
};

const DIALOG_SELECT: React.CSSProperties = {
  ...sans,
  width: "100%",
  height: 36,
  background: "var(--surface)",
  border: "1px solid var(--hairline-strong)",
  borderRadius: "var(--r-sm)",
  color: "var(--ink)",
  boxShadow: "none",
};

// ── Main component ──────────────────────────────────────────────────────────

export function OrdersClient({
  initialOrders,
  products,
  allComponents,
  coffeeInventory,
  isAdminConfigured,
  period,
  totals,
  rangeCount,
}: OrdersClientProps) {
  const router = useRouter();
  const [orders, setOrders] = useState(initialOrders);
  const [searchQuery, setSearchQuery] = useState("");
  const [cogsFilter, setCogsFilter] = useState<CogsFilter>("all");
  const [isSyncing, setIsSyncing] = useState(false);
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [addingComponentTo, setAddingComponentTo] = useState<string | null>(null);
  const [selectedComponentId, setSelectedComponentId] = useState<string>("");
  const [componentQuantity, setComponentQuantity] = useState<number>(1);
  const [addingCustomCostTo, setAddingCustomCostTo] = useState<string | null>(null);
  const [customCostDescription, setCustomCostDescription] = useState<string>("");
  const [customCostAmount, setCustomCostAmount] = useState<string>("");
  const [roastRequestOrder, setRoastRequestOrder] = useState<Order | null>(null);
  const [roastRequestData, setRoastRequestData] = useState({
    greenCoffeeId: "",
    quantityG: "",
    priority: "normal" as "low" | "normal" | "high" | "urgent",
    dueDate: "",
  });
  const [isCreatingRoastRequest, setIsCreatingRoastRequest] = useState(false);

  useEffect(() => {
    setOrders(initialOrders);
  }, [initialOrders]);

  const filteredOrders = orders
    .filter(
      (order) =>
        order.order_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.order_line_items.some((item) =>
          item.title.toLowerCase().includes(searchQuery.toLowerCase())
        )
    )
    .filter((order) => {
      if (cogsFilter === "all") return true;
      const excluded = classifyOrder(order, products).status !== "costed";
      return cogsFilter === "excluded" ? excluded : !excluded;
    });

  /**
   * PAGE vs PERIOD.
   *
   * `orders` is one page, capped at ORDERS_PAGE_LIMIT; `rangeCount` and the
   * exclusion counts inside `totals` cover the whole period. Every sentence below that names
   * the period has to read the second pair, and every control that acts on the
   * list has to read the first — mixing them is how "100 of 100 orders shown ·
   * last 30 days" ends up asserting a period figure it cannot support, and how a
   * banner counting 37 uncosted orders ends up with an action that reveals none
   * of them (the list is newest-first and an uncosted backlog skews old).
   */
  const pageCoversRange = orders.length >= rangeCount;

  /** Excluded orders reachable by the client-side filter — the page, not the
   *  period. This is what the banner's action can actually produce. */
  const excludedTotal = totals.excludedUnlinked + totals.excludedUncosted;
  const excludedOnPage = orders.filter(
    (order) => classifyOrder(order, products).status !== "costed"
  ).length;
  const excludedOffPage = excludedTotal - excludedOnPage;

  const handleSync = async () => {
    setIsSyncing(true);
    const result = await syncShopifyOrders();
    setIsSyncing(false);
    if (result.error) { alert(result.error); return; }
    if (result.success) router.refresh();
  };

  const toggleOrderExpanded = (orderId: string) => {
    const next = new Set(expandedOrders);
    next.has(orderId) ? next.delete(orderId) : next.add(orderId);
    setExpandedOrders(next);
  };

  // The costing math lives in @/lib/orders/cogs so the per-row figures and the
  // server-side range aggregate cannot drift apart. These adapters only bind
  // `products`, which the module takes explicitly instead of closing over.
  const getLineItemCogs = (item: OrderLineItem) => cogsLineItem(item, products);
  const getOrderComponentsCogs = (order: Order) => cogsOrderComponents(order);
  const getOrderCustomCostsTotal = (order: Order) => cogsCustomCosts(order);
  const getTotalAdditionalCosts = (order: Order) => cogsAdditional(order);
  const getOrderCogs = (order: Order) => cogsOrder(order, products);

  const handleAddComponent = async (orderId: string) => {
    if (!selectedComponentId || componentQuantity <= 0) return;
    const result = await addOrderComponent(orderId, selectedComponentId, componentQuantity);
    if (result.error) { alert(result.error); } else {
      setAddingComponentTo(null);
      setSelectedComponentId("");
      setComponentQuantity(1);
      router.refresh();
    }
  };
  const handleUpdateQuantity = async (orderComponentId: string, newQuantity: number) => {
    const result = await updateOrderComponentQuantity(orderComponentId, newQuantity);
    if (result.error) alert(result.error); else router.refresh();
  };
  const handleRemoveComponent = async (orderComponentId: string) => {
    const result = await removeOrderComponent(orderComponentId);
    if (result.error) alert(result.error); else router.refresh();
  };
  const handleAddCustomCost = async (orderId: string) => {
    const amount = parseFloat(customCostAmount);
    if (!customCostDescription.trim() || isNaN(amount) || amount <= 0) return;
    const result = await addOrderCustomCost(orderId, customCostDescription, amount);
    if (result.error) { alert(result.error); } else {
      setAddingCustomCostTo(null);
      setCustomCostDescription("");
      setCustomCostAmount("");
      router.refresh();
    }
  };
  const handleRemoveCustomCost = async (customCostId: string) => {
    const result = await removeOrderCustomCost(customCostId);
    if (result.error) alert(result.error); else router.refresh();
  };

  const handleCreateRoastRequest = async () => {
    if (!roastRequestOrder || !roastRequestData.greenCoffeeId || !roastRequestData.quantityG) return;
    const selectedCoffee = coffeeInventory.find((c) => c.id === roastRequestData.greenCoffeeId);
    if (!selectedCoffee) return;
    setIsCreatingRoastRequest(true);
    const quantityG = parseFloat(roastRequestData.quantityG);
    const result = await createRoastRequestForOrder({
      orderId: roastRequestOrder.id,
      greenCoffeeId: roastRequestData.greenCoffeeId,
      coffeeName: selectedCoffee.name,
      requestedRoastedG: quantityG,
      priority: roastRequestData.priority,
      dueDate: roastRequestData.dueDate || undefined,
    });
    setIsCreatingRoastRequest(false);
    if (result.error) {
      alert(result.error);
    } else {
      setRoastRequestOrder(null);
      setRoastRequestData({ greenCoffeeId: "", quantityG: "", priority: "normal", dueDate: "" });
      alert(result.merged
        ? `Added ${quantityG}g to existing roast request for ${selectedCoffee.name}. View it in the Roasting page.`
        : "Roast request created! View it in the Roasting page."
      );
    }
  };

  // Everything the expanded row needs, assembled once. Same prop names, same
  // handlers, same values as before the rebuild.
  const expandedProps = {
    products,
    allComponents,
    coffeeInventory,
    getLineItemCogs,
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
  };

  // From the server, over the whole period. These used to be reduced over
  // `orders`, which was correct only while that fetch was unbounded.
  // `coveredRevenue` is deliberately NOT called `totalRevenue` any more: it is
  // the costed subset, and the previous name invited exactly the confusion this
  // whole change exists to remove. `periodRevenue` is the real total.
  const {
    revenue: coveredRevenue,
    cogs: totalCogs,
    profit: totalProfit,
    margin: avgMargin,
    totalRevenue: periodRevenue,
  } = totals;

  // "1 year" reads badly inside "the last …", so say it the way a person would.
  const periodPhrase = period === "365" ? "Year" : `${period} Days`;

  if (!isAdminConfigured) {
    return (
      <div
        style={{
          maxWidth: "var(--content-max)",
          margin: "0 auto",
          padding: "var(--space-6)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-6)",
        }}
      >
        <div>
          <h1 style={title}>Orders</h1>
          <p style={{ ...sans, color: "var(--ink-muted)", marginTop: "var(--space-2)" }}>
            Sync and analyze orders from your Shopify store.
          </p>
        </div>
        <EmptyState
          icon={<Settings />}
          title="Shopify is not connected"
          description="Connect your store in Settings and orders will start syncing here."
          action={
            <Link href="/settings">
              <Button iconLeft={<Settings />}>Go to Settings</Button>
            </Link>
          }
        />
      </div>
    );
  }

  /**
   * ONE hero + one ruled strip — never a row of equal KPI cards.
   *
   * Gross profit is the hero because it is what this page PRODUCES: revenue
   * minus the COGS the operator assembles row by row below. Revenue and COGS are
   * its two inputs, margin is its ratio, and missing-COGS is the count that says
   * how much of it to believe.
   *
   * The `$` stays inside the value rather than moving to `unit`, because
   * `stat-revenue` and `stat-cogs` are asserted with `toHaveText("$154.62")` by
   * the capability tests — splitting the glyph off would break them for a purely
   * cosmetic reason.
   */
  // Criterion 4/6: the figures state the revenue they cover, and say nothing
  // extra when they cover everything.
  //
  // Gated on the MONEY, not on the exclusion count. Those come apart: an
  // excluded order with $0 revenue (19 of them on production — comps, $0
  // deposits, fully-discounted orders) leaves covered === period while the count
  // is non-zero, and the count-gated version then rendered "$438.00 of $438.00"
  // under a red banner headlined "Margin covers $438.00 of $438.00" — a
  // live-register alert whose own headline says nothing is missing.
  //
  // Compares the RENDERED strings rather than the floats, so a sub-cent gap that
  // would print as "$X of $X" is treated as no gap at all — same defect, smaller.
  const revenueDiffers = money(coveredRevenue) !== money(periodRevenue);
  const scopeNote = revenueDiffers ? `of ${money(periodRevenue)}` : undefined;

  const stats: Stat[] = [
    {
      label: "Revenue",
      value: <span data-testid="stat-revenue">{money(coveredRevenue)}</span>,
      unit: scopeNote,
    },
    { label: "Total COGS", value: <span data-testid="stat-cogs">{money(totalCogs)}</span> },
    { label: "Avg margin", value: avgMargin.toFixed(1), unit: "%" },
    {
      label: "Excluded",
      value: String(excludedTotal),
      unit: excludedTotal === 1 ? "order" : "orders",
    },
  ];

  return (
    <div
      style={{
        maxWidth: "var(--content-max)",
        margin: "0 auto",
        padding: "var(--space-6)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-5)",
      }}
    >
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 style={title}>Orders</h1>
          <p style={{ ...sans, color: "var(--ink-muted)", marginTop: "var(--space-2)" }}>
            Track revenue, COGS, and profit per order.
          </p>
        </div>
        <Button
          iconLeft={<RefreshCw className={isSyncing ? "animate-spin" : undefined} />}
          onClick={handleSync}
          disabled={isSyncing}
        >
          {isSyncing ? "Syncing…" : "Sync orders"}
        </Button>
      </div>

      {/*
        PERIOD scopes everything below it — the list AND the aggregates — so it
        sits above the metrics rather than in the filter bar with the view-only
        controls. Presets only, capped at 1 year: an unbounded option would
        reintroduce exactly the problem the bounded query exists to fix.
      */}
      <div
        className="flex flex-wrap items-center gap-3"
        style={{
          paddingBottom: "var(--space-4)",
          borderBottom: "1px solid var(--hairline)",
        }}
      >
        <span style={{ ...overline, color: "var(--ink-muted)" }}>Period</span>
        <PeriodControl
          period={period}
          onSelect={(value) => router.push(`/orders?period=${value}`)}
        />
      </div>

      {/*
        Hero and strip sit side by side only above 1400px, and stack below it.
        Measured, not guessed: this hero is MONEY at `--fs-hero`, so "$433.38"
        renders ~430px wide — far wider than the dashboard's 260px basis — and at
        1280 that left the strip about 540px, which made it wrap its fourth stat
        onto a second line. Stacked, the strip gets the full canvas and all four
        read as one ruled line, which is the whole point of a StatStrip.
      */}
      <div className="flex flex-col gap-6 min-[1400px]:flex-row min-[1400px]:items-end">
        {/*
          The hero column sizes to its content and never shrinks.

          It was `flex-[0_1_340px]` with `minWidth: 0`, and the `minWidth: 0` was
          the actual defect. A flex item's default `min-width: auto` refuses to
          shrink below its content; zeroing it removes that floor, so the column
          collapsed toward its 340px basis while the figure inside stayed 388px
          and spilled out. It ran under the strip, which paints its own
          background, so the last glyphs were covered: at 1440, "$337.38" in a
          340px column, overlapping by 24px. Not a cosmetic overlap — an
          unreadable number, the same failure as the stat that once clipped
          "23,840" to "23,84".

          Verified by reverting: with `minWidth: 0` restored, all six assertions
          in orders-layout.spec.ts fail; without it they pass even at the old
          340px basis. `minWidth: 0` is correct on the strip beside it (a strip
          SHOULD absorb the leftover width) and wrong here.

          No baseline could catch this. Desktop snapshots run at 1280 and mobile
          at 375, both below the 1400px breakpoint where this row goes side by
          side, so the two-column layout is captured by no baseline at all. The
          regression test asserts geometry above 1400 instead of pixels.

          Content-sized rather than a bigger fixed basis because the figure grows
          with the business — a seven-figure profit is wider than any number we
          could pick today. If it ever crowds the strip, the strip wraps, which
          is survivable; a truncated number is not.
        */}
        <div className="min-[1400px]:flex-[0_0_auto]" data-testid="hero-column">
          <HeroMetric
            label="Gross profit"
            value={money(totalProfit)}
            note={`revenue minus COGS · last ${periodPhrase.toLowerCase()}`}
          />
        </div>
{/*
          `data-period-revenue` and `data-excluded-revenue` are explicit TEST
          SEAMS, not dead markup.

          Criterion 5 proves the aggregate covers the range rather than the page.
          Its probe used to be `stat-revenue`, which now covers only the costed
          subset by design — so the property stopped holding of it and two tests
          failed for entirely the right reason. The range-wide figures have to be
          readable at every period for that probe to work, and the VISIBLE
          qualifier cannot serve: Criterion 6 requires it to disappear when
          nothing is excluded, which is exactly the demo seed's 7-day window.

          `data-excluded-revenue` exists because the reconciliation test cannot
          sum the excluded rows it can SEE and compare that to a range-wide total
          — page-scoped evidence cannot check a range-scoped claim, and doing so
          was off by $277 once the seed fixtures landed.

          `data-testid` stays `strip-column`, which CoffeeOS#68 added for the
          layout regression test in orders-layout.spec.ts. One element gets one
          test id; the exclusion tests query this same node rather than renaming
          a seam another suite already depends on.
        */}
        <div
          className="min-[1400px]:flex-1"
          style={{ minWidth: 0 }}
          data-testid="strip-column"
          data-period-revenue={periodRevenue}
          data-excluded-revenue={periodRevenue - coveredRevenue}
        >
          <StatStrip stats={stats} />
        </div>
      </div>

      {/*
        The live register. Incomplete costing is the one thing on this page that
        needs the operator, and red earns its place here because every margin
        above is overstated until it clears.
      */}
      {excludedTotal > 0 && (
        <div data-testid="missing-cogs-banner">
          <InlineBanner
            tone="danger"
            /*
              The banner stays gated on the COUNT while its title is gated on the
              MONEY — deliberately different conditions, because that is the
              actual relationship. Excluded $0 orders are still a costing gap
              worth clearing; they just carry no revenue to talk about, so the
              title must not claim a shortfall it cannot show.
            */
            title={
              revenueDiffers
                ? `Margin covers ${money(coveredRevenue)} of ${money(periodRevenue)} in this period`
                : `${excludedTotal} ${excludedTotal === 1 ? "order is" : "orders are"} excluded from the margin figures`
            }
            /*
              The COUNTS are range-true — they are the honest numbers and the
              reason the banner exists. The ACTION is not: `setCogsFilter` filters
              `orders`, which is one page. So the action only appears when the
              page actually holds one of these orders, and says how many it can
              reach; otherwise it would hand the operator a button that lands
              them on "No orders match" with this banner still overhead.
            */
            action={
              excludedOnPage > 0 ? (
                <Button
                  size="sm"
                  variant="secondary"
                  data-testid="missing-cogs-show"
                  onClick={() => setCogsFilter("excluded")}
                >
                  {excludedOffPage === 0
                    ? excludedTotal === 1
                      ? "Show it"
                      : "Show them"
                    : `Show the ${excludedOnPage} on this page`}
                </Button>
              ) : undefined
            }
          >
            {/*
              TWO counts, never one total.

              They need different work and have wildly different ceilings. On
              production 26 orders are repairable by costing 7 products, while
              239 can never be repaired at all — their Shopify products no longer
              exist. Collapsing those into a single "265 excluded" would hide the
              only actionable number behind one that is mostly noise, which is the
              same conflation the per-line-item labels were split to undo.
            */}
            <span data-testid="excluded-uncosted-count">
              {totals.excludedUncosted > 0 && (
                <>
                  <strong>{totals.excludedUncosted}</strong>{" "}
                  {totals.excludedUncosted === 1 ? "order is" : "orders are"} waiting on a
                  product recipe — expand{" "}
                  {totals.excludedUncosted === 1 ? "it" : "one"} to see which product, and
                  costing it brings {totals.excludedUncosted === 1 ? "the order" : "them"}{" "}
                  back into the figures above.{" "}
                </>
              )}
            </span>
            <span data-testid="excluded-unlinked-count">
              {totals.excludedUnlinked > 0 && (
                <>
                  <strong>{totals.excludedUnlinked}</strong>{" "}
                  {totals.excludedUnlinked === 1 ? "order has" : "orders have"} line items
                  matching no product in the catalogue — the Shopify product was deleted
                  or replaced, so costing cannot recover{" "}
                  {totals.excludedUnlinked === 1 ? "it" : "them"}.{" "}
                </>
              )}
            </span>
            {/*
              Say it plainly rather than suggesting a way through: the list is
              the NEWEST page of the period, so neither a wider nor a narrower
              preset surfaces an older excluded order. Nothing on this screen
              reaches them today, and pretending otherwise sends the operator
              round in circles.
            */}
            {excludedOffPage > 0 && (
              <>
                {excludedOffPage === excludedTotal
                  ? `None of them are among the ${orders.length} most recent orders listed below.`
                  : `${excludedOffPage} of them are older than the ${orders.length} most recent orders listed below.`}
              </>
            )}
          </InlineBanner>
        </div>
      )}

      {/* Filter bar — the one place a bordered container is allowed here. Both
          controls are views of the page already fetched, unlike the period. */}
      <div
        className="flex flex-wrap items-center gap-3"
        style={{
          padding: "var(--space-3)",
          background: "var(--surface-sunken)",
          border: "1px solid var(--hairline)",
          borderRadius: "var(--r-md)",
        }}
      >
        <div style={{ flex: "1 1 220px", minWidth: 160, maxWidth: 340 }}>
          <Input
            size="sm"
            leading={<Search />}
            placeholder="Order # or product"
            aria-label="Search orders"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <SegmentedControl
          size="sm"
          value={cogsFilter}
          onChange={(value) => setCogsFilter(value as CogsFilter)}
          options={COGS_FILTERS}
        />
      </div>

      {/* Orders */}
      {orders.length === 0 ? (
        /*
          The list is period-scoped, so "No orders yet" would be a lie in the
          common case: the orders may exist, just outside this window. Name the
          period and point at the way out.
        */
        <EmptyState
          icon={<ShoppingCart />}
          title={`Nothing in the last ${periodPhrase.toLowerCase()}`}
          description={
            period === "365"
              ? "Nothing synced this year. Sync to pull the latest from Shopify."
              : "Try a longer period, or sync to pull the latest from Shopify."
          }
          action={
            <Button onClick={handleSync} disabled={isSyncing} iconLeft={<RefreshCw />}>
              Sync orders
            </Button>
          }
        />
      ) : filteredOrders.length === 0 ? (
        /*
          Third instance of the page-vs-period hazard: the search and the COGS
          filter both run over `orders`, which is a page. "Nothing in this
          period matches" would be a claim about the range that this filter
          never examined.
        */
        <EmptyState
          icon={<Search />}
          title="No orders match"
          description="None of the orders listed match the search and filter."
          action={
            <Button
              variant="secondary"
              onClick={() => {
                setSearchQuery("");
                setCogsFilter("all");
              }}
            >
              Clear filters
            </Button>
          }
        />
      ) : (
        <OrdersWorksheetTable
          filteredOrders={filteredOrders}
          expandedOrders={expandedOrders}
          toggleOrderExpanded={toggleOrderExpanded}
          getOrderCogs={getOrderCogs}
          {...expandedProps}
        />
      )}

      <div
        className="flex flex-wrap justify-between gap-4"
        style={{ ...mono, fontSize: "var(--fs-caption)", color: "var(--ink-muted)" }}
      >
        {/*
          The sentence names the period, so any figure in it has to BE a period
          figure. `orders.length` is a page, and at a saturated page "100 of 100
          orders shown · last 30 days" asserts the period holds 100 when it may
          hold 137. When the page covers the range the two are the same set and
          the plain phrasing is true; when it does not, say which is which.
        */}
        <span data-testid="orders-footer-count">
          {pageCoversRange
            ? `${filteredOrders.length} of ${orders.length} orders shown · last ${periodPhrase.toLowerCase()}`
            : filteredOrders.length === orders.length
              ? `newest ${orders.length} of ${rangeCount} orders · last ${periodPhrase.toLowerCase()}`
              : `${filteredOrders.length} of the newest ${orders.length} shown · ${rangeCount} orders in the last ${periodPhrase.toLowerCase()}`}
        </span>
      </div>

      {/*
        Roast Request dialog.

        Stays the Radix dialog rather than instrument's <Modal>: instrument's
        Modal renders no `role="dialog"`, and the capability test drives this
        flow through `getByRole('dialog')`. It also portals to <body>, OUTSIDE
        the AppShell's `data-surface="app"` — which is where the entire
        instrument token layer is scoped — so every var(--token) inside would
        resolve to nothing. Setting `data-surface="app"` on the content is what
        instrument's own Modal does for exactly this reason, and `data-slot`
        keeps the token layer from also handing it the app canvas background.
      */}
      <Dialog
        open={!!roastRequestOrder}
        onOpenChange={(open) => !open && setRoastRequestOrder(null)}
      >
        <DialogContent
          data-surface="app"
          data-slot="modal"
          className="max-w-md p-0 gap-0 overflow-hidden"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--hairline-strong)",
            borderRadius: "var(--r-lg)",
            boxShadow: "var(--shadow-modal)",
          }}
        >
          <div
            style={{
              padding: "var(--space-4) var(--space-5)",
              borderBottom: "1px solid var(--hairline)",
            }}
          >
            <DialogHeader>
              <DialogTitle asChild>
                <h2 style={{ ...overline, color: "var(--ink-muted)" }}>
                  Create roast request
                </h2>
              </DialogTitle>
            </DialogHeader>
          </div>

          <div
            style={{
              padding: "var(--space-5)",
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-4)",
            }}
          >
            <p style={{ ...sans, color: "var(--ink-muted)" }}>
              For order{" "}
              <span style={{ ...mono, color: "var(--ink)" }}>
                {roastRequestOrder?.order_name}
              </span>
            </p>

            <div>
              <label htmlFor="roast-coffee" style={DIALOG_LABEL}>
                Coffee to roast
              </label>
              <Select
                value={roastRequestData.greenCoffeeId}
                onValueChange={(value) => setRoastRequestData({ ...roastRequestData, greenCoffeeId: value })}
              >
                <SelectTrigger id="roast-coffee" data-testid="roast-coffee-select" style={DIALOG_SELECT}>
                  <SelectValue placeholder="Select coffee" />
                </SelectTrigger>
                <SelectContent>
                  {coffeeInventory.map((coffee) => (
                    <SelectItem key={coffee.id} value={coffee.id}>
                      {coffee.name} — {coffee.current_green_quantity_g.toLocaleString()}g available
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label htmlFor="roast-quantity" style={DIALOG_LABEL}>
                Quantity needed (grams)
              </label>
              <Input
                id="roast-quantity"
                mono
                type="number"
                step="1"
                min="0"
                data-testid="roast-quantity-input"
                value={roastRequestData.quantityG}
                onChange={(e) => setRoastRequestData({ ...roastRequestData, quantityG: e.target.value })}
                placeholder="e.g. 500"
              />
            </div>

            <div>
              <label htmlFor="roast-priority" style={DIALOG_LABEL}>
                Priority
              </label>
              <Select
                value={roastRequestData.priority}
                onValueChange={(value: "low" | "normal" | "high" | "urgent") =>
                  setRoastRequestData({ ...roastRequestData, priority: value })
                }
              >
                <SelectTrigger id="roast-priority" style={DIALOG_SELECT}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label htmlFor="roast-due" style={DIALOG_LABEL}>
                Due date (optional)
              </label>
              <Input
                id="roast-due"
                type="date"
                value={roastRequestData.dueDate}
                onChange={(e) => setRoastRequestData({ ...roastRequestData, dueDate: e.target.value })}
              />
            </div>
          </div>

          <div
            className="flex justify-end gap-2"
            style={{
              padding: "var(--space-4) var(--space-5)",
              borderTop: "1px solid var(--hairline)",
              background: "var(--surface-sunken)",
            }}
          >
            <Button variant="tertiary" onClick={() => setRoastRequestOrder(null)}>
              Cancel
            </Button>
            <Button
              data-testid="roast-request-submit"
              onClick={handleCreateRoastRequest}
              disabled={isCreatingRoastRequest || !roastRequestData.greenCoffeeId || !roastRequestData.quantityG}
            >
              {isCreatingRoastRequest ? "Creating…" : "Create request"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

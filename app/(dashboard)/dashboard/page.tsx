import { createClient } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/team";
import {
  Badge,
  type BadgeProps,
  EmptyState,
  HeroMetric,
  StatStrip,
  type Stat,
} from "@merninos/ui/instrument";
import Link from "next/link";
import type { CSSProperties } from "react";

/**
 * The dashboard overview, on the instrument design system.
 *
 * This stays a SERVER component. The `@merninos/ui/instrument` barrel is marked
 * `'use client'` wholesale (esbuild drops per-module directives when bundling),
 * so every instrument component here is across the server/client boundary and may
 * only be handed serializable props. That is why the green-inventory table below
 * is a plain <table> and not a <DataTable>: DataTable's status column needs a
 * `render` callback, and a function cannot cross that boundary.
 *
 * Design-system rule: instrument values are read as `var(--token)` through inline
 * styles, never through Tailwind classes — the Tailwind theme is the loud Mernin'
 * palette (bg-cream, border-espresso, shadow-flat-*) and would silently render the
 * wrong system inside the instrument shell. Tailwind is used below only for
 * layout structure that needs a responsive breakpoint (grid templates), never for
 * a colour, border, radius, shadow or type value.
 */

const LBS_TO_GRAMS = 453.592;
const DAY_LABELS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

type BadgeTone = NonNullable<BadgeProps["tone"]>;

/**
 * The loud `Pill` variants mapped onto instrument's semantic tones. This is a
 * mechanical colour → meaning map so the conversion stays a re-skin: the old
 * palette carried the semantics implicitly, this makes them explicit.
 *   tomato → danger   sun → warning   matcha → success
 *   sky    → info     espresso/fog → neutral
 * The one deliberate departure is green-coffee "Out", which was `espresso`
 * (merely the strongest swatch) and is `danger` here — being out of green stock
 * is a blocking condition, not a neutral one.
 */
const ORDER_STATUS_TONE: Record<string, BadgeTone> = {
  paid: "info",
  pending: "warning",
  refunded: "neutral",
  voided: "neutral",
  partially_paid: "warning",
  authorized: "success",
};

const overline: CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontVariationSettings: "var(--overline-settings)",
  fontWeight: "var(--overline-weight)" as unknown as number,
  textTransform: "uppercase",
  letterSpacing: "var(--overline-tracking)",
  fontSize: "var(--fs-overline)",
  color: "var(--ink-subtle)",
};

const mono: CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontVariationSettings: "var(--data-settings)",
  fontWeight: "var(--data-weight)" as unknown as number,
  fontVariantNumeric: "tabular-nums",
};

const sans: CSSProperties = {
  fontFamily: "var(--font-sans)",
  fontSize: "var(--fs-body)",
  color: "var(--ink)",
};

/**
 * PROVISIONAL — do not extract, do not move into @merninos/ui.
 *
 * The instrument design system deliberately ships no Panel/Card primitive: its
 * layout model is a worksheet (content directly on the canvas, hairline rules, no
 * nested cards by default), and whether a bordered container belongs in the
 * package is an open design question. This local component only re-skins the
 * container markup that was already here with instrument tokens. When the design
 * system ships a real container primitive, delete this and use that.
 */
function Panel({
  title,
  action,
  actionHref,
  children,
}: {
  title: string;
  action?: string;
  actionHref?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      style={{
        display: "flex",
        flexDirection: "column",
        background: "var(--surface)",
        border: "1px solid var(--hairline)",
        borderRadius: "var(--r-lg)",
        boxShadow: "var(--shadow-sm)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "var(--space-3)",
          padding: "var(--space-3) var(--space-4)",
          borderBottom: "1px solid var(--hairline)",
        }}
      >
        <h2 style={{ ...overline, color: "var(--ink-muted)" }}>{title}</h2>
        {action && actionHref && (
          // Colour is deliberately not set: the design system's own `a` rule
          // gives it --ink plus a --brand hover, which is the link affordance.
          <Link href={actionHref} style={{ ...overline, whiteSpace: "nowrap" }}>
            {action}
          </Link>
        )}
      </div>
      <div style={{ flex: 1, padding: "var(--space-4)" }}>{children}</div>
    </section>
  );
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { ownerId } = await getEffectiveOwnerId();

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user?.id)
    .single();

  const role = profile?.role || user?.user_metadata?.role || "roaster";

  const [
    productsResult,
    componentsResult,
    productComponentsResult,
    inventoryResult,
    ordersResult,
    batchesResult,
  ] = await Promise.all([
    supabase
      .from("products")
      .select("id, price", { count: "exact" })
      .eq("user_id", ownerId),
    supabase
      .from("components")
      .select("id", { count: "exact" })
      .eq("user_id", ownerId),
    supabase.from("product_components").select(`
      product_id,
      quantity,
      components (cost_per_unit)
    `),
    supabase
      .from("green_coffee_inventory")
      .select("id, name, current_green_quantity_g, price_per_lb")
      .eq("user_id", ownerId),
    supabase
      .from("orders")
      .select("id, total_price, financial_status, created_at", {
        count: "exact",
      })
      .eq("user_id", ownerId)
      .order("created_at", { ascending: false })
      .limit(4),
    supabase
      .from("roasting_batches")
      .select("id, sellable_g, created_at")
      .eq("user_id", ownerId)
      .order("created_at", { ascending: false }),
  ]);

  const totalProducts = productsResult.count || 0;
  const totalComponents = componentsResult.count || 0;
  const totalOrders = ordersResult.count || 0;

  // COGS per product
  const productCogs: Record<string, number> = {};
  for (const pc of productComponentsResult.data || []) {
    const cost =
      (pc.quantity || 0) *
      ((pc.components as unknown as { cost_per_unit: number } | null)?.cost_per_unit || 0);
    productCogs[pc.product_id] = (productCogs[pc.product_id] || 0) + cost;
  }

  const products = productsResult.data || [];
  let avgMargin = 0;

  if (products.length > 0) {
    const margins = products
      .filter((p) => p.price && productCogs[p.id] !== undefined)
      .map((p) => {
        const cogs = productCogs[p.id] || 0;
        return ((p.price - cogs) / p.price) * 100;
      });
    if (margins.length > 0) {
      avgMargin = margins.reduce((a, b) => a + b, 0) / margins.length;
    }
  }

  const inventory = inventoryResult.data || [];
  const totalInventoryLbs = inventory.reduce(
    (sum, c) => sum + (c.current_green_quantity_g || 0) / LBS_TO_GRAMS,
    0
  );

  const batches = batchesResult.data || [];
  const totalRoastedG = batches.reduce((sum, b) => sum + (b.sellable_g || 0), 0);

  const orders = ordersResult.data || [];
  const totalOrderRevenue = orders.reduce(
    (sum, o) => sum + (o.total_price || 0),
    0
  );

  // 7-day chart data
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  const chartDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(today.getDate() - 6 + i);
    return { label: DAY_LABELS[d.getDay()], lbs: 0, dateStr: d.toDateString() };
  });
  for (const batch of batches) {
    const ds = new Date(batch.created_at).toDateString();
    const day = chartDays.find((d) => d.dateStr === ds);
    if (day) day.lbs += (batch.sellable_g || 0) / LBS_TO_GRAMS;
  }
  const maxChartLbs = Math.max(...chartDays.map((d) => d.lbs), 1);
  const weeklyRoastedLbs = chartDays.reduce((sum, d) => sum + d.lbs, 0);
  const peakDayIdx = chartDays.reduce(
    (best, d, i) => (d.lbs > chartDays[best].lbs ? i : best),
    0
  );

  // Recent batches for On Hand panel
  const recentBatches = batches.slice(0, 3);

  const firstName = user?.user_metadata?.first_name || "there";
  const isOwnerOrAdmin = role === "owner" || role === "admin";

  /**
   * ROLE FORK — identical membership to the four StatCards it replaces.
   *
   * Every role sees "lbs Roasted · This Week" (now the hero) and "Total
   * Products". Owners/admins additionally see Avg Margin and Shop Revenue;
   * roasters instead see Green Stock and Total Batches. The hero figure is the
   * SAME for both roles on purpose, so the fork stays confined to this one array
   * — one branch to read instead of two.
   */
  const secondaryStats: Stat[] = [
    { label: "Total Products", value: totalProducts.toString() },
    ...(isOwnerOrAdmin
      ? ([
          {
            label: "Avg Margin",
            value: avgMargin > 0 ? avgMargin.toFixed(0) : "—",
            unit: avgMargin > 0 ? "%" : undefined,
          },
          {
            label: "Shop Revenue · 7d",
            value:
              totalOrderRevenue > 0
                ? `$${totalOrderRevenue >= 1000 ? `${(totalOrderRevenue / 1000).toFixed(1)}k` : totalOrderRevenue.toFixed(0)}`
                : "—",
          },
        ] satisfies Stat[])
      : ([
          {
            label: "Green Stock",
            value: totalInventoryLbs.toFixed(0),
            unit: "lbs",
          },
          { label: "Total Batches", value: batches.length.toString() },
        ] satisfies Stat[])),
  ];

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
      {/*
        One hero figure + one ruled stat strip — never a row of equal KPI cards.
        The hero is weekly roast output: it is the only *rate* on the page (the
        rest are stock levels, counts or a ratio), it is the figure the panel
        directly below it breaks down day by day, and it is the one number both
        roles are shown — so the role fork lives entirely in the strip.
      */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "var(--space-6)",
          alignItems: "end",
        }}
      >
        <div style={{ flex: "0 0 260px", minWidth: 0 }}>
          <HeroMetric
            label="lbs Roasted · This Week"
            value={weeklyRoastedLbs > 0 ? weeklyRoastedLbs.toFixed(0) : "—"}
            unit={weeklyRoastedLbs > 0 ? "lbs" : undefined}
            note="sellable weight over the last 7 days"
          />
        </div>
        <div style={{ flex: "1 1 420px", minWidth: 0 }}>
          <StatStrip stats={secondaryStats} />
        </div>
      </div>

      {/* Main row: chart + recent roasts */}
      <div
        className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr]"
        style={{ gap: "var(--space-4)" }}
      >
        {/*
          Bar chart — one series (lbs roasted per day), seven divs, no library.

          Bar fill is --ink-subtle and the peak bar is --ink: a single-series
          chart needs exactly one hue, and the peak is distinguished by WEIGHT,
          which is how this system emphasises. It is not --brand (red is the live
          register — "happening now / needs you" — and a seven-day history is
          neither), not --viz-highlight (that token *is* --brand), and not the
          --roast-* ramp (banned: nothing here encodes roast level).
          The track behind each bar is --viz-grid, so a zero day reads as an
          empty column rather than a misleading stub, and --viz-axis rules the
          baseline.
        */}
        <Panel title="Daily Roast Output · lbs" action="All Roasts" actionHref="/roasting">
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "flex-end",
                gap: "var(--space-2)",
                borderBottom: "1px solid var(--viz-axis)",
              }}
            >
              {chartDays.map((day, i) => {
                const heightPct =
                  day.lbs > 0 ? Math.max((day.lbs / maxChartLbs) * 100, 4) : 0;
                const isPeak = i === peakDayIdx && day.lbs > 0;
                return (
                  <div
                    key={day.dateStr}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: "var(--space-1)",
                    }}
                  >
                    <span
                      style={{
                        ...mono,
                        fontSize: "var(--fs-overline)",
                        color: "var(--ink)",
                        height: 14,
                        lineHeight: "14px",
                      }}
                    >
                      {isPeak ? day.lbs.toFixed(0) : " "}
                    </span>
                    <div
                      style={{
                        width: "100%",
                        height: 132,
                        display: "flex",
                        alignItems: "flex-end",
                        background: "var(--viz-grid)",
                        borderRadius: "var(--r-sm) var(--r-sm) 0 0",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: "100%",
                          height: `${heightPct}%`,
                          background: isPeak ? "var(--ink)" : "var(--ink-subtle)",
                          borderRadius: "var(--r-sm) var(--r-sm) 0 0",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <div
              style={{
                display: "flex",
                gap: "var(--space-2)",
                marginTop: "var(--space-2)",
              }}
            >
              {chartDays.map((day) => (
                <div
                  key={day.dateStr}
                  style={{ ...overline, flex: 1, minWidth: 0, textAlign: "center" }}
                >
                  {day.label}
                </div>
              ))}
            </div>
          </div>
        </Panel>

        {/* Recent Roasts — ruled rows, not tinted tiles. The old rows cycled
            tomato/sun/honey per index, which encoded nothing. */}
        <Panel title="Recent Roasts" action="View All" actionHref="/roasting">
          {recentBatches.length === 0 ? (
            <EmptyState compact title="No batches yet" description="Logged roasts show up here." />
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {recentBatches.map((batch, i) => {
                const lbs = (batch.sellable_g || 0) / LBS_TO_GRAMS;
                const date = new Date(batch.created_at);
                const daysAgo = Math.floor(
                  (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24)
                );
                const dateLabel =
                  daysAgo === 0
                    ? "Today"
                    : daysAgo === 1
                    ? "Yesterday"
                    : `${daysAgo}d ago`;
                return (
                  <li
                    key={batch.id}
                    style={{
                      display: "flex",
                      alignItems: "baseline",
                      gap: "var(--space-3)",
                      padding: "var(--space-3) 0",
                      borderTop: i === 0 ? undefined : "1px solid var(--hairline)",
                    }}
                  >
                    <span
                      style={{
                        ...mono,
                        fontSize: "var(--fs-label)",
                        color: "var(--ink)",
                      }}
                    >
                      #{batch.id.slice(-6).toUpperCase()}
                    </span>
                    <span
                      style={{
                        flex: 1,
                        minWidth: 0,
                        fontFamily: "var(--font-sans)",
                        fontSize: "var(--fs-caption)",
                        color: "var(--ink-muted)",
                      }}
                    >
                      {dateLabel}
                    </span>
                    <span
                      style={{
                        ...mono,
                        fontSize: "var(--fs-data)",
                        color: "var(--ink)",
                      }}
                    >
                      {lbs.toFixed(1)}
                    </span>
                    <span style={overline}>lbs</span>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>

      {/* Bottom row: green inventory + orders (owner/admin) or quick actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2" style={{ gap: "var(--space-4)" }}>
        {/*
          Green Inventory — stays a plain <table>, retokenized. DataTable would
          need a `render` callback for the Status badge column, and this file is
          a server component: functions cannot be passed to the client-marked
          instrument barrel.
        */}
        <Panel title="Green Inventory" action="View All" actionHref="/inventory">
          {inventory.length === 0 ? (
            <EmptyState
              compact
              title="No inventory yet"
              description="Green coffee lots show up here once you add them."
            />
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th
                    style={{
                      ...overline,
                      textAlign: "left",
                      padding: "0 0 var(--space-2)",
                      borderBottom: "1px solid var(--hairline-strong)",
                    }}
                  >
                    Origin
                  </th>
                  <th
                    style={{
                      ...overline,
                      textAlign: "right",
                      padding: "0 0 var(--space-2)",
                      borderBottom: "1px solid var(--hairline-strong)",
                    }}
                  >
                    On Hand
                  </th>
                  <th
                    style={{
                      ...overline,
                      textAlign: "right",
                      padding: "0 0 var(--space-2)",
                      borderBottom: "1px solid var(--hairline-strong)",
                    }}
                  >
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {inventory.slice(0, 5).map((item) => {
                  const lbs = (item.current_green_quantity_g || 0) / LBS_TO_GRAMS;
                  const status = lbs === 0 ? "out" : lbs < 5 ? "low" : "fresh";
                  return (
                    <tr key={item.id}>
                      <td
                        style={{
                          ...sans,
                          fontSize: "var(--fs-label)",
                          padding: "var(--space-3) 0",
                          borderBottom: "1px solid var(--hairline)",
                        }}
                      >
                        {item.name}
                      </td>
                      <td
                        style={{
                          ...mono,
                          fontSize: "var(--fs-label)",
                          color: "var(--ink)",
                          textAlign: "right",
                          padding: "var(--space-3) 0",
                          borderBottom: "1px solid var(--hairline)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {lbs.toFixed(0)} lb
                      </td>
                      <td
                        style={{
                          textAlign: "right",
                          padding: "var(--space-3) 0",
                          borderBottom: "1px solid var(--hairline)",
                        }}
                      >
                        <Badge
                          tone={
                            status === "fresh"
                              ? "success"
                              : status === "low"
                              ? "warning"
                              : "danger"
                          }
                        >
                          {status === "fresh"
                            ? "In Stock"
                            : status === "low"
                            ? "Low"
                            : "Out"}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Panel>

        {/* ROLE FORK — owners/admins only. */}
        {isOwnerOrAdmin && (
          <Panel title="Recent Orders" action="All Orders" actionHref="/orders">
            {orders.length === 0 ? (
              <EmptyState
                compact
                title="No orders yet"
                description="Orders synced from your shop show up here."
              />
            ) : (
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {orders.map((order, i) => (
                  <li
                    key={order.id}
                    style={{
                      borderTop: i === 0 ? undefined : "1px solid var(--hairline)",
                    }}
                  >
                    {/*
                      Kept a real <Link>. DataTable.onRowClick is a JS callback
                      and would lose middle-click, open-in-new-tab and prefetch.
                    */}
                    <Link
                      href={`/orders/${order.id}`}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "var(--space-3)",
                        padding: "var(--space-3) 0",
                        textDecoration: "none",
                      }}
                    >
                      <span
                        style={{
                          ...mono,
                          fontSize: "var(--fs-caption)",
                          color: "var(--ink-subtle)",
                          width: 48,
                          flexShrink: 0,
                        }}
                      >
                        #{String(order.id).slice(-4)}
                      </span>
                      {/* No explicit colour — inherits the design system's
                          --ink link colour and its --brand hover. */}
                      <span
                        style={{
                          flex: 1,
                          minWidth: 0,
                          fontFamily: "var(--font-sans)",
                          fontSize: "var(--fs-label)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        Order {new Date(order.created_at).toLocaleDateString()}
                      </span>
                      <span
                        style={{
                          ...mono,
                          fontSize: "var(--fs-label)",
                          color: "var(--ink)",
                          textAlign: "right",
                          flexShrink: 0,
                        }}
                      >
                        ${(order.total_price || 0).toFixed(0)}
                      </span>
                      <Badge
                        tone={ORDER_STATUS_TONE[order.financial_status || ""] || "neutral"}
                      >
                        {order.financial_status || "pending"}
                      </Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        )}

        {/* ROLE FORK — everyone who is not an owner/admin. */}
        {!isOwnerOrAdmin && (
          <Panel title="Quick Actions">
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {[
                {
                  href: "/roasting",
                  title: "Start a Roast",
                  description: "Log a new roasting batch",
                  path: "M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z",
                },
                {
                  href: "/inventory",
                  title: "Check Inventory",
                  description: "View green coffee stock",
                  path: "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10",
                },
              ].map((action, i) => (
                <li
                  key={action.href}
                  style={{
                    borderTop: i === 0 ? undefined : "1px solid var(--hairline)",
                  }}
                >
                  <Link
                    href={action.href}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "var(--space-3)",
                      padding: "var(--space-3) 0",
                      textDecoration: "none",
                    }}
                  >
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="var(--ink-muted)"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ flexShrink: 0 }}
                      aria-hidden="true"
                    >
                      <path d={action.path} />
                    </svg>
                    <span style={{ minWidth: 0 }}>
                      <span
                        style={{
                          display: "block",
                          fontFamily: "var(--font-sans)",
                          fontSize: "var(--fs-label)",
                          fontWeight: "var(--fw-medium)" as unknown as number,
                        }}
                      >
                        {action.title}
                      </span>
                      <span
                        style={{
                          display: "block",
                          fontFamily: "var(--font-sans)",
                          fontSize: "var(--fs-caption)",
                          color: "var(--ink-muted)",
                        }}
                      >
                        {action.description}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>
        )}
      </div>
    </div>
  );
}

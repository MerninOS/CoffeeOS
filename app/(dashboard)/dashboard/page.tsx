import { createClient } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/team";
import Link from "next/link";

const LBS_TO_GRAMS = 453.592;
const DAY_LABELS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

function StatCard({
  label,
  value,
  delta,
}: {
  label: string;
  value: string;
  delta?: string;
}) {
  return (
    <div className="bg-chalk border-[3px] border-espresso rounded-[14px] p-4 shadow-flat-md">
      <div className="text-[10.5px] font-extrabold tracking-[.12em] uppercase text-muted-foreground">
        {label}
      </div>
      <div className="font-extrabold text-[42px] leading-none mt-1.5 text-espresso">
        {value}
      </div>
      {delta && (
        <div
          className={`mt-2 text-[11px] font-extrabold tracking-[.08em] uppercase ${
            delta.startsWith("+") ? "text-matcha" : "text-tomato"
          }`}
        >
          {delta}
        </div>
      )}
    </div>
  );
}

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
    <div className="bg-chalk border-[3px] border-espresso rounded-[16px] shadow-flat-md overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b-2 border-espresso bg-cream">
        <div className="font-extrabold text-sm uppercase tracking-[.08em]">{title}</div>
        {action && actionHref && (
          <Link
            href={actionHref}
            className="inline-flex items-center h-[30px] px-3.5 rounded-full border-[2.5px] border-espresso text-espresso bg-transparent text-[11px] font-extrabold tracking-[.08em] uppercase shadow-[3px_3px_0_#1C0F05] hover:-translate-x-[1.5px] hover:-translate-y-[1.5px] hover:shadow-[4px_4px_0_#1C0F05] active:translate-x-[2.5px] active:translate-y-[2.5px] active:shadow-none transition-all duration-100"
          >
            {action}
          </Link>
        )}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function Pill({
  variant,
  children,
}: {
  variant: "tomato" | "sun" | "matcha" | "sky" | "espresso" | "fog";
  children: React.ReactNode;
}) {
  const styles: Record<string, string> = {
    tomato: "bg-tomato text-cream",
    sun: "bg-sun text-espresso",
    matcha: "bg-matcha text-cream",
    sky: "bg-sky text-espresso",
    espresso: "bg-espresso text-cream",
    fog: "bg-fog text-espresso",
  };
  return (
    <span
      className={`inline-flex items-center px-[10px] py-[2px] rounded-full border-2 border-espresso text-[10px] font-extrabold tracking-[.1em] uppercase ${styles[variant]}`}
    >
      {children}
    </span>
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

  return (
    <div className="flex flex-col gap-4 p-6">
      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="lbs Roasted · This Week"
          value={weeklyRoastedLbs > 0 ? weeklyRoastedLbs.toFixed(0) : "—"}
        />
        <StatCard label="Total Products" value={totalProducts.toString()} />
        {isOwnerOrAdmin ? (
          <>
            <StatCard
              label="Avg Margin"
              value={avgMargin > 0 ? `${avgMargin.toFixed(0)}%` : "—"}
            />
            <StatCard
              label="Shop Revenue · 7d"
              value={
                totalOrderRevenue > 0
                  ? `$${totalOrderRevenue >= 1000 ? `${(totalOrderRevenue / 1000).toFixed(1)}k` : totalOrderRevenue.toFixed(0)}`
                  : "—"
              }
            />
          </>
        ) : (
          <>
            <StatCard
              label="Green Stock"
              value={`${totalInventoryLbs.toFixed(0)} lbs`}
            />
            <StatCard label="Total Batches" value={batches.length.toString()} />
          </>
        )}
      </div>

      {/* Main row: chart + on hand */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-4">
        {/* Bar chart */}
        <Panel title="Daily Roast Output · lbs" action="All Roasts" actionHref="/roasting">
          <div className="flex items-flex-end justify-around gap-2 h-[180px] py-3">
            {chartDays.map((day, i) => {
              const heightPct = maxChartLbs > 0 ? (day.lbs / maxChartLbs) * 100 : 0;
              const isPeak = i === peakDayIdx && day.lbs > 0;
              return (
                <div
                  key={i}
                  className="flex-1 flex flex-col items-center gap-1.5"
                >
                  <div className="relative w-full flex items-end" style={{ height: 150 }}>
                    <div
                      className="w-full border-[2.5px] border-espresso rounded-t-[8px] shadow-[2px_2px_0_#1C0F05] relative"
                      style={{
                        height: `${Math.max(heightPct, day.lbs > 0 ? 8 : 4)}%`,
                        background: isPeak ? "#E8442A" : "#3B1F0A",
                        minHeight: day.lbs > 0 ? 8 : 4,
                      }}
                    >
                      {isPeak && day.lbs > 0 && (
                        <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] font-extrabold bg-sun text-espresso px-1.5 py-[2px] rounded-full border-2 border-espresso whitespace-nowrap">
                          {day.lbs.toFixed(0)} lb
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-[10px] font-extrabold tracking-[.1em] text-muted-foreground">
                    {day.label}
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>

        {/* On Hand / Recent Roasts */}
        <Panel title="Recent Roasts" action="View All" actionHref="/roasting">
          {recentBatches.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm font-bold tracking-wide uppercase">
              No batches yet
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {recentBatches.map((batch, i) => {
                const lbs = (batch.sellable_g || 0) / LBS_TO_GRAMS;
                const colors = ["tomato", "sun", "honey"] as const;
                const bgColor = colors[i % colors.length];
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
                  <div
                    key={batch.id}
                    className="p-3 border-[2.5px] border-espresso rounded-[12px] bg-cream flex items-center gap-3"
                  >
                    <div
                      className="w-9 h-9 border-[2.5px] border-espresso rounded-[10px] flex items-center justify-center shrink-0"
                      style={{
                        background:
                          bgColor === "tomato"
                            ? "#E8442A"
                            : bgColor === "sun"
                            ? "#F5C842"
                            : "#E8913A",
                      }}
                    >
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke={bgColor === "sun" ? "#1C0F05" : "#FDFAF0"}
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-extrabold text-[13px] leading-snug text-espresso truncate">
                        Batch #{batch.id.slice(-6).toUpperCase()}
                      </div>
                      <div className="text-[10.5px] text-muted-foreground mt-0.5">
                        Roasted {dateLabel}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-extrabold text-[22px] leading-none text-espresso">
                        {lbs.toFixed(1)}
                      </div>
                      <div className="text-[10px] text-muted-foreground tracking-[.08em] uppercase font-extrabold">
                        lbs
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      </div>

      {/* Bottom row: green inventory + orders */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Green Inventory */}
        <Panel title="Green Inventory" action="View All" actionHref="/inventory">
          {inventory.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground text-sm font-bold tracking-wide uppercase">
              No inventory yet
            </div>
          ) : (
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="border-b-2 border-espresso">
                  <th className="text-left py-1.5 text-[10px] tracking-[.1em] uppercase text-muted-foreground font-extrabold">
                    Origin
                  </th>
                  <th className="text-right py-1.5 text-[10px] tracking-[.1em] uppercase text-muted-foreground font-extrabold">
                    On Hand
                  </th>
                  <th className="text-right py-1.5 text-[10px] tracking-[.1em] uppercase text-muted-foreground font-extrabold">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {inventory.slice(0, 5).map((item) => {
                  const lbs = (item.current_green_quantity_g || 0) / LBS_TO_GRAMS;
                  const status =
                    lbs === 0 ? "out" : lbs < 5 ? "low" : "fresh";
                  return (
                    <tr
                      key={item.id}
                      className="border-b border-dashed border-fog last:border-0"
                    >
                      <td className="py-2.5 font-semibold text-espresso">
                        {item.name}
                      </td>
                      <td className="text-right font-mono font-bold text-espresso">
                        {lbs.toFixed(0)} lb
                      </td>
                      <td className="text-right py-2.5">
                        <Pill
                          variant={
                            status === "fresh"
                              ? "matcha"
                              : status === "low"
                              ? "sun"
                              : "espresso"
                          }
                        >
                          {status === "fresh"
                            ? "In Stock"
                            : status === "low"
                            ? "Low"
                            : "Out"}
                        </Pill>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Panel>

        {/* Recent Orders */}
        {isOwnerOrAdmin && (
          <Panel title="Recent Orders" action="All Orders" actionHref="/orders">
            {orders.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground text-sm font-bold tracking-wide uppercase">
                No orders yet
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {orders.map((order) => {
                  const statusVariant: Record<
                    string,
                    "tomato" | "sun" | "matcha" | "sky" | "fog"
                  > = {
                    paid: "sky",
                    pending: "sun",
                    refunded: "fog",
                    voided: "fog",
                    partially_paid: "sun",
                    authorized: "matcha",
                  };
                  const pill =
                    statusVariant[order.financial_status || ""] || "fog";
                  return (
                    <Link
                      key={order.id}
                      href={`/orders/${order.id}`}
                      className="flex items-center gap-2.5 p-2.5 border-[2.5px] border-espresso rounded-[10px] bg-cream hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-[4px_4px_0_#1C0F05] transition-all duration-100"
                    >
                      <div className="font-mono text-[11px] font-bold text-muted-foreground w-12 shrink-0">
                        #{String(order.id).slice(-4)}
                      </div>
                      <div className="flex-1 font-bold text-[13px] text-espresso truncate">
                        Order {new Date(order.created_at).toLocaleDateString()}
                      </div>
                      <div className="font-extrabold text-[16px] text-espresso w-16 text-right shrink-0">
                        ${(order.total_price || 0).toFixed(0)}
                      </div>
                      <Pill variant={pill}>
                        {order.financial_status || "pending"}
                      </Pill>
                    </Link>
                  );
                })}
              </div>
            )}
          </Panel>
        )}

        {/* Quick Actions for roasters */}
        {!isOwnerOrAdmin && (
          <Panel title="Quick Actions">
            <div className="flex flex-col gap-2">
              <Link
                href="/roasting"
                className="flex items-center gap-3 p-3 border-[2.5px] border-espresso rounded-[12px] bg-cream hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-[4px_4px_0_#1C0F05] transition-all duration-100"
              >
                <div className="w-9 h-9 bg-tomato border-[2.5px] border-espresso rounded-[10px] flex items-center justify-center shrink-0">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#FDFAF0"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
                  </svg>
                </div>
                <div>
                  <div className="font-bold text-[13px] text-espresso">Start a Roast</div>
                  <div className="text-[11px] text-muted-foreground">Log a new roasting batch</div>
                </div>
              </Link>
              <Link
                href="/inventory"
                className="flex items-center gap-3 p-3 border-[2.5px] border-espresso rounded-[12px] bg-cream hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-[4px_4px_0_#1C0F05] transition-all duration-100"
              >
                <div className="w-9 h-9 bg-espresso border-[2.5px] border-espresso rounded-[10px] flex items-center justify-center shrink-0">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#FDFAF0"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                    <polyline points="9 22 9 12 15 12 15 22" />
                  </svg>
                </div>
                <div>
                  <div className="font-bold text-[13px] text-espresso">Check Inventory</div>
                  <div className="text-[11px] text-muted-foreground">View green coffee stock</div>
                </div>
              </Link>
            </div>
          </Panel>
        )}
      </div>
    </div>
  );
}

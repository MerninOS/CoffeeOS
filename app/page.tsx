import { redirect } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { MobileNav } from "@/components/mobile-nav";
import {
  Package,
  BarChart2,
  RefreshCw,
  ShoppingBag,
  TrendingUp,
  ClipboardList,
  ArrowRight,
  Check,
  Zap,
  Shield,
  Star,
} from "lucide-react";

const C = {
  tomato:   "#E8442A",
  cream:    "#F5F0D8",
  espresso: "#1C0F05",
  sun:      "#F5C842",
  sky:      "#5BC8D5",
  chalk:    "#FDFAF0",
  roast:    "#3B1F0A",
  fog:      "#D8D0B8",
  matcha:   "#5A7A3A",
};

const MARQUEE_ITEMS = [
  "REAL-TIME COGS",
  "SHOPIFY SYNC",
  "ROAST BATCH PLANNING",
  "NO SPREADSHEETS",
  "MARGIN REPORTING",
  "LANDED COST TRACKING",
  "200+ ROASTERS",
];

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  const marqueeText = MARQUEE_ITEMS.join("  ✦  ") + "  ✦  " + MARQUEE_ITEMS.join("  ✦  ") + "  ✦  ";

  return (
    <main className="lp">

      {/* ── MARQUEE TOP BAR ─────────────────────────────────────── */}
      <div style={{ background: C.espresso, color: C.cream, padding: "10px 0", overflow: "hidden", whiteSpace: "nowrap" }}>
        <div className="lp-marquee-track" style={{ fontSize: "0.75rem", fontWeight: 800, letterSpacing: "0.12em" }}>
          {marqueeText}
        </div>
      </div>

      {/* ── NAV ─────────────────────────────────────────────────── */}
      <nav className="lp-nav">
        <div style={{ maxWidth: 1160, margin: "0 auto", padding: "0 24px", height: 66, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Link href="/">
            <Image alt="CoffeeOS" src="/coffee_os_logo.png" width={140} height={56} priority style={{ objectFit: "contain" }} />
          </Link>
          <div className="lp-nav-links">
            <Link href="#features" style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: C.espresso, textDecoration: "none" }}>Features</Link>
            <Link href="#shopify"  style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: C.espresso, textDecoration: "none" }}>Shopify</Link>
            <Link href="#pricing"  style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: C.espresso, textDecoration: "none" }}>Pricing</Link>
            <Link href="/auth/login" style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: C.espresso, textDecoration: "none" }}>Sign in</Link>
            <Link href="/auth/sign-up" className="lp-btn lp-btn-primary" style={{ padding: "9px 20px", fontSize: 12 }}>
              Get started free
            </Link>
          </div>
          <MobileNav />
        </div>
      </nav>

      {/* ── HERO ────────────────────────────────────────────────── */}
      <section style={{ background: C.tomato, padding: "80px 24px 96px", position: "relative", overflow: "hidden", borderBottom: `3px solid ${C.espresso}` }}>
        {/* Background tomato blob */}
        <div style={{ position: "absolute", top: -120, right: -120, width: 480, height: 480, borderRadius: "50%", background: C.tomato, opacity: 0.08, pointerEvents: "none" }} />

        <div className="lp-hero-grid" style={{ maxWidth: 1160, margin: "0 auto" }}>

          {/* Left — headline */}
          <div>
            <div className="lp-fade-up lp-d1" style={{ display: "inline-flex", alignItems: "center", gap: 8, background: C.sun, color: C.espresso, border: `2px solid ${C.espresso}`, borderRadius: 9999, padding: "4px 14px", fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 24, boxShadow: "2px 2px 0 #1C0F05" }}>
              ☕ Coffee Operations Software
            </div>

            <h1
              className="lp-fade-up lp-d2"
              style={{ fontFamily: "'Adore Cats', Fredoka, cursive", fontSize: "clamp(48px, 5.5vw, 70px)", lineHeight: 1.05, color: C.cream, marginBottom: 24 }}
            >
              Your Coffee Business's<br />
              <span style={{ color: C.sun }}>Operating System</span>
            </h1>

            <p className="lp-fade-up lp-d3" style={{ fontSize: 17, lineHeight: 1.75, color: C.cream, opacity: 0.7, maxWidth: 460, marginBottom: 36 }}>
              CoffeeOS connects inventory, roasting, and your Shopify store to deliver real-time COGS and margin data — without the spreadsheet chaos.
            </p>

            <div className="lp-fade-up lp-d4 lp-hero-ctas">
              <Link href="/auth/sign-up" className="lp-btn lp-btn-cream" style={{ fontSize: 14, padding: "13px 28px" }}>
                Start free — no card required <ArrowRight size={16} />
              </Link>
              <Link href="#features" className="lp-btn" style={{ fontSize: 14, padding: "13px 24px" }}>
                See how it works
              </Link>
            </div>

            {/* Trust row */}
            <div className="lp-fade-up lp-d5 lp-trust-row">
              <div className="lp-trust-stars">
                {Array.from({ length: 5 }).map((_, i) => <Star key={i} size={14} fill={C.tomato} color={C.tomato} />)}
              </div>
              <span style={{ fontSize: 13, fontWeight: 600, color: C.cream }}>Loved by coffee roasters</span>
              <span className="lp-tag" style={{ background: "#ffffffde", border: "2px solid #96BF48", color: "#4a7020", fontSize: 11, display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 12px" }}>
                <svg width="9" height="11" viewBox="0 0 14 16" fill="currentColor"><path d="M11.5 3.4c0-.1-.1-.1-.2-.1s-.9-.1-.9-.1-.7-.7-.8-.8V15l4-1S12 3.6 11.5 3.4zM8.3 2.2c-.2-.6-.6-1.2-1.3-1.2h-.2C6.5.4 6 .1 5.5.1 3.3.1 2.2 2.9 1.9 4.3H.7L0 15l9 1.6V2.5c-.3 0-.6-.1-.7-.3zm-1.5.4c-.5 0-.7-.3-.7-.5V2c.2-.7.7-1.3 1.2-1.4.5.4.8 1.2.9 1.9H6.8v.1z"/></svg>
                Shopify Partner
              </span>
            </div>
          </div>

          {/* Right — COGS dashboard mock */}
          <div className="lp-fade-up lp-d4 lp-hero-mock-wrapper">
            <div className="lp-mock">
              {/* Window bar */}
              <div className="lp-mock-bar" style={{ justifyContent: "space-between" }}>
                <div style={{ display: "flex", gap: 6 }}>
                  <div className="lp-dot" /><div className="lp-dot" /><div className="lp-dot" />
                </div>
                <span style={{ fontSize: 11, color: C.fog, fontWeight: 600, letterSpacing: "0.04em" }}>coffeeos.app / cogs-breakdown</span>
                <span className="lp-tag" style={{ background: "rgba(90,122,58,0.2)", border: `1px solid ${C.matcha}`, color: C.matcha, fontSize: 10, padding: "2px 8px" }}>live</span>
              </div>

              {/* Stat row */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", borderBottom: `2px solid ${C.fog}` }}>
                {[
                  { label: "Avg. Gross Margin", value: "67.4%", note: "↑ +3.2%", up: true },
                  { label: "Active SKUs",        value: "48",    note: null     },
                  { label: "Month COGS",         value: "$8,241",note: "↓ -1.1%", up: false },
                ].map((s, i) => (
                  <div key={i} style={{ padding: "14px 16px", borderRight: i < 2 ? `1px solid ${C.fog}` : "none" }}>
                    <div style={{ fontSize: 10, color: "#7A6A50", letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 700, marginBottom: 5 }}>{s.label}</div>
                    <div style={{ fontSize: 20, color: C.espresso, fontWeight: 700, fontFamily: "var(--font-mono)" }}>{s.value}</div>
                    {s.note && <div style={{ fontSize: 11, marginTop: 3, color: s.up ? C.matcha : C.tomato, fontWeight: 700 }}>{s.note}</div>}
                  </div>
                ))}
              </div>

              {/* Column headers */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 68px 68px 72px", gap: 12, padding: "7px 18px 5px", borderBottom: `1px solid ${C.fog}` }}>
                {["Product", "COGS", "Price", "Margin"].map(h => (
                  <span key={h} style={{ fontSize: 10, color: "#7A6A50", letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 800, textAlign: h !== "Product" ? "right" : "left" }}>{h}</span>
                ))}
              </div>

              {/* Data rows */}
              {[
                { name: "Ethiopia Yirgacheffe 250g",    cogs: "$4.18",  price: "$18.00", margin: "76.8%", tag: "green"  },
                { name: "Colombia Huila Espresso 500g", cogs: "$7.82",  price: "$24.00", margin: "67.4%", tag: "green"  },
                { name: "Brazil Cerrado Dark 1kg",      cogs: "$12.40", price: "$32.00", margin: "61.3%", tag: "sun"    },
                { name: "House Blend 250g",             cogs: "$5.65",  price: "$16.00", margin: "64.7%", tag: "sun"    },
                { name: "Decaf Swiss Water 250g",       cogs: "$8.90",  price: "$20.00", margin: "55.5%", tag: "muted"  },
              ].map((r, i) => (
                <div key={i} className="lp-row">
                  <span style={{ fontSize: 12.5, color: C.espresso, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</span>
                  <span style={{ fontSize: 12, color: "#7A6A50", textAlign: "right", fontFamily: "var(--font-mono)" }}>{r.cogs}</span>
                  <span style={{ fontSize: 12, color: "#7A6A50", textAlign: "right", fontFamily: "var(--font-mono)" }}>{r.price}</span>
                  <div style={{ textAlign: "right" }}>
                    <span className={`lp-tag lp-tag-${r.tag}`} style={{ fontSize: 10 }}>{r.margin}</span>
                  </div>
                </div>
              ))}

              {/* Footer */}
              <div style={{ padding: "10px 18px", borderTop: `2px solid ${C.fog}`, display: "flex", alignItems: "center", gap: 8 }}>
                <div className="lp-live-dot" />
                <span style={{ fontSize: 11, color: "#7A6A50", fontWeight: 600 }}>Synced with Shopify · 2 min ago</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── BRAND BAR ───────────────────────────────────────────── */}
      <div style={{ background: C.espresso, padding: "20px 24px", borderBottom: `3px solid ${C.espresso}` }}>
        <div style={{ maxWidth: 1160, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "center", gap: 48, flexWrap: "wrap" }}>
          <span style={{ fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: C.fog, fontWeight: 700 }}>Trusted by</span>
          {["Mernin' Coffee Company", "Olympia Coffee", "Heart Coffee", "Verve Coffee", "Stumptown D2C"].map((name, i) => (
            <span key={i} style={{ fontSize: 14, color: C.cream, fontWeight: 600, letterSpacing: "0.02em" }}>{name}</span>
          ))}
        </div>
      </div>

      {/* ── FEATURES ────────────────────────────────────────────── */}
      <section id="features" style={{ background: C.cream, padding: "96px 24px", borderBottom: `3px solid ${C.espresso}` }}>
        <div style={{ maxWidth: 1160, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 60 }}>
            <p className="lp-eyebrow" style={{ marginBottom: 14 }}>Core Features</p>
            <h2 style={{ fontFamily: "'Adore Cats', Fredoka, cursive", fontSize: "clamp(36px, 4vw, 56px)", color: C.espresso, marginBottom: 16, lineHeight: 1.08 }}>
              Built for the way<br />roasters actually work
            </h2>
            <p style={{ fontSize: 16, color: C.espresso, opacity: 0.65, maxWidth: 480, margin: "0 auto", lineHeight: 1.75 }}>
              From green coffee intake to final sale — every cost tracked automatically.
            </p>
          </div>

          <div className="lp-features-grid">
            {[
              { icon: <Package size={18} />,     title: "Real-Time Inventory",    desc: "Track green coffee, roasted stock, and packaging across all SKUs. Automatic adjustments on every sale and roast batch." },
              { icon: <BarChart2 size={18} />,    title: "COGS Per SKU",           desc: "Know the true cost of every bag — green bean cost, roast loss, labor, and packaging — broken down per product, automatically." },
              { icon: <TrendingUp size={18} />,   title: "Margin Reporting",       desc: "Gross margin by product, roast, channel, or time period. Spot your most profitable offerings at a glance." },
              { icon: <RefreshCw size={18} />,    title: "Shopify Sync",           desc: "Two-way sync with your Shopify store. Products, inventory levels, and order data stay accurate automatically." },
              { icon: <ClipboardList size={18} />,title: "Roasting Cost",        desc: "Understand the exact cost per gram of your coffee after roasting fees and weight lost, so you know exactly how much your coffee cost." },
              { icon: <ShoppingBag size={18} />,  title: "Roast Batch Planning",   desc: "Plan batches from demand signals. Track yield, roast loss, and batch cost from pull to pack." },
            ].map((feat, i) => (
              <div key={i} className="lp-card" style={{ padding: "28px" }}>
                <div className="lp-icon">{feat.icon}</div>
                <h3 style={{ fontSize: 17, fontWeight: 800, color: C.espresso, marginBottom: 10, letterSpacing: "-0.01em" }}>{feat.title}</h3>
                <p style={{ fontSize: 13.5, color: C.espresso, opacity: 0.65, lineHeight: 1.7 }}>{feat.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── COGS SPOTLIGHT (tomato) ──────────────────────────────── */}
      <section style={{ background: C.tomato, color: C.cream, padding: "96px 24px", borderBottom: `3px solid ${C.espresso}` }}>
        <div className="lp-cogs-grid" style={{ maxWidth: 1160, margin: "0 auto" }}>

          {/* Left — copy */}
          <div>
            <p className="lp-eyebrow" style={{ color: C.sun, marginBottom: 18 }}>Cost of Goods Sold</p>
            <h2 style={{ fontFamily: "'Adore Cats', Fredoka, cursive", fontSize: "clamp(32px, 3.8vw, 52px)", color: C.cream, marginBottom: 20, lineHeight: 1.08 }}>
              Finally know your<br />
              <span style={{ color: C.sun }}>true cost per bag.</span>
            </h2>
            <p style={{ fontSize: 16, color: "rgba(245,240,216,0.8)", lineHeight: 1.78, marginBottom: 32 }}>
              Most coffee businesses underestimate COGS by 15–30% because they&apos;re missing roast loss, packaging, or labor. CoffeeOS builds the full picture automatically.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                "Green bean cost with full landed cost (freight + duty)",
                "Roast loss percentage applied per batch automatically",
                "Packaging, labels, and fulfillment costs per unit",
                "Allocated labor cost distributed across each roast batch",
                "Automatic margin recalculation on every Shopify sale",
              ].map((item, i) => (
                <div key={i} className="lp-check" style={{ color: C.cream }}>
                  <div className="lp-check-icon" style={{ background: "rgba(245,240,216,0.15)", border: `2px solid ${C.cream}`, color: C.cream }}>
                    <Check size={10} strokeWidth={3} />
                  </div>
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right — COGS breakdown mock */}
          <div>
            <div style={{ background: C.chalk, border: `5px solid ${C.espresso}`, borderRadius: 20, boxShadow: `8px 8px 0 ${C.espresso}`, overflow: "hidden" }}>
              <div style={{ background: C.espresso, padding: "11px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", gap: 6 }}>
                  <div className="lp-dot" /><div className="lp-dot" /><div className="lp-dot" />
                </div>
                <span style={{ fontSize: 11, color: C.fog, fontWeight: 600 }}>COGS Breakdown — Ethiopia Yirgacheffe 250g</span>
                <span className="lp-tag lp-tag-green" style={{ fontSize: 10 }}>76.8% margin</span>
              </div>

              <div style={{ padding: "20px 20px 8px" }}>
                {[
                  { label: "Green bean cost",    value: "$2.10", pct: 50   },
                  { label: "Roast loss (14.2%)", value: "$0.35", pct: 8.5  },
                  { label: "Packaging & label",  value: "$0.48", pct: 11.5 },
                  { label: "Allocated labor",    value: "$0.82", pct: 19.5 },
                  { label: "Fulfillment (avg)",  value: "$0.43", pct: 10   },
                ].map((item, i) => (
                  <div key={i} style={{ marginBottom: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 13, color: C.espresso, fontWeight: 600 }}>{item.label}</span>
                      <span style={{ fontSize: 12.5, color: "#7A6A50", fontFamily: "var(--font-mono)" }}>{item.value}</span>
                    </div>
                    <div className="lp-bar-bg">
                      <div className="lp-bar-fill" style={{ width: `${item.pct}%` }} />
                    </div>
                  </div>
                ))}

                <hr style={{ border: "none", borderTop: `2px solid ${C.fog}`, margin: "16px 0" }} />

                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ fontSize: 14, color: C.espresso, fontWeight: 700 }}>Total COGS</span>
                  <span style={{ fontSize: 15, color: C.espresso, fontWeight: 800, fontFamily: "var(--font-mono)" }}>$4.18</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
                  <span style={{ fontSize: 13, color: "#7A6A50" }}>Shopify sale price</span>
                  <span style={{ fontSize: 13, color: "#7A6A50", fontFamily: "var(--font-mono)" }}>$18.00</span>
                </div>

                <div style={{ background: "rgba(90,122,58,0.1)", border: `2px solid ${C.matcha}`, borderRadius: 12, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <span style={{ fontSize: 14, color: C.matcha, fontWeight: 700 }}>Gross Margin</span>
                  <span style={{ fontSize: 16, color: C.matcha, fontWeight: 800, fontFamily: "var(--font-mono)" }}>$13.82 · 76.8%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── SHOPIFY INTEGRATION ─────────────────────────────────── */}
      <section id="shopify" style={{ background: C.cream, padding: "96px 24px", borderBottom: `3px solid ${C.espresso}` }}>
        <div style={{ maxWidth: 1160, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 60 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(150,191,72,0.12)", border: "2px solid #96BF48", color: "#4a7020", borderRadius: 9999, padding: "4px 14px", fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 20 }}>
              <svg width="9" height="11" viewBox="0 0 14 16" fill="currentColor"><path d="M11.5 3.4c0-.1-.1-.1-.2-.1s-.9-.1-.9-.1-.7-.7-.8-.8V15l4-1S12 3.6 11.5 3.4zM8.3 2.2c-.2-.6-.6-1.2-1.3-1.2h-.2C6.5.4 6 .1 5.5.1 3.3.1 2.2 2.9 1.9 4.3H.7L0 15l9 1.6V2.5c-.3 0-.6-.1-.7-.3zm-1.5.4c-.5 0-.7-.3-.7-.5V2c.2-.7.7-1.3 1.2-1.4.5.4.8 1.2.9 1.9H6.8v.1z"/></svg>
              Shopify Integration
            </div>
            <h2 style={{ fontFamily: "'Adore Cats', Fredoka, cursive", fontSize: "clamp(32px, 3.8vw, 52px)", color: C.espresso, marginBottom: 14, lineHeight: 1.08 }}>
              Your Shopify store,<br />
              <span style={{ color: C.tomato }}>fully connected.</span>
            </h2>
            <p style={{ fontSize: 16, color: C.espresso, opacity: 0.65, maxWidth: 480, margin: "0 auto", lineHeight: 1.75 }}>
              Connect in minutes. CoffeeOS pulls your products, syncs inventory, and calculates COGS on every order automatically.
            </p>
          </div>

          <div className="lp-shopify-grid">

            {/* Sync status mock */}
            <div className="lp-mock">
              <div className="lp-mock-bar" style={{ justifyContent: "space-between" }}>
                <div style={{ display: "flex", gap: 6 }}>
                  <div className="lp-dot" /><div className="lp-dot" /><div className="lp-dot" />
                </div>
                <span style={{ fontSize: 11, color: C.fog, fontWeight: 600 }}>Shopify Sync Status</span>
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <div className="lp-live-dot" style={{ width: 7, height: 7 }} />
                  <span style={{ fontSize: 10.5, color: C.matcha, fontWeight: 700 }}>Connected</span>
                </div>
              </div>

              <div style={{ padding: "6px 0 4px" }}>
                {[
                  { label: "Products synced",    val: "48 / 48",  tag: "green",  icon: "✓" },
                  { label: "Inventory updated",  val: "Just now", tag: "green",  icon: "✓" },
                  { label: "New orders imported",val: "3 orders", tag: "sun",    icon: "→" },
                  { label: "COGS calculated",    val: "47 / 48",  tag: "green",  icon: "✓" },
                  { label: "Low-margin alert",   val: "1 warning",tag: "muted",  icon: "!" },
                ].map((row, i, arr) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 20px", borderBottom: i < arr.length - 1 ? `1px solid ${C.fog}` : "none" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span className={`lp-tag lp-tag-${row.tag}`} style={{ width: 24, height: 24, display: "inline-flex", alignItems: "center", justifyContent: "center", padding: 0, borderRadius: 6, fontSize: 13 }}>{row.icon}</span>
                      <span style={{ fontSize: 13, color: C.espresso, fontWeight: 600 }}>{row.label}</span>
                    </div>
                    <span style={{ fontSize: 12, color: "#7A6A50", fontFamily: "var(--font-mono)" }}>{row.val}</span>
                  </div>
                ))}
              </div>

              <div style={{ padding: "13px 20px", borderTop: `2px solid ${C.fog}`, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                {[{ label: "Last full sync", val: "Today, 9:41 AM" }, { label: "Sync frequency", val: "Every 15 min" }].map((s, i) => (
                  <div key={i}>
                    <div style={{ fontSize: 10, color: "#7A6A50", letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 800, marginBottom: 5 }}>{s.label}</div>
                    <div style={{ fontSize: 13, color: C.espresso, fontWeight: 700, fontFamily: "var(--font-mono)" }}>{s.val}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Feature bullets */}
            <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
              {[
                { icon: <Zap size={18} />,      title: "One-click connection",          desc: "Authorize CoffeeOS from your Shopify Partner dashboard. No manual CSV exports or API keys to manage." },
                { icon: <RefreshCw size={18} />, title: "Automatic inventory deduction", desc: "Every Shopify order deducts from your raw material inventory, keeping stock levels accurate in real time." },
                { icon: <BarChart2 size={18} />, title: "COGS on every order line",      desc: "Each order gets exact COGS and margin calculated per line item, based on current cost data." },
                { icon: <Shield size={18} />,    title: "Safe and read-only by default", desc: "CoffeeOS reads your Shopify data and writes back only inventory levels — your listings stay untouched." },
              ].map((item, i) => (
                <div key={i} style={{ display: "flex", gap: 16 }}>
                  <div className="lp-icon" style={{ marginBottom: 0 }}>{item.icon}</div>
                  <div>
                    <h3 style={{ fontSize: 15.5, fontWeight: 800, color: C.espresso, marginBottom: 6 }}>{item.title}</h3>
                    <p style={{ fontSize: 13.5, color: C.espresso, opacity: 0.65, lineHeight: 1.7 }}>{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS (espresso) ──────────────────────────────── */}
      <section style={{ background: C.espresso, color: C.cream, padding: "96px 24px", borderBottom: `3px solid ${C.espresso}` }}>
        <div style={{ maxWidth: 1160, margin: "0 auto" }}>
          <p className="lp-eyebrow" style={{ textAlign: "center", color: C.sun, marginBottom: 14 }}>What roasters say</p>
          <h2 style={{ fontFamily: "'Adore Cats', Fredoka, cursive", fontSize: "clamp(32px, 3.5vw, 48px)", color: C.cream, textAlign: "center", marginBottom: 52, lineHeight: 1.1 }}>
            Built with the people using it.
          </h2>

          <div className="lp-three-col-grid">
            {[
              { quote: "We were guessing at our margins for years. CoffeeOS showed us we were underpricing our 250g bags by almost 20%. We fixed it within a week.", name: "Sarah K.", title: "Owner, Northlight Roasters" },
              { quote: "The Shopify integration alone is worth it. Every order syncs, inventory stays accurate, and I can see COGS without touching a single spreadsheet.", name: "Marcus T.", title: "Head Roaster, Parallel Coffee" },
              { quote: "We scaled from a farmer's market to full e-commerce in one year. CoffeeOS scaled with us — the roast batch planning is exceptional.", name: "Priya D.", title: "Co-founder, Dusk Coffee Co." },
            ].map((t, i) => (
              <div key={i} style={{ background: C.roast, border: `4px solid ${C.cream}`, borderRadius: 20, padding: "28px", boxShadow: `5px 5px 0 ${C.tomato}`, transition: "transform 150ms, box-shadow 150ms" }}>
                <div style={{ display: "flex", gap: 3, marginBottom: 16 }}>
                  {Array.from({ length: 5 }).map((_, j) => <Star key={j} size={13} fill={C.sun} color={C.sun} />)}
                </div>
                <p style={{ fontSize: 16, color: C.cream, lineHeight: 1.7, marginBottom: 22, fontStyle: "italic" }}>
                  &ldquo;{t.quote}&rdquo;
                </p>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: C.cream }}>{t.name}</div>
                  <div style={{ fontSize: 13, color: C.fog, marginTop: 3 }}>{t.title}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ─────────────────────────────────────────────── */}
      <section id="pricing" style={{ background: C.cream, padding: "96px 24px", borderBottom: `3px solid ${C.espresso}` }}>
        <div style={{ maxWidth: 1160, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 60 }}>
            <p className="lp-eyebrow" style={{ marginBottom: 14 }}>Pricing</p>
            <h2 style={{ fontFamily: "'Adore Cats', Fredoka, cursive", fontSize: "clamp(32px, 3.8vw, 52px)", color: C.espresso, marginBottom: 14, lineHeight: 1.08 }}>
              Simple, transparent pricing.
            </h2>
            <p style={{ fontSize: 16, color: C.espresso, opacity: 0.65 }}>
              No setup fees. No per-seat nonsense. Cancel anytime.
            </p>
          </div>

          <div className="lp-pricing-grid">
            {[
              {
                name: "Starter", price: "$0", featured: false,
                desc: "For small roasters getting started with real numbers.",
                features: ["Up to 3 SKUs", "COGS calculation", "Basic margin reporting", "Inventory tracking", "Email support"],
              },
              {
                name: "Growth", price: "$15", featured: true,
                desc: "For growing operations that need deeper cost visibility.",
                features: ["Up to 150 SKUs", "Everything in Starter", "Roast batch planning", "Priority support"],
              },
              {
                name: "Scale", price: "$100", featured: false,
                desc: "For multi-channel roasteries and high-volume operations.",
                features: ["Unlimited SKUs", "Unlimited stores", "Everything in Growth", "Team access (5 seats)", "API access", "Custom reporting", "Dedicated onboarding"],
              },
            ].map((plan, i) => (
              <div key={i} className={`lp-price-card${plan.featured ? " featured" : ""}`}>
                {plan.featured && (
                  <div style={{ position: "absolute", top: -16, left: "50%", transform: "translateX(-50%)", background: C.sun, color: C.espresso, border: `3px solid ${C.espresso}`, fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", padding: "5px 16px", borderRadius: 9999, whiteSpace: "nowrap", boxShadow: `2px 2px 0 ${C.espresso}` }}>
                    ✦ Most Popular ✦
                  </div>
                )}
                <div style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 800, color: plan.featured ? "rgba(245,240,216,0.7)" : "#7A6A50", marginBottom: 8 }}>{plan.name}</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 8 }}>
                  <span style={{ fontFamily: "'Adore Cats', Fredoka, cursive", fontSize: 56, lineHeight: 1, color: plan.featured ? C.cream : C.espresso }}>{plan.price}</span>
                  <span style={{ fontSize: 14, color: plan.featured ? "rgba(245,240,216,0.7)" : "#7A6A50" }}>/mo</span>
                </div>
                <p className="lp-muted-text" style={{ fontSize: 13.5, color: plan.featured ? "rgba(245,240,216,0.8)" : "#7A6A50", lineHeight: 1.6, marginBottom: 22 }}>{plan.desc}</p>
                <Link
                  href="/auth/sign-up"
                  className={plan.featured ? "lp-btn lp-btn-cream" : "lp-btn lp-btn-secondary"}
                  style={{ display: "block", textAlign: "center", marginBottom: 24, padding: "11px 16px", fontSize: 13 }}
                >
                  Start free trial
                </Link>
                <hr style={{ border: "none", borderTop: plan.featured ? "1px solid rgba(245,240,216,0.3)" : `1px solid ${C.fog}`, marginBottom: 22 }} />
                <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
                  {plan.features.map((feat, j) => (
                    <div key={j} className="lp-check" style={{ color: plan.featured ? C.cream : C.espresso }}>
                      <div className="lp-check-icon" style={plan.featured ? { background: "rgba(245,240,216,0.15)", border: `2px solid ${C.cream}`, color: C.cream } : undefined}>
                        <Check size={10} strokeWidth={3} />
                      </div>
                      <span style={{ fontSize: 13 }}>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA (tomato) ────────────────────────────────────────── */}
      <section style={{ background: C.tomato, color: C.cream, padding: "96px 24px", borderBottom: `3px solid ${C.espresso}` }}>
        <div style={{ maxWidth: 680, margin: "0 auto", textAlign: "center" }}>
          <h2 style={{ fontFamily: "'Adore Cats', Fredoka, cursive", fontSize: "clamp(38px, 5vw, 68px)", color: C.cream, marginBottom: 20, lineHeight: 1.05 }}>
            Stop guessing.<br />
            <span style={{ color: C.sun }}>Start knowing.</span>
          </h2>
          <p style={{ fontSize: 17, color: "rgba(245,240,216,0.85)", lineHeight: 1.75, marginBottom: 36 }}>
            Join hundreds of roasters who&apos;ve replaced their margin spreadsheets with CoffeeOS. Free 14-day trial. No credit card required.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/auth/sign-up" className="lp-btn lp-btn-cream" style={{ fontSize: 15, padding: "14px 30px" }}>
              Get started for free <ArrowRight size={17} />
            </Link>
            <Link href="#pricing" className="lp-btn" style={{ fontSize: 15, padding: "14px 26px", background: "transparent", color: C.cream, borderColor: C.cream, boxShadow: `3px 3px 0 ${C.espresso}` }}>
              View pricing
            </Link>
          </div>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────────── */}
      <footer style={{ background: C.espresso, color: C.cream, padding: "52px 24px 0", borderTop: `3px solid ${C.espresso}` }}>
        <div className="lp-footer-grid" style={{ maxWidth: 1160, margin: "0 auto" }}>
          <div>
            <Image alt="CoffeeOS" src="/coffee_os_logo.png" width={120} height={48} style={{ objectFit: "contain", marginBottom: 16, filter: "brightness(0) invert(1)" }} />
            <p style={{ fontSize: 13.5, color: C.fog, lineHeight: 1.65, maxWidth: 280 }}>
              Inventory management and COGS software built specifically for D2C coffee roasters.
            </p>
          </div>

          {[
            { heading: "Product",  links: [{ label: "Features", href: "#features" }, { label: "Shopify", href: "#shopify" }, { label: "Pricing", href: "#pricing" }] },
            { heading: "Account",  links: [{ label: "Sign in", href: "/auth/login" }, { label: "Sign up", href: "/auth/sign-up" }] },
            { heading: "Legal",    links: [{ label: "Privacy Policy", href: "/privacy-policy" }] },
          ].map((col, i) => (
            <div key={i}>
              <div style={{ fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: C.fog, fontWeight: 800, marginBottom: 16 }}>{col.heading}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {col.links.map((lnk, j) => (
                  <Link key={j} href={lnk.href} style={{ fontSize: 14, color: C.cream, opacity: 0.75, textDecoration: "none", fontWeight: 500, transition: "opacity 0.15s" }}>
                    {lnk.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="lp-footer-bottom">
          <span style={{ fontSize: 12.5, color: C.fog }}>© 2026 CoffeeOS. All rights reserved.</span>
          <span style={{ fontSize: 10, color: C.fog, letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 700 }}>Roasted with ☕ in Austin, TX</span>
        </div>
      </footer>

    </main>
  );
}

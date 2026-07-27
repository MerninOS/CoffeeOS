'use client'

/**
 * TEMPORARY — delete before the P1 PR.
 *
 * Renders instrument components so the design direction can be reviewed before
 * P1 commits to converting real pages. Not linked from anywhere.
 *
 * 'use client' is REQUIRED, and not incidentally: @merninos/ui/instrument marks
 * its whole barrel as client (esbuild drops per-module directives when bundling),
 * so a server component cannot pass DataTable's `render` callbacks across the
 * boundary — it throws "Functions cannot be passed directly to Client
 * Components". Real pages hit this too; CoffeeOS's page.tsx / *-client.tsx split
 * already puts this kind of code on the client, so it costs nothing here.
 */
import {
  AppShell, Button, IconButton, Badge, Input, Select, SegmentedControl,
  DataTable, HeroMetric, StatStrip, Tabs, EmptyState, Kbd, InlineBanner,
} from '@merninos/ui/instrument'

const NAV = [
  {
    group: 'Workspace',
    items: [
      { id: 'orders', label: 'Orders', badge: 12 },
      { id: 'batches', label: 'Batches' },
      { id: 'wholesale', label: 'Wholesale' },
    ],
  },
  {
    group: 'Resources',
    items: [
      { id: 'inventory', label: 'Green inventory' },
      { id: 'products', label: 'Products' },
    ],
  },
]

const ORDERS = [
  { id: '#4821', customer: 'Aya Tanaka', channel: 'DTC', items: 2, total: '$48.00', status: 'open', date: 'Jul 22' },
  { id: '#4820', customer: 'Rook & Vine Café', channel: 'Wholesale', items: 24, total: '$612.00', status: 'roasting', date: 'Jul 22' },
  { id: '#4819', customer: 'Marcus Bell', channel: 'DTC', items: 1, total: '$21.00', status: 'open', date: 'Jul 21' },
  { id: '#4818', customer: 'North Pier Roasters', channel: 'Wholesale', items: 40, total: '$980.00', status: 'fulfilled', date: 'Jul 21' },
  { id: '#4817', customer: 'Priya Nair', channel: 'DTC', items: 3, total: '$63.50', status: 'fulfilled', date: 'Jul 20' },
  { id: '#4816', customer: 'Sam Okafor', channel: 'DTC', items: 2, total: '$44.00', status: 'cancelled', date: 'Jul 20' },
]

// No `pulse`. The design system offers it for a "currently roasting" badge, but
// CoffeeOS has no live layer — no polling, no realtime, no timer, no status column
// on roasting_sessions — so a pulsing indicator would animate over a value that
// only changes on page load. Ruled out until real live data exists; enforced by
// tests/e2e/design-rulings.spec.ts.
const TONE: Record<string, { tone: string; label: string }> = {
  open: { tone: 'warning', label: 'Open' },
  roasting: { tone: 'brand', label: 'Roasting' },
  fulfilled: { tone: 'success', label: 'Fulfilled' },
  cancelled: { tone: 'neutral', label: 'Cancelled' },
}

const overline: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontVariationSettings: 'var(--overline-settings)',
  fontWeight: 'var(--overline-weight)' as unknown as number,
  textTransform: 'uppercase',
  letterSpacing: 'var(--overline-tracking)',
  fontSize: 'var(--fs-overline)',
  color: 'var(--ink-subtle)',
}

export default function InstrumentPreview() {
  const columns = [
    { key: 'id', header: 'Order', mono: true, sortable: true, width: 90 },
    {
      key: 'customer',
      header: 'Customer',
      sortable: true,
      render: (v: string, r: (typeof ORDERS)[number]) => (
        <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.25 }}>
          <span style={{ fontWeight: 500 }}>{v}</span>
          <span style={overline}>{r.channel}</span>
        </span>
      ),
    },
    { key: 'items', header: 'Items', mono: true, align: 'right' as const, sortable: true, width: 70 },
    { key: 'total', header: 'Total', mono: true, align: 'right' as const, sortable: true, width: 100 },
    {
      key: 'status',
      header: 'Status',
      width: 130,
      render: (v: string) => (
        <Badge tone={TONE[v].tone as never} dot>
          {TONE[v].label}
        </Badge>
      ),
    },
    { key: 'date', header: 'Date', mono: true, align: 'right' as const, width: 80 },
  ]

  return (
    <AppShell
      product="Roasting"
      activeId="orders"
      nav={NAV}
      breadcrumbs={[{ label: 'Roasting' }, { label: 'Orders' }]}
    >
      <div style={{ maxWidth: 'var(--content-max)', margin: '0 auto', padding: 24 }}>
        <InlineBanner tone="info" title="Preview">
          Temporary route for reviewing the instrument design system. Delete before P1.
        </InlineBanner>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, margin: '24px 0' }}>
          <div>
            <h1
              style={{
                fontFamily: 'var(--font-display)',
                fontVariationSettings: 'var(--display-settings)',
                fontWeight: 'var(--display-weight)' as unknown as number,
                letterSpacing: 'var(--display-tracking)',
                fontSize: 'var(--fs-display)',
                textTransform: 'uppercase',
                color: 'var(--ink)',
              }}
            >
              Orders
            </h1>
            <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-body)', color: 'var(--ink-muted)', marginTop: 6 }}>
              Accept, roast, and fulfill orders across DTC and wholesale.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <Button variant="secondary">Export</Button>
            <Button variant="primary">Create order</Button>
          </div>
        </div>

        {/* One hero figure + a ruled strip — never a row of equal KPI cards. */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'end', marginBottom: 24 }}>
          <div style={{ flex: '0 0 260px' }}>
            <HeroMetric label="Open orders" value="12" delta="+3" note="awaiting action today" />
          </div>
          <div style={{ flex: '1 1 480px', minWidth: 0 }}>
            <StatStrip
              stats={[
                { label: 'Revenue · 30d', value: '23,840', unit: 'USD', delta: '+4.2%' },
                { label: 'Fulfillment', value: '96.4', unit: '%', delta: '-0.8%', deltaDir: 'down' },
                { label: 'Roasting now', value: '1', tone: 'live' },
                { label: 'Avg roast queue', value: '2.1', unit: 'days', delta: '-0.3', deltaDir: 'down' },
              ]}
            />
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <Tabs
            value="open"
            tabs={[
              { value: 'open', label: 'Open', count: 3 },
              { value: 'fulfilled', label: 'Fulfilled', count: 2 },
              { value: 'all', label: 'All' },
            ]}
          />
        </div>

        {/* Filter bar — a genuinely modular bordered container, the exception
            to "no nested cards". */}
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: 10, flexWrap: 'wrap',
            background: 'var(--surface-sunken)', border: '1px solid var(--hairline)',
            borderRadius: 'var(--r-md)', marginBottom: 16,
          }}
        >
          <div style={{ flex: '1 1 220px', minWidth: 180, maxWidth: 300 }}>
            <Input size="sm" mono placeholder="Order # or customer" />
          </div>
          <SegmentedControl
            size="sm"
            value="all"
            options={[
              { value: 'all', label: 'All' },
              { value: 'dtc', label: 'DTC' },
              { value: 'wholesale', label: 'Wholesale' },
            ]}
          />
          <div style={{ width: 150 }}>
            <Select size="sm" defaultValue="">
              <option value="">Any roast</option>
              <option>Light</option>
              <option>Medium</option>
              <option>Dark</option>
            </Select>
          </div>
        </div>

        <DataTable columns={columns as never} rows={ORDERS} selectable rowKey="id" />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-caption)', color: 'var(--ink-muted)' }}>
            6 of 6 orders · <Kbd>⌘K</Kbd> to jump
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            <Button size="sm" variant="secondary" disabled>Prev</Button>
            <Button size="sm" variant="secondary">Next</Button>
          </div>
        </div>

        <div style={{ marginTop: 40, paddingTop: 24, borderTop: '1px solid var(--hairline)' }}>
          <div style={{ ...overline, marginBottom: 12 }}>Empty state</div>
          <EmptyState
            title="No orders match"
            description="Try clearing the search or switching channels to see more orders."
            action={<Button variant="secondary">Clear filters</Button>}
          />
        </div>
      </div>
    </AppShell>
  )
}

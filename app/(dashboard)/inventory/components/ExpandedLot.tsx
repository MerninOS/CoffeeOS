"use client";

import { InlineBanner } from "@merninos/ui/instrument";
import { mono, overline, sans, money } from "@/lib/instrument/tokens";
import { gramsToLbs } from "@/lib/inventory/units";
import { deltaLabel, type Movement } from "@/lib/inventory/movements";
import type { CoffeeInventory } from "./types";

/**
 * One lot's movement history, plus the facts the row cannot hold.
 *
 * The panel exists because `coffee_inventory_changes` has been written since the
 * feature shipped and read by nothing — lot traceability, which is the job this
 * screen exists to do, was already in the database and invisible.
 *
 * IT IS LABELLED "GREEN MOVEMENTS" AND SAYS WHY. `roasted_stock_g` is mutated
 * when a batch finishes (`roasting/actions.ts`) and when an order is packed
 * (`orders/[id]/actions.ts`), and NEITHER writes a change row. The note says the
 * rows are never written rather than that the schema cannot hold them — the
 * column `roasted_quantity_change_g` exists; the two call sites simply skip it.
 * Getting that wrong in either direction misdescribes the gap to whoever fixes
 * it (spec Criterion 16).
 *
 * A TRUNCATED LIST SAYS SO. The query caps at 20. A provenance panel that
 * silently omits history contradicts the argument the rest of this ticket makes,
 * so `hasMore` is rendered rather than swallowed.
 */
export function ExpandedLot({
  lot,
  movements,
  hasMore,
  isLoading,
  error,
}: {
  lot: CoffeeInventory;
  movements: Movement[] | null;
  hasMore: boolean;
  isLoading: boolean;
  error: string | null;
}) {
  const caption: React.CSSProperties = {
    ...mono,
    fontSize: "var(--fs-caption)",
    color: "var(--ink-muted)",
    whiteSpace: "nowrap",
  };

  return (
    <div
      data-testid="lot-expanded"
      className="grid grid-cols-1 min-[1180px]:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-8"
      style={{
        padding: "20px 16px 24px 16px",
        background: "var(--surface-sunken)",
        borderBottom: "1px solid var(--hairline-strong)",
      }}
    >
      <div>
        <div style={{ ...overline, marginBottom: 10 }}>Green movements</div>

        {error && <InlineBanner tone="danger" title={error} />}

        {!error && isLoading && (
          <p style={{ ...sans, fontSize: "var(--fs-body)", color: "var(--ink-muted)", margin: 0 }}>
            Loading movements…
          </p>
        )}

        {!error && !isLoading && movements?.length === 0 && (
          <p style={{ ...sans, fontSize: "var(--fs-body)", color: "var(--ink-muted)", margin: 0 }}>
            No movements recorded since this lot was received.
          </p>
        )}

        {!error && !isLoading && !!movements?.length && (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <tbody>
              {movements.map((m, i) => (
                <tr
                  key={m.id}
                  data-testid="movement-row"
                  style={{
                    borderBottom:
                      i === movements.length - 1 ? "none" : "1px solid var(--hairline)",
                  }}
                >
                  <td style={{ ...caption, padding: "8px 12px 8px 0" }}>
                    {new Date(m.at).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </td>
                  <td
                    style={{
                      ...sans,
                      fontSize: "var(--fs-body)",
                      color: "var(--ink)",
                      padding: "8px 12px 8px 0",
                    }}
                  >
                    {m.label}
                    <span
                      style={{
                        ...mono,
                        fontSize: "var(--fs-caption)",
                        color: "var(--ink-subtle)",
                        marginLeft: 8,
                      }}
                    >
                      {m.source}
                    </span>
                    {m.note && (
                      <div
                        style={{
                          ...sans,
                          fontSize: "var(--fs-caption)",
                          color: "var(--ink-muted)",
                          marginTop: 2,
                        }}
                      >
                        {m.note}
                      </div>
                    )}
                  </td>
                  <td
                    style={{
                      ...caption,
                      color: "var(--ink-subtle)",
                      padding: "8px 12px 8px 0",
                    }}
                  >
                    {m.actor}
                  </td>
                  <td
                    data-testid="movement-delta"
                    style={{
                      ...mono,
                      fontSize: "var(--fs-data)",
                      textAlign: "right",
                      whiteSpace: "nowrap",
                      padding: "8px 0",
                      // A cost change carries no pound delta and must not read
                      // as one; it is not counted toward any quantity total.
                      color:
                        m.kind === "price"
                          ? "var(--ink-muted)"
                          : (m.deltaLbs ?? 0) < 0
                            ? "var(--ink)"
                            : "var(--success)",
                    }}
                  >
                    {m.kind === "price"
                      ? `${money(m.oldPrice ?? 0)} → ${money(m.newPrice ?? 0)}`
                      : deltaLabel(m.deltaLbs ?? 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {hasMore && (
          <p
            data-testid="movements-truncated"
            style={{
              ...sans,
              fontSize: "var(--fs-caption)",
              color: "var(--ink-muted)",
              marginTop: 12,
              marginBottom: 0,
            }}
          >
            Showing the 20 most recent movements. Older history is not shown.
          </p>
        )}

        <p
          style={{
            ...sans,
            fontSize: "var(--fs-caption)",
            color: "var(--ink-muted)",
            marginTop: 12,
            marginBottom: 0,
          }}
        >
          <span style={{ color: "var(--warning)", fontWeight: 600 }}>△</span> Green
          only. Roasted stock moves when a batch finishes and when an order is
          packed, and neither writes a change row today.
        </p>
      </div>

      <div>
        <div style={{ ...overline, marginBottom: 10 }}>Lot</div>
        <dl
          className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 items-baseline"
          style={{ margin: 0 }}
        >
          {(
            [
              ["Lot code", lot.lot_code],
              ["Origin", lot.origin],
              ["Supplier", lot.supplier],
              ["Purchased", lot.purchase_date],
              ["Received", `${gramsToLbs(lot.initial_quantity_g).toFixed(1)} lb`],
              ["Cost basis", `${money(lot.price_per_lb)} / lb`],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="contents">
              <dt style={{ ...overline, margin: 0 }}>{label}</dt>
              <dd
                style={{
                  ...mono,
                  fontSize: "var(--fs-body)",
                  color: value ? "var(--ink)" : "var(--ink-subtle)",
                  margin: 0,
                }}
              >
                {value || "—"}
              </dd>
            </div>
          ))}
        </dl>

        {lot.notes && (
          <>
            <div style={{ ...overline, margin: "18px 0 6px" }}>Notes</div>
            <p
              style={{
                ...sans,
                fontSize: "var(--fs-body)",
                color: "var(--ink-muted)",
                margin: 0,
                textWrap: "pretty",
              }}
            >
              {lot.notes}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

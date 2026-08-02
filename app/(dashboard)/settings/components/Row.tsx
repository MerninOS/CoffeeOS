import type { ReactNode } from "react";
import { overline } from "./tokens";

/**
 * A labelled worksheet row: overline label in a fixed first track, value in the
 * second, hairline rule between rows.
 *
 * This is what replaces a nested bordered card. The loud page nested three deep
 * — SectionPanel, then a bordered store-info box, then bordered InfoNotes —
 * which is the pattern the Instrument layout rule forbids outright.
 *
 * The two tracks collapse to one below 760px; that breakpoint lives in
 * `.set-row` in app/globals.css rather than here, so
 * tests/e2e/settings-layout.spec.ts can assert the geometry without reading a
 * component.
 */
export function Row({
  label,
  children,
  help,
}: {
  label: ReactNode;
  children: ReactNode;
  help?: ReactNode;
}) {
  return (
    <div className="set-row" data-settings-row style={{ borderBottom: "1px solid var(--hairline)" }}>
      <span style={overline}>{label}</span>
      <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 8 }}>
        {children}
        {help && (
          <span
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "var(--fs-caption)",
              color: "var(--ink-subtle)",
              lineHeight: "var(--lh-body)",
            }}
          >
            {help}
          </span>
        )}
      </div>
    </div>
  );
}

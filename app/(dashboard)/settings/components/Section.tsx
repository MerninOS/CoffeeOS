import type { ReactNode } from "react";
import { overline } from "./tokens";

/**
 * A section heading: overline title, optional right-aligned meta, on a rule.
 *
 * The rule is the section's only chrome. Sections are separated by spacing and a
 * hairline, never by a bordered container — "content sits directly on the
 * surface, divided by hairline rules and section spacing" is the layout rule
 * this page was violating three levels deep.
 */
export function Section({
  title,
  meta,
  children,
}: {
  title: ReactNode;
  meta?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="set-sect">
      <div className="set-head" style={{ borderBottom: "1px solid var(--hairline-strong)" }}>
        <h2 style={{ ...overline, color: "var(--ink)" }}>{title}</h2>
        {meta && <span style={overline}>{meta}</span>}
      </div>
      {children}
    </section>
  );
}

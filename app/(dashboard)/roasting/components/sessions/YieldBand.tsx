"use client";

import { mono, overline, sans } from "@/lib/instrument/tokens";
import { LOSS_BAND, lossPercent, lossTone } from "../../session-cost";

/**
 * The yield-loss scale, made visible.
 *
 * Before this, `weightLossColor()` coloured each session's loss figure red,
 * amber or green against thresholds of 12 and 18 that existed ONLY inside that
 * function. An operator saw a red number and had no way to learn what it was
 * red against, or how far outside it sat. A colour whose scale is invisible is
 * decoration wearing the costume of data.
 *
 * So the band is drawn: a rail from 8% to 24%, the in-spec region tinted, and
 * every session plotted on it. The rail is deliberately NOT the `--roast-*`
 * ramp — that encodes roast darkness, there is still no roast-level column, and
 * design-rulings.spec.ts bans it outright. Semantic tones only.
 */

const MIN = 8;
const MAX = 24;
const at = (pct: number) => ((pct - MIN) / (MAX - MIN)) * 100;

const TONE_VAR: Record<string, string> = {
  under: "var(--warning)",
  in: "var(--success)",
  over: "var(--danger)",
};

export interface BandSession {
  id: string;
  total_green_weight_g: number;
  total_roasted_weight_g: number;
}

export function YieldBand({ sessions }: { sessions: BandSession[] }) {
  const plotted = sessions
    .map((s) => ({
      id: s.id,
      pct: lossPercent(s.total_green_weight_g, s.total_roasted_weight_g),
    }))
    .filter((p): p is { id: string; pct: number } => p.pct !== null);

  // Nothing to grade against — render nothing rather than an empty scale, which
  // would imply the sessions exist and all scored zero.
  if (plotted.length === 0) return null;

  return (
    <div
      data-testid="yield-band"
      className="flex flex-col gap-2.5 px-4 py-3.5"
      style={{
        border: "1px solid var(--hairline)",
        borderRadius: "var(--r-md)",
        background: "var(--surface)",
      }}
    >
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <span style={{ ...overline, color: "var(--ink-muted)" }}>
          Yield loss · target band {LOSS_BAND[0]}–{LOSS_BAND[1]}%
        </span>
        <span
          style={{ ...sans, fontSize: "var(--fs-caption)", color: "var(--ink-subtle)" }}
        >
          Under-developed below {LOSS_BAND[0]}% · over-roasted above {LOSS_BAND[1]}%
        </span>
      </div>

      <div className="relative" style={{ height: 32 }}>
        {/* The full scale */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 12,
            height: 6,
            background: "var(--surface-sunken)",
            borderRadius: "var(--r-pill)",
          }}
        />
        {/* The in-spec region */}
        <div
          style={{
            position: "absolute",
            top: 12,
            height: 6,
            left: `${at(LOSS_BAND[0])}%`,
            width: `${at(LOSS_BAND[1]) - at(LOSS_BAND[0])}%`,
            background: "var(--success-soft)",
            borderTop: "1px solid var(--success)",
            borderBottom: "1px solid var(--success)",
            borderRadius: "var(--r-pill)",
          }}
        />
        {/* One tick per session, coloured by where it landed */}
        {plotted.map((p) => (
          <div
            key={p.id}
            data-testid="yield-tick"
            data-tone={lossTone(p.pct)}
            title={`${p.pct.toFixed(1)}%`}
            style={{
              position: "absolute",
              top: 7,
              // Clamp so an extreme outlier still renders on the rail rather
              // than escaping it — the tone still tells you it is out of spec.
              left: `calc(${Math.min(Math.max(at(p.pct), 0), 100)}% - 1px)`,
              width: 2,
              height: 16,
              background: TONE_VAR[lossTone(p.pct)],
              borderRadius: 1,
            }}
          />
        ))}
        {/* Scale labels */}
        {[MIN, LOSS_BAND[0], LOSS_BAND[1], MAX].map((v) => (
          <span
            key={v}
            style={{
              ...mono,
              position: "absolute",
              top: 22,
              left: `${at(v)}%`,
              transform: "translateX(-50%)",
              fontSize: "var(--fs-overline)",
              color: "var(--ink-subtle)",
            }}
          >
            {v}%
          </span>
        ))}
      </div>
    </div>
  );
}

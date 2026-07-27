"use client";

import React from "react";
import { Btn } from "./primitives";
import { PERIODS, type PeriodValue } from "@/lib/orders/constants";

/**
 * The period presets for /orders.
 *
 * PROVISIONAL control, moved verbatim out of orders-client.tsx during the
 * CoffeeOS#65 Stage A extraction. It is still built from the local `Btn` in its
 * current loud-Mernin' styling on purpose: Stage A relocates this markup, it
 * does not restyle it. Stage B replaces it with the instrument
 * SegmentedControl — PERIODS is capped at four options for exactly that.
 *
 * Navigation stays in the parent and is passed in, so the `router.push` call
 * site is unchanged from before the extraction.
 */

export function PeriodControl({
  period,
  onSelect,
}: {
  period: PeriodValue;
  onSelect: (value: PeriodValue) => void;
}) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap justify-end">
      {PERIODS.map((p) => (
        <Btn
          key={p.value}
          size="sm"
          variant={p.value === period ? "primary" : "outline"}
          onClick={() => onSelect(p.value)}
        >
          {p.label}
        </Btn>
      ))}
    </div>
  );
}

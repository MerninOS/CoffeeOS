"use client";

import React from "react";
import { SegmentedControl } from "@merninos/ui/instrument";
import { PERIODS, type PeriodValue } from "@/lib/orders/constants";

/**
 * The period presets for /orders.
 *
 * Now the instrument SegmentedControl, which is what PERIODS was capped at four
 * options for. Navigation still lives in the parent and is passed in, so the
 * `router.push` call site is unchanged.
 *
 * `onChange` hands back a plain string, so it is narrowed here rather than at
 * the call site — PERIODS is the only source of the values, so the cast is safe
 * and the parent keeps a `PeriodValue` callback.
 */

export function PeriodControl({
  period,
  onSelect,
}: {
  period: PeriodValue;
  onSelect: (value: PeriodValue) => void;
}) {
  return (
    <SegmentedControl
      size="sm"
      value={period}
      onChange={(value) => onSelect(value as PeriodValue)}
      options={PERIODS.map((p) => ({ value: p.value, label: p.label }))}
    />
  );
}

import type { Batch } from "./types";

export const COST_PER_UNIT_DECIMALS = 8;

export const getSessionAggForBatch = (batch: Batch, allBatches: Batch[]) => {
  if (!batch.roasting_sessions) return { totalRoastMinutes: batch.roast_minutes || 0, batchCount: 1 };
  const sessionId = batch.roasting_sessions.id;
  const sessionBatches = allBatches.filter((b) => b.roasting_sessions?.id === sessionId);
  const totalRoastMinutes = sessionBatches.reduce((sum, b) => sum + (b.roast_minutes || 0), 0);
  return { totalRoastMinutes, batchCount: Math.max(sessionBatches.length, 1) };
};

export const getSessionCostForBatch = (batch: Batch, allBatches: Batch[]) => {
  if (!batch.roasting_sessions) return 0;
  const session = batch.roasting_sessions;
  if (session.cost_mode === "co_roasting") {
    const sessionBatches = allBatches.filter((b) => b.roasting_sessions?.id === session.id);
    return sessionBatches.reduce(
      (sum, b) => sum + (b.green_weight_g / 453.592) * (session.rate_per_lb || 0),
      0
    );
  }
  const { totalRoastMinutes } = getSessionAggForBatch(batch, allBatches);
  const totalSessionMinutes = (session.setup_minutes || 0) + totalRoastMinutes + (session.cleanup_minutes || 0);
  const billableMinutes =
    Math.ceil(totalSessionMinutes / (session.billing_granularity_minutes || 15)) *
    (session.billing_granularity_minutes || 15);
  if (session.cost_mode === "power_usage") {
    return (billableMinutes / 60) * (session.machine_energy_kwh_per_hour || 0) * (session.kwh_rate || 0);
  }
  return (billableMinutes / 60) * (session.rate_per_hour || 0);
};

export const getBatchCostPerGram = (batch: Batch, allBatches: Batch[]) => {
  if (batch.sellable_g <= 0) return 0;
  const session = batch.roasting_sessions;
  const totalGreenCost = batch.green_cost_per_g * batch.green_weight_g;
  if (session?.cost_mode === "co_roasting") {
    const roastingCost = (batch.green_weight_g / 453.592) * (session.rate_per_lb || 0);
    return (totalGreenCost + roastingCost) / batch.sellable_g;
  }
  const { totalRoastMinutes, batchCount } = getSessionAggForBatch(batch, allBatches);
  const setupMinutes = session?.setup_minutes || 0;
  const cleanupMinutes = session?.cleanup_minutes || 0;
  const totalSessionMinutes = setupMinutes + totalRoastMinutes + cleanupMinutes;
  const batchEffectiveMinutes = (batch.roast_minutes || 0) + (setupMinutes + cleanupMinutes) / batchCount;
  const sessionCost = getSessionCostForBatch(batch, allBatches);
  const allocatedSessionCost =
    totalSessionMinutes > 0 ? sessionCost * (batchEffectiveMinutes / totalSessionMinutes) : 0;
  return (totalGreenCost + allocatedSessionCost) / batch.sellable_g;
};

export const lossColor = (pct: number) =>
  pct > 18 ? "text-tomato" : pct < 12 ? "text-honey" : "text-matcha";

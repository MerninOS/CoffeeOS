/**
 * Smart prefill for the Shopify admin block (design: "suggestion, not
 * auto-write"). Pure function — the caller assembles history from the DB.
 *
 * v1 heuristic:
 *   1. most recent historical order with the SAME product-id set (set
 *      equality: unique non-null ids, order-insensitive) that has packing
 *      components → suggest its components;
 *   2. else most recent order with any packing components;
 *   3. else nothing.
 *
 * Null product ids are excluded from the key: an unlinked line item says
 * nothing about what the order physically was.
 *
 * `history` MUST be ordered most-recent-first. This function does not sort
 * it — the fallback simply returns the first packed entry it finds, so a
 * caller passing oldest-first will silently produce wrong-but-plausible
 * suggestions.
 */
export interface SuggestionLine {
  componentId: string;
  name: string;
  unit: string;
  costPerUnit: number;
  quantity: number;
}

export interface HistoricalOrder {
  productIds: (string | null)[];
  components: SuggestionLine[];
}

function setKey(productIds: (string | null)[]): string {
  return [...new Set(productIds.filter((id): id is string => id !== null))]
    .sort()
    .join("|");
}

export function buildPrefillSuggestion(
  currentProductIds: (string | null)[],
  history: HistoricalOrder[]
): SuggestionLine[] {
  const packed = history.filter((h) => h.components.length > 0);
  if (packed.length === 0) return [];

  const currentKey = setKey(currentProductIds);
  if (currentKey !== "") {
    const match = packed.find((h) => setKey(h.productIds) === currentKey);
    if (match) return match.components;
  }
  return packed[0].components;
}

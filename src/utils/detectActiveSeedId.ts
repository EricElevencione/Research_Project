import { SEED_FIELD_MAPS } from "../constants/shortageFieldMaps";

function toFiniteNumber(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

// Picks the seed id for fertilizer-shortage context: highest non-zero requested kg wins.
// Tie breaker: stable order from SEED_FIELD_MAPS declaration.
export function detectActiveSeedId(
  requestOrFormData: Record<string, unknown> | null | undefined,
): string | null {
  if (!requestOrFormData) {
    return null;
  }

  let winner: { shortageId: string; amount: number } | null = null;

  for (const seedMap of SEED_FIELD_MAPS) {
    const amount = toFiniteNumber(requestOrFormData[seedMap.requestField]);
    if (amount <= 0) {
      continue;
    }

    if (!winner || amount > winner.amount) {
      winner = {
        shortageId: seedMap.shortageId,
        amount,
      };
    }
  }

  return winner?.shortageId ?? null;
}

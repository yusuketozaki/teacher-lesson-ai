import type { PhaseKey, TimeCheck } from "./types.ts";

export const PHASE_KEYS: readonly PhaseKey[] = [
  "introduction",
  "development",
  "summary",
];

/** A phase value is valid only when it is a non-negative integer of at most 999 (after NFKC + trim). */
export function parsePhaseMinutes(raw: string): number | null {
  const text = raw.normalize("NFKC").trim();
  if (!/^[0-9]{1,3}$/.test(text)) return null;
  return Number(text);
}

/** Compare edited phase minutes with the lesson duration. Never auto-corrects. */
export function checkTimeAllocation(
  durationMinutes: number,
  minutes: Record<PhaseKey, string>,
): TimeCheck {
  const invalidPhases: PhaseKey[] = [];
  let total = 0;
  for (const key of PHASE_KEYS) {
    const value = parsePhaseMinutes(minutes[key]);
    if (value === null) invalidPhases.push(key);
    else total += value;
  }
  if (invalidPhases.length > 0) {
    return {
      status: "invalid",
      total: null,
      durationMinutes,
      difference: null,
      invalidPhases,
    };
  }
  const difference = total - durationMinutes;
  return {
    status: difference === 0 ? "match" : difference < 0 ? "under" : "over",
    total,
    durationMinutes,
    difference,
    invalidPhases,
  };
}

import type { SetLog } from '../db/types';

export const MAX_E1RM_REPS = 12;

// Epley estimate. Sets over 12 reps say little about a one rep max, so they get no estimate.
export function epley(weight: number, reps: number): number | undefined {
  if (!(weight > 0) || !(reps >= 1) || reps > MAX_E1RM_REPS) return undefined;
  return Number((weight * (1 + reps / 30)).toFixed(1));
}

export const setE1rm = (s: SetLog) =>
  s.done && s.weight !== undefined && s.reps !== undefined ? epley(s.weight, s.reps) : undefined;

// An exercise's estimate for a session is the best set that day.
export function sessionE1rm(sets: SetLog[]): { value: number; set: SetLog } | undefined {
  let best: { value: number; set: SetLog } | undefined;
  for (const set of sets) {
    const value = setE1rm(set);
    if (value !== undefined && (!best || value > best.value)) best = { value, set };
  }
  return best;
}

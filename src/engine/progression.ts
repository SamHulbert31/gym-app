import type { Equipment, Exercise } from '../db/types';
import type { ExerciseSession } from './history';
import { repsList } from './format';

export type Increments = Partial<Record<Equipment, number>>;

// Barbell 2.5 kg, dumbbell 2 kg per hand, machine and cable 5 kg. Anything else steps by 2.5.
export const DEFAULT_INCREMENTS: Increments = { barbell: 2.5, dumbbell: 2, machine: 5, cable: 5 };
const FALLBACK_INCREMENT = 2.5;

export const incrementFor = (ex: Pick<Exercise, 'equipment' | 'increment'>, increments: Increments = DEFAULT_INCREMENTS) =>
  ex.increment ?? increments[ex.equipment] ?? FALLBACK_INCREMENT;

export const roundTo = (kg: number, inc: number) => Number((Math.round(kg / inc) * inc).toFixed(2));

export const STALE_WEEKS = 4;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export type Reason = 'none' | 'bodyweight' | 'up' | 'same' | 'down' | 'stale';

export interface RepRange {
  repsLow: number;
  repsHigh: number;
}

export interface Suggestion {
  weight?: number;
  reason: Reason;
  lastWeight?: number;
  coaching: string;
}

// A session's working sets: the done sets at the heaviest weight lifted that day.
function workingSets(s: ExerciseSession) {
  const weighted = s.sets.filter((x) => x.done && x.weight && x.reps !== undefined);
  if (!weighted.length) return undefined;
  const weight = Math.max(...weighted.map((x) => x.weight as number));
  return { weight, reps: weighted.filter((x) => x.weight === weight).map((x) => x.reps as number) };
}

const underRange = (s: ExerciseSession) => {
  const ws = workingSets(s);
  return !!ws && ws.reps.some((r) => r < s.target.repsLow);
};

// A drop of roughly `fraction`, on the increment grid, and always at least one increment down.
const dropFrom = (weight: number, fraction: number, inc: number) =>
  Math.max(inc, Math.min(roundTo(weight * (1 - fraction), inc), roundTo(weight - inc, inc)));

// Double progression. Each session is judged against the rep range it was set that day;
// the coaching line looks forward using the range for the session about to start.
export function suggestWeight(
  ex: Pick<Exercise, 'equipment' | 'increment'>,
  history: ExerciseSession[],
  target: RepRange,
  now: Date,
  increments: Increments = DEFAULT_INCREMENTS,
): Suggestion {
  const last = history[history.length - 1];
  if (!last) {
    return { reason: 'none', coaching: 'No history yet. Log what you lift today and next time the app suggests a weight.' };
  }

  const ws = workingSets(last);
  if (!ws) {
    return {
      reason: 'bodyweight',
      coaching: `Bodyweight last time: ${repsList(last.sets)} reps. Aim for ${target.repsHigh} on every set; when that is easy, add a set or pick a harder version.`,
    };
  }

  const inc = incrementFor(ex, increments);
  const w = ws.weight;
  const repsText = ws.reps.join(', ');
  const weeksAgo = (now.getTime() - new Date(last.date).getTime()) / WEEK_MS;

  if (weeksAgo > STALE_WEEKS) {
    const weight = dropFrom(w, 0.1, inc);
    return {
      weight,
      reason: 'stale',
      lastWeight: w,
      coaching: `It has been ${Math.floor(weeksAgo)} weeks since you last did this, so today starts a little lighter at ${weight} kg. Hit every rep and next session goes back up.`,
    };
  }

  const prev = history[history.length - 2];
  if (underRange(last) && prev && underRange(prev)) {
    const weight = dropFrom(w, 0.075, inc);
    return {
      weight,
      reason: 'down',
      lastWeight: w,
      coaching: `Two sessions in a row with a set under ${last.target.repsLow} reps, so today drops to ${weight} kg to rebuild. Hit ${target.repsHigh} on every set and it climbs again.`,
    };
  }

  if (ws.reps.every((r) => r >= last.target.repsHigh)) {
    const weight = Number((w + inc).toFixed(2));
    return {
      weight,
      reason: 'up',
      lastWeight: w,
      coaching: `You hit every rep at ${w} kg last time (${repsText}), so today moves to ${weight} kg. If a set drops under ${target.repsLow} reps, this weight stays for next session.`,
    };
  }

  return {
    weight: w,
    reason: 'same',
    lastWeight: w,
    coaching: `Last time at ${w} kg you got ${repsText}. Hit ${target.repsHigh} on every set today and next session goes up ${inc} kg.`,
  };
}

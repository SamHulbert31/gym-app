import { ARM_PARTS, MUSCLES, type ArmPart, type Exercise, type Muscle, type Workout } from '../db/types';
import { armPart } from './classify';
import { workoutDate } from './history';
import { muscleLabel } from '../utils';

export interface MuscleBalance {
  sets: Record<Muscle, number>;
  /** Arms sets split into biceps and triceps. They add up to sets.arms. */
  armParts: Record<ArmPart, number>;
  lagging: Muscle[];
  /** The arm side with under half the sets of the other, once there are a few arm sets to compare. */
  laggingPart?: ArmPart;
  median: number;
  total: number;
  sentence: string;
}

export const BALANCE_DAYS = 14;

// Done sets per primary muscle over the window. A muscle is lagging when it has under half
// the sets of the median muscle. When most muscles have no sets at all the median is 0 and
// that rule flags nothing, so then every untrained muscle is lagging instead.
// Sets in a session still in progress count too.
export function muscleBalance(
  workouts: Workout[],
  exercises: Map<string, Pick<Exercise, 'primary'> & Partial<Pick<Exercise, 'name' | 'part'>>>,
  now: Date,
  days = BALANCE_DAYS,
): MuscleBalance {
  const since = now.getTime() - days * 24 * 60 * 60 * 1000;
  const sets = Object.fromEntries(MUSCLES.map((m) => [m, 0])) as Record<Muscle, number>;
  const armParts: Record<ArmPart, number> = { biceps: 0, triceps: 0 };

  for (const w of workouts) {
    if (w.deletedAt || w.status === 'planned') continue;
    const fallback = workoutDate(w);
    for (const we of w.exercises) {
      const ex = exercises.get(we.exerciseId);
      const muscle = ex?.primary;
      if (!ex || !muscle) continue;
      const part = armPart(ex);
      for (const s of we.sets) {
        if (!s.done) continue;
        const at = new Date(s.doneAt ?? fallback).getTime();
        if (at >= since && at <= now.getTime()) {
          sets[muscle]++;
          if (part) armParts[part]++;
        }
      }
    }
  }

  const sorted = MUSCLES.map((m) => sets[m]).sort((a, b) => a - b);
  const mid = sorted.length / 2;
  const median = (sorted[mid - 1] + sorted[mid]) / 2;
  const total = sorted.reduce((a, b) => a + b, 0);
  const lagging = MUSCLES.filter((m) => (median > 0 ? sets[m] < median / 2 : total > 0 && sets[m] === 0));

  const [low, high] = [...ARM_PARTS].sort((a, b) => armParts[a] - armParts[b]);
  const laggingPart = armParts[high] >= 3 && armParts[low] < armParts[high] / 2 ? low : undefined;

  return { sets, armParts, lagging, laggingPart, median, total, sentence: sentence(sets, lagging, laggingPart, total, days) };
}

const ARM_NOTE: Record<ArmPart, string> = { biceps: 'Biceps are behind triceps.', triceps: 'Triceps are behind biceps.' };

// "Legs", "Legs and core", "Legs, core and arms".
export const listOf = (muscles: Muscle[]) => {
  const names = muscles.map((m, i) => (i === 0 ? muscleLabel(m) : m));
  return names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
};

function sentence(sets: Record<Muscle, number>, lagging: Muscle[], laggingPart: ArmPart | undefined, total: number, days: number) {
  if (total === 0) return `No sets logged in the last ${days} days yet. Finish a workout and the balance shows here.`;
  const arms = laggingPart ? ` ${ARM_NOTE[laggingPart]}` : '';
  if (lagging.length === 0) return laggingPart ? `Balanced across muscle groups over the last two weeks.${arms}` : 'Nicely balanced over the last two weeks.';
  // Most muscles untrained: naming what was trained reads better than a list of five.
  if (lagging.length > MUSCLES.length / 2) {
    const trained = MUSCLES.filter((m) => sets[m] > 0);
    return `Only ${listOf(trained).toLowerCase()} in the last two weeks, so everything else is behind.${arms} The next generated session will lean that way unless you choose otherwise.`;
  }
  const verb = lagging.length === 1 ? 'is' : 'are';
  return `${listOf(lagging)} ${verb} behind.${arms} The next generated session will lean that way unless you choose otherwise.`;
}

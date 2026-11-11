import { MUSCLES, type Exercise, type Muscle, type Workout } from '../db/types';
import { workoutDate } from './history';
import { muscleLabel } from '../utils';

export interface MuscleBalance {
  sets: Record<Muscle, number>;
  lagging: Muscle[];
  median: number;
  total: number;
  sentence: string;
}

export const BALANCE_DAYS = 14;

// Done sets per primary muscle over the window. A muscle is lagging when it has under half
// the sets of the median muscle. Sets in a session still in progress count too.
export function muscleBalance(
  workouts: Workout[],
  exercises: Map<string, Pick<Exercise, 'primary'>>,
  now: Date,
  days = BALANCE_DAYS,
): MuscleBalance {
  const since = now.getTime() - days * 24 * 60 * 60 * 1000;
  const sets = Object.fromEntries(MUSCLES.map((m) => [m, 0])) as Record<Muscle, number>;

  for (const w of workouts) {
    if (w.deletedAt || w.status === 'planned') continue;
    const fallback = workoutDate(w);
    for (const we of w.exercises) {
      const muscle = exercises.get(we.exerciseId)?.primary;
      if (!muscle) continue;
      for (const s of we.sets) {
        if (!s.done) continue;
        const at = new Date(s.doneAt ?? fallback).getTime();
        if (at >= since && at <= now.getTime()) sets[muscle]++;
      }
    }
  }

  const sorted = MUSCLES.map((m) => sets[m]).sort((a, b) => a - b);
  const mid = sorted.length / 2;
  const median = (sorted[mid - 1] + sorted[mid]) / 2;
  const lagging = MUSCLES.filter((m) => sets[m] < median / 2);
  const total = sorted.reduce((a, b) => a + b, 0);

  return { sets, lagging, median, total, sentence: sentence(lagging, total, days) };
}

function sentence(lagging: Muscle[], total: number, days: number) {
  if (total === 0) return `No sets logged in the last ${days} days yet. Finish a workout and the balance shows here.`;
  if (lagging.length === 0) return 'Nicely balanced over the last two weeks.';
  const names = lagging.map((m, i) => (i === 0 ? muscleLabel(m) : m));
  const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  const verb = names.length === 1 ? 'is' : 'are';
  return `${list} ${verb} behind. The next generated session will lean that way unless you choose otherwise.`;
}

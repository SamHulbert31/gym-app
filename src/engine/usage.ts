import type { Equipment, Exercise, Muscle, Workout } from '../db/types';
import { doneWorkouts, workoutDate } from './history';

// What the app has learned about how this person actually trains.
export interface Usage {
  /** Finished sessions that included each exercise. */
  count: Map<string, number>;
  /** ISO date of the most recent finished session of each exercise. */
  last: Map<string, string>;
  /** How many times each exercise was swapped out for something else. */
  swappedAway: Map<string, number>;
  /** Finished workouts overall. */
  workouts: number;
  /** For a muscle: the share of its logged sessions done with each kind of equipment (sums to 1). */
  affinity: (muscle: Muscle) => Map<Equipment, number>;
}

export function buildUsage(workouts: Workout[], exercises: Map<string, Pick<Exercise, 'primary' | 'equipment'>>): Usage {
  const count = new Map<string, number>();
  const last = new Map<string, string>();
  const swappedAway = new Map<string, number>();
  const finished = doneWorkouts(workouts);

  for (const w of finished) {
    for (const we of w.exercises) {
      if (we.sets.some((s) => s.done)) {
        count.set(we.exerciseId, (count.get(we.exerciseId) ?? 0) + 1);
        last.set(we.exerciseId, workoutDate(w));
      }
    }
  }
  // A swap counts even if that session was later abandoned: it says what was unwanted.
  for (const w of workouts) {
    if (w.deletedAt) continue;
    for (const we of w.exercises) {
      if (we.swappedFromExerciseId) swappedAway.set(we.swappedFromExerciseId, (swappedAway.get(we.swappedFromExerciseId) ?? 0) + 1);
    }
  }

  const affinity = (muscle: Muscle) => {
    const byEquipment = new Map<Equipment, number>();
    let total = 0;
    for (const [id, n] of count) {
      const ex = exercises.get(id);
      if (!ex || ex.primary !== muscle) continue;
      byEquipment.set(ex.equipment, (byEquipment.get(ex.equipment) ?? 0) + n);
      total += n;
    }
    if (total > 0) for (const [k, v] of byEquipment) byEquipment.set(k, v / total);
    return byEquipment;
  };

  return { count, last, swappedAway, workouts: finished.length, affinity };
}

export const EMPTY_USAGE: Usage = buildUsage([], new Map());

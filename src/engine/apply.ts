// Glue between the pure engine and the database.
import { db } from '../db/db';
import type { Exercise, Workout } from '../db/types';
import { exerciseHistory } from './history';
import { DEFAULT_INCREMENTS, suggestWeight, type Increments, type RepRange, type Suggestion } from './progression';

export interface SuggestContext {
  workouts: Workout[];
  increments: Increments;
  now: Date;
}

export async function loadSuggestContext(): Promise<SuggestContext> {
  const [workouts, meta] = await Promise.all([db.workouts.toArray(), db.meta.get('meta')]);
  return { workouts, increments: { ...DEFAULT_INCREMENTS, ...meta?.increments }, now: new Date() };
}

// The suggestion for an exercise about to be done in `workoutId`, which is left out of the history.
export function suggestIn(ctx: SuggestContext, ex: Exercise, target: RepRange, workoutId: string): Suggestion {
  const history = exerciseHistory(
    ctx.workouts.filter((w) => w.id !== workoutId),
    ex.id,
  );
  return suggestWeight(ex, history, target, ctx.now, ctx.increments);
}

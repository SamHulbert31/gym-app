import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import type { Exercise } from '../db/types';
import { findActiveWorkout } from '../db/workouts';

// undefined while loading, null when there is none.
export const useActiveWorkout = () => useLiveQuery(() => findActiveWorkout().then((w) => w ?? null), []);

export const useWorkout = (id: string | undefined) =>
  useLiveQuery(() => (id ? db.workouts.get(id).then((w) => (w && !w.deletedAt ? w : null)) : null), [id]);

export function useExerciseMap() {
  return useLiveQuery(async () => new Map<string, Exercise>((await db.exercises.toArray()).map((e) => [e.id, e])), []);
}

export const useMeta = () => useLiveQuery(() => db.meta.get('meta'), []);

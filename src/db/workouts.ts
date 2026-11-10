import { db, newId, nowISO } from './db';
import type { Exercise, Muscle, SetLog, Workout, WorkoutExercise } from './types';

export const DEFAULT_TARGET = { sets: 3, repsLow: 8, repsHigh: 12 };

const alive = <T extends { deletedAt?: string }>(x: T) => !x.deletedAt;

export async function createWorkout(init: Partial<Workout> = {}): Promise<Workout> {
  const now = nowISO();
  const workout: Workout = {
    id: newId(),
    source: 'manual',
    status: 'planned',
    focus: [],
    exercises: [],
    createdAt: now,
    updatedAt: now,
    ...init,
  };
  await db.workouts.add(workout);
  return workout;
}

// Read, change, write in one transaction so quick consecutive edits never overwrite each other.
export function updateWorkout(id: string, change: (w: Workout) => void) {
  return db.transaction('rw', db.workouts, async () => {
    const w = await db.workouts.get(id);
    if (!w) return;
    change(w);
    w.updatedAt = nowISO();
    await db.workouts.put(w);
  });
}

export const updateExercise = (id: string, index: number, change: (we: WorkoutExercise) => void) =>
  updateWorkout(id, (w) => {
    const we = w.exercises[index];
    if (we) change(we);
  });

export const findActiveWorkout = () => db.workouts.where('status').equals('active').filter(alive).first();

export async function startWorkout(id: string) {
  const exercises = new Map((await db.exercises.toArray()).map((e) => [e.id, e]));
  await updateWorkout(id, (w) => {
    w.status = 'active';
    w.startedAt = nowISO();
    w.exercises.forEach((we, i) => {
      we.order = i;
      we.sets = Array.from({ length: we.target.sets }, (): SetLog => ({ weight: we.target.weight, done: false }));
    });
    const muscles = new Set<Muscle>();
    w.exercises.forEach((we) => {
      const ex = exercises.get(we.exerciseId);
      if (ex) muscles.add(ex.primary);
    });
    if (!w.focus.length) w.focus = [...muscles];
  });
}

// Finishing keeps only what was actually performed.
export async function finishWorkout(id: string) {
  await updateWorkout(id, (w) => {
    w.status = 'done';
    w.endedAt = nowISO();
    w.exercises = w.exercises
      .map((we) => ({ ...we, sets: we.sets.filter((s) => s.done) }))
      .filter((we) => we.sets.length > 0)
      .map((we, i) => ({ ...we, order: i }));
  });
}

export const discardWorkout = (id: string) =>
  updateWorkout(id, (w) => {
    w.deletedAt = nowISO();
  });

export const doneSetCount = (w: Workout) => w.exercises.reduce((n, we) => n + we.sets.filter((s) => s.done).length, 0);

export const newTarget = (ex: Exercise): WorkoutExercise => ({
  exerciseId: ex.id,
  order: 0,
  target: { ...DEFAULT_TARGET },
  sets: [],
});

// The sets from the most recent finished workout that included this exercise.
export async function lastTimeSets(exerciseId: string, excludeWorkoutId?: string): Promise<SetLog[] | undefined> {
  const done = await db.workouts.where('status').equals('done').filter(alive).toArray();
  done.sort((a, b) => (b.endedAt ?? '').localeCompare(a.endedAt ?? ''));
  for (const w of done) {
    if (w.id === excludeWorkoutId) continue;
    const we = w.exercises.find((e) => e.exerciseId === exerciseId);
    if (we && we.sets.length) return we.sets;
  }
  return undefined;
}

export async function createCustomExercise(init: Pick<Exercise, 'name' | 'primary' | 'equipment'>): Promise<Exercise> {
  const now = nowISO();
  const ex: Exercise = { id: newId(), secondary: [], isCustom: true, createdAt: now, updatedAt: now, ...init };
  await db.exercises.add(ex);
  return ex;
}

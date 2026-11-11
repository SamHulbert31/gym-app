import { loadSuggestContext, suggestIn } from '../engine/apply';
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

// Starting fills in what the engine knows: a suggested weight and coaching line for every
// exercise the user did not set a weight for, then one empty set row per target set.
export async function startWorkout(id: string) {
  const [exerciseList, ctx] = await Promise.all([db.exercises.toArray(), loadSuggestContext()]);
  const exercises = new Map(exerciseList.map((e) => [e.id, e]));
  await updateWorkout(id, (w) => {
    w.status = 'active';
    w.startedAt = ctx.now.toISOString();
    w.exercises.forEach((we, i) => {
      we.order = i;
      const ex = exercises.get(we.exerciseId);
      if (ex && we.target.weight === undefined) {
        const s = suggestIn(ctx, ex, we.target, id);
        we.target.weight = s.weight;
        we.note = s.coaching;
      }
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

// Swapping mid-session keeps done sets and re-suggests the weight for the sets still to do.
export async function swapExercise(workoutId: string, index: number, to: Exercise) {
  const ctx = await loadSuggestContext();
  await updateExercise(workoutId, index, (e) => {
    if (e.exerciseId === to.id) return;
    e.swappedFromExerciseId ??= e.exerciseId;
    e.exerciseId = to.id;
    const s = suggestIn(ctx, to, e.target, workoutId);
    e.target = { ...e.target, weight: s.weight };
    e.note = s.coaching;
    e.sets = e.sets.map((set) => (set.done ? set : { ...set, weight: s.weight }));
  });
}

export async function createCustomExercise(init: Pick<Exercise, 'name' | 'primary' | 'equipment'>): Promise<Exercise> {
  const now = nowISO();
  const ex: Exercise = { id: newId(), secondary: [], isCustom: true, createdAt: now, updatedAt: now, ...init };
  await db.exercises.add(ex);
  return ex;
}

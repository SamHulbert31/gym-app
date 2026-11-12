import { loadSuggestContext, suggestIn } from '../engine/apply';
import { defaultReps } from '../engine/classify';
import { cancelPush, schedulePush } from '../sync';
import { db, newId, nowISO } from './db';
import type { ArmPart, Exercise, Muscle, SetLog, Workout, WorkoutExercise } from './types';

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
  schedulePush();
  return workout;
}

// Read, change, write in one transaction so quick consecutive edits never overwrite each other.
// Changes outside a live session are pushed; set logging during one waits until it ends.
export async function updateWorkout(id: string, change: (w: Workout) => void) {
  const status = await db.transaction('rw', db.workouts, async () => {
    const w = await db.workouts.get(id);
    if (!w) return undefined;
    change(w);
    w.updatedAt = nowISO();
    await db.workouts.put(w);
    return w.status;
  });
  if (status && status !== 'active') schedulePush();
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
  // Nothing is pushed during a live session; finishing it pushes everything.
  cancelPush();
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

export async function discardWorkout(id: string) {
  await updateWorkout(id, (w) => {
    w.deletedAt = nowISO();
  });
  schedulePush();
}

export const doneSetCount = (w: Workout) => w.exercises.reduce((n, we) => n + we.sets.filter((s) => s.done).length, 0);

export const newTarget = (ex: Exercise): WorkoutExercise => ({
  exerciseId: ex.id,
  order: 0,
  target: { ...DEFAULT_TARGET },
  sets: [],
});

// Adding mid-session appends the exercise with the same suggested weight, coaching line and
// set rows it would have had if it was planned from the start. Returns its index, or -1 when
// it is already in the session.
export async function addExerciseToSession(workoutId: string, ex: Exercise): Promise<number> {
  const ctx = await loadSuggestContext();
  let index = -1;
  await updateWorkout(workoutId, (w) => {
    if (w.exercises.some((we) => we.exerciseId === ex.id)) return;
    const we: WorkoutExercise = { ...newTarget(ex), target: { sets: DEFAULT_TARGET.sets, ...defaultReps(ex) }, order: w.exercises.length };
    const s = suggestIn(ctx, ex, we.target, workoutId);
    we.target.weight = s.weight;
    we.note = s.coaching;
    we.sets = Array.from({ length: we.target.sets }, (): SetLog => ({ weight: s.weight, done: false }));
    w.exercises.push(we);
    index = we.order;
  });
  return index;
}

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

// Exercise settings: "not available at my gym" (it stops being suggested or offered anywhere)
// the per exercise weight increment that overrides the equipment default, and for arms
// exercises which side (biceps or triceps) it counts towards.
export async function updateExerciseSettings(id: string, patch: { unavailable?: boolean; increment?: number; part?: ArmPart }) {
  const changes: Partial<Exercise> = { updatedAt: nowISO() };
  if ('unavailable' in patch) changes.unavailable = patch.unavailable || undefined;
  if ('part' in patch) changes.part = patch.part;
  if ('increment' in patch) changes.increment = patch.increment && patch.increment > 0 ? patch.increment : undefined;
  await db.exercises.update(id, changes);
  schedulePush();
}

export const setUnavailable = (id: string, unavailable: boolean) => updateExerciseSettings(id, { unavailable });

// Custom exercises are deleted with a tombstone, so the deletion reaches other devices and
// past workouts can still show the name.
export async function deleteCustomExercise(id: string) {
  const now = nowISO();
  await db.exercises.update(id, { deletedAt: now, updatedAt: now });
  schedulePush();
}

export async function createCustomExercise(
  init: Pick<Exercise, 'name' | 'primary' | 'equipment'> & Partial<Pick<Exercise, 'part'>>,
): Promise<Exercise> {
  const now = nowISO();
  const { part, ...rest } = init;
  // Only arms exercises carry a side.
  const ex: Exercise = { id: newId(), secondary: [], isCustom: true, createdAt: now, updatedAt: now, ...rest, ...(rest.primary === 'arms' && part ? { part } : {}) };
  await db.exercises.add(ex);
  schedulePush();
  return ex;
}

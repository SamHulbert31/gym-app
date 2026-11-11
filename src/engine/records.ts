import type { SetLog, Workout } from '../db/types';
import { setE1rm } from './e1rm';
import { doneWorkouts, workoutDate, type ExerciseSession } from './history';

export type RecordKind = 'weight' | 'reps' | 'e1rm';

export interface RecordEvent {
  exerciseId: string;
  workoutId: string;
  date: string;
  kind: RecordKind;
  weight: number; // 0 for bodyweight
  reps: number;
  value: number; // the new best: kg, reps, or estimated 1RM
  delta: number; // improvement over the previous best
}

// Per exercise: heaviest weight, best estimated 1RM, and most reps at each weight.
export interface Bests {
  weight?: number;
  e1rm?: number;
  repsAt: Map<number, number>;
}

export const emptyBests = (): Bests => ({ repsAt: new Map() });

const usable = (s: SetLog) => s.done && s.reps !== undefined && s.reps > 0;

export function addToBests(b: Bests, s: SetLog) {
  if (!usable(s)) return;
  const w = s.weight ?? 0;
  const reps = s.reps as number;
  if (w > 0 && (b.weight === undefined || w > b.weight)) b.weight = w;
  const e = setE1rm(s);
  if (e !== undefined && (b.e1rm === undefined || e > b.e1rm)) b.e1rm = e;
  if (reps > (b.repsAt.get(w) ?? 0)) b.repsAt.set(w, reps);
}

export function bestsFor(history: ExerciseSession[]): Bests {
  const b = emptyBests();
  for (const session of history) session.sets.forEach((s) => addToBests(b, s));
  return b;
}

type Beat = Pick<RecordEvent, 'kind' | 'value' | 'delta'>;

// What a set beats, in priority order: a heavier weight, more reps at a known weight, a higher estimate.
export function setRecord(s: SetLog, b: Bests): Beat | undefined {
  if (!usable(s)) return undefined;
  const w = s.weight ?? 0;
  const reps = s.reps as number;
  if (w > 0 && b.weight !== undefined && w > b.weight) return { kind: 'weight', value: w, delta: w - b.weight };
  const prevReps = b.repsAt.get(w);
  if (prevReps !== undefined && reps > prevReps) return { kind: 'reps', value: reps, delta: reps - prevReps };
  const e = setE1rm(s);
  if (e !== undefined && b.e1rm !== undefined && e > b.e1rm) return { kind: 'e1rm', value: e, delta: Number((e - b.e1rm).toFixed(1)) };
  return undefined;
}

// Walks every finished workout in order and reports at most one record per exercise per workout.
// An exercise's first ever session only sets the baseline, so a new user is not flooded with records.
export function recordEvents(workouts: Workout[]): RecordEvent[] {
  const bests = new Map<string, Bests>();
  const events: RecordEvent[] = [];

  for (const w of doneWorkouts(workouts)) {
    for (const we of w.exercises) {
      const before = bests.get(we.exerciseId);
      const b = before ?? emptyBests();
      const sets = we.sets.filter(usable);
      if (before) {
        let best: (Beat & { set: SetLog }) | undefined;
        for (const s of sets) {
          const beat = setRecord(s, before);
          if (beat && (!best || rank(beat) > rank(best))) best = { ...beat, set: s };
        }
        if (best) {
          events.push({
            exerciseId: we.exerciseId,
            workoutId: w.id,
            date: workoutDate(w),
            kind: best.kind,
            weight: best.set.weight ?? 0,
            reps: best.set.reps as number,
            value: best.value,
            delta: best.delta,
          });
        }
      }
      if (sets.length) {
        sets.forEach((s) => addToBests(b, s));
        bests.set(we.exerciseId, b);
      }
    }
  }
  return events;
}

const KIND_RANK: Record<RecordKind, number> = { weight: 3, reps: 2, e1rm: 1 };
// Higher priority kind first; within a kind, the bigger improvement.
const rank = (b: Beat) => KIND_RANK[b.kind] * 1e6 + b.delta;

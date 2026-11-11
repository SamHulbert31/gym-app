import type { SetLog, Workout, WorkoutExercise } from '../db/types';

// One finished workout's worth of an exercise: only the sets that were done.
export interface ExerciseSession {
  workoutId: string;
  date: string;
  target: WorkoutExercise['target'];
  sets: SetLog[];
}

export const workoutDate = (w: Workout) => w.endedAt ?? w.startedAt ?? w.createdAt;

// Finished, not deleted, oldest first.
export const doneWorkouts = (workouts: Workout[]) =>
  workouts
    .filter((w) => w.status === 'done' && !w.deletedAt)
    .sort((a, b) => workoutDate(a).localeCompare(workoutDate(b)));

export function exerciseHistory(workouts: Workout[], exerciseId: string): ExerciseSession[] {
  const out: ExerciseSession[] = [];
  for (const w of doneWorkouts(workouts)) {
    for (const we of w.exercises) {
      if (we.exerciseId !== exerciseId) continue;
      const sets = we.sets.filter((s) => s.done);
      if (sets.length) out.push({ workoutId: w.id, date: workoutDate(w), target: we.target, sets });
    }
  }
  return out;
}

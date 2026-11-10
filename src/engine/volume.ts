import type { SetLog, Workout } from '../db/types';

// Sum of weight × reps over done sets. Bodyweight sets have no weight, so they add sets but no volume.
export const setVolume = (s: SetLog) => (s.done && s.weight && s.reps ? s.weight * s.reps : 0);

export const workoutVolume = (w: Workout) =>
  w.exercises.reduce((total, we) => total + we.sets.reduce((sum, s) => sum + setVolume(s), 0), 0);

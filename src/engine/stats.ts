import type { Workout } from '../db/types';
import { workoutVolume } from './volume';
import { doneWorkouts, workoutDate } from './history';

const DAY_MS = 24 * 60 * 60 * 1000;

// Local midnight on the Monday of the week containing `d`.
export function weekStart(d: Date) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

export interface WeekSummary {
  trained: boolean[]; // Monday first
  sessions: number;
  volume: number; // kg
}

// This calendar week: which days had a finished workout, how many, and the total volume.
// No targets and no streaks, just what happened.
export function thisWeek(workouts: Workout[], now: Date): WeekSummary {
  const start = weekStart(now);
  const end = addDays(start, 7);
  const trained = Array<boolean>(7).fill(false);
  let sessions = 0;
  let volume = 0;
  for (const w of doneWorkouts(workouts)) {
    const at = new Date(workoutDate(w));
    if (at < start || at >= end) continue;
    trained[(at.getDay() + 6) % 7] = true;
    sessions++;
    volume += workoutVolume(w);
  }
  return { trained, sessions, volume };
}

export interface WeekVolume {
  start: Date;
  kg: number;
  current: boolean;
}

// Total volume per calendar week for the last `weeks` weeks, oldest first, current week last.
export function weeklyVolumes(workouts: Workout[], now: Date, weeks = 8): WeekVolume[] {
  const current = weekStart(now);
  const out: WeekVolume[] = Array.from({ length: weeks }, (_, i) => ({
    start: addDays(current, -7 * (weeks - 1 - i)),
    kg: 0,
    current: i === weeks - 1,
  }));
  for (const w of doneWorkouts(workouts)) {
    const at = new Date(workoutDate(w));
    for (let i = weeks - 1; i >= 0; i--) {
      if (at >= out[i].start) {
        if (i === weeks - 1 && at >= addDays(current, 7)) break;
        out[i].kg += workoutVolume(w);
        break;
      }
    }
  }
  return out;
}

export function workoutMinutes(w: Workout) {
  if (!w.startedAt || !w.endedAt) return 0;
  return Math.max(1, Math.round((new Date(w.endedAt).getTime() - new Date(w.startedAt).getTime()) / 60000));
}

export interface LoggedExercise {
  id: string;
  sessions: number;
  last: string;
}

// Exercises with finished sessions, most logged first (ties: most recent first).
export function loggedExercises(workouts: Workout[]): LoggedExercise[] {
  const map = new Map<string, LoggedExercise>();
  for (const w of doneWorkouts(workouts)) {
    for (const we of w.exercises) {
      if (!we.sets.some((s) => s.done)) continue;
      const cur = map.get(we.exerciseId) ?? { id: we.exerciseId, sessions: 0, last: '' };
      cur.sessions++;
      cur.last = workoutDate(w);
      map.set(we.exerciseId, cur);
    }
  }
  return [...map.values()].sort((a, b) => b.sessions - a.sessions || b.last.localeCompare(a.last));
}

export const daysBetween = (a: Date, b: Date) => (b.getTime() - a.getTime()) / DAY_MS;

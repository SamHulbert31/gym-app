export type Muscle = 'chest' | 'back' | 'shoulders' | 'arms' | 'legs' | 'core';
export type Equipment = 'barbell' | 'dumbbell' | 'machine' | 'cable' | 'bodyweight' | 'kettlebell' | 'other';

export const MUSCLES: Muscle[] = ['chest', 'back', 'shoulders', 'arms', 'legs', 'core'];
export const EQUIPMENT: Equipment[] = ['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight', 'kettlebell', 'other'];

interface Record_ {
  id: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string; // tombstone
}

export interface Exercise extends Record_ {
  name: string;
  primary: Muscle;
  secondary: Muscle[];
  equipment: Equipment;
  isCustom: boolean;
  increment?: number; // kg step for progression, overrides the default
  unavailable?: boolean; // marked as not available at the gym
}

export interface SetLog {
  weight?: number;
  reps?: number;
  done: boolean;
  doneAt?: string;
}

export interface WorkoutExercise {
  exerciseId: string;
  order: number;
  target: { sets: number; repsLow: number; repsHigh: number; weight?: number };
  sets: SetLog[];
  swappedFromExerciseId?: string;
  note?: string; // the coaching line shown under the sets
}

export interface Workout extends Record_ {
  source: 'generated' | 'manual';
  status: 'planned' | 'active' | 'done';
  focus: Muscle[] | ['full'];
  plannedMinutes?: number;
  userNote?: string;
  startedAt?: string;
  endedAt?: string;
  exercises: WorkoutExercise[];
}

export interface Meta extends Record_ {
  id: 'meta';
  schemaVersion: number;
  restSeconds: number;
  increments: Partial<Record<Equipment, number>>;
  lastSync?: string;
}

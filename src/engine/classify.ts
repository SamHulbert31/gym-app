import type { Exercise } from '../db/types';

type Kind = Pick<Exercise, 'name' | 'equipment' | 'secondary'>;

// Single joint or core work. Checked first, so "leg press calf raise" is not a press.
const ISOLATION =
  /(curl|extension|raise|fly|pushdown|kickback|shrug|calf|abduction|adduction|pec deck|crunch|twist|plank|hold|wrist|face pull|pallof|woodchop|rollout|carry|dead bug|climber|sit-up|straight-arm)/i;
const COMPOUND = /(press|squat|deadlift|row|pull-up|chin-up|pulldown|lunge|step-up|dip|push-up|thrust|bridge|good morning|get-up|swing|pull-through)/i;
const HEAVY = /(leg press|hack squat|squat|deadlift)/i;

export function isCompound(ex: Kind) {
  if (ISOLATION.test(ex.name)) return false;
  return COMPOUND.test(ex.name) || ex.secondary.length > 0;
}

// Big loaded lifts that need the longer rest.
export const isHeavyCompound = (ex: Kind) =>
  isCompound(ex) && ex.equipment !== 'bodyweight' && (ex.equipment === 'barbell' || HEAVY.test(ex.name));

export const HEAVY_REST_SECONDS = 120;

export const restSecondsFor = (ex: Kind, defaultRest: number) =>
  isHeavyCompound(ex) ? Math.max(HEAVY_REST_SECONDS, defaultRest) : defaultRest;

export function defaultReps(ex: Kind): { repsLow: number; repsHigh: number } {
  if (isHeavyCompound(ex)) return { repsLow: 6, repsHigh: 10 };
  if (isCompound(ex)) return { repsLow: 8, repsHigh: 12 };
  return { repsLow: 10, repsHigh: 15 };
}

// Staple lifts in a commercial gym. Used only when there is no history to learn from yet, so a
// brand new user still gets a sensible session instead of an alphabetical one.
export const STARTER_IDS = new Set([
  'barbell-bench-press', 'dumbbell-bench-press', 'incline-dumbbell-press', 'machine-chest-press', 'cable-fly', 'pec-deck', 'push-up',
  'lat-pulldown', 'seated-cable-row', 'barbell-row', 'dumbbell-row', 'pull-up', 'chest-supported-row', 'deadlift', 'face-pull',
  'overhead-press', 'dumbbell-shoulder-press', 'machine-shoulder-press', 'dumbbell-lateral-raise', 'cable-lateral-raise', 'reverse-pec-deck',
  'dumbbell-curl', 'hammer-curl', 'ez-bar-curl', 'cable-curl', 'triceps-pushdown', 'rope-triceps-pushdown', 'overhead-cable-triceps-extension', 'skull-crusher',
  'back-squat', 'leg-press', 'romanian-deadlift', 'walking-lunge', 'bulgarian-split-squat', 'leg-extension', 'seated-leg-curl', 'lying-leg-curl',
  'standing-calf-raise', 'barbell-hip-thrust', 'hack-squat', 'goblet-squat',
  'plank', 'hanging-knee-raise', 'hanging-leg-raise', 'cable-crunch', 'pallof-press', 'ab-wheel-rollout',
]);

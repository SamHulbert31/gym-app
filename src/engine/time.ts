import type { Exercise } from '../db/types';
import { restSecondsFor } from './classify';

// Time budget: each set is its work time plus rest (90 s by default, 120 s for heavy compound
// lifts), plus two minutes of setup per exercise.
export const WORK_SECONDS = 40;
export const SETUP_SECONDS = 120;

type Timed = Pick<Exercise, 'name' | 'equipment' | 'secondary'>;

export const secondsPerSet = (ex: Timed, defaultRest: number) => WORK_SECONDS + restSecondsFor(ex, defaultRest);

export const exerciseSeconds = (ex: Timed, sets: number, defaultRest: number) =>
  SETUP_SECONDS + sets * secondsPerSet(ex, defaultRest);

export const planSeconds = (items: { ex: Timed; sets: number }[], defaultRest: number) =>
  items.reduce((total, i) => total + exerciseSeconds(i.ex, i.sets, defaultRest), 0);

export const planMinutes = (seconds: number) => Math.round(seconds / 60);

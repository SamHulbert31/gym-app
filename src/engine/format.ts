import type { SetLog } from '../db/types';
import type { RecordEvent } from './records';

export const repsList = (sets: SetLog[]) => sets.map((s) => s.reps ?? '–').join(', ');

// "160 kg × 10, 10, 10, 9" when the weight was constant, else "160 × 10, 165 × 8".
export function lastTimeText(sets: SetLog[]) {
  const weights = new Set(sets.map((s) => s.weight ?? 0));
  if (weights.size === 1) {
    const w = sets[0].weight;
    return w ? `${w} kg × ${repsList(sets)}` : `${repsList(sets)} reps`;
  }
  return sets.map((s) => `${s.weight ?? 'BW'} × ${s.reps ?? '–'}`).join(', ');
}

// Home and the summary show a record as a value and a highlighted gain, e.g. "82.5 kg × 5" "+2.5".
export function formatRecord(e: RecordEvent): { value: string; gain: string } {
  const lift = e.weight ? `${e.weight} kg × ${e.reps}` : `${e.reps} reps`;
  switch (e.kind) {
    case 'weight':
      return { value: lift, gain: `+${e.delta}` };
    case 'reps':
      return { value: lift, gain: `+${e.delta} rep${e.delta === 1 ? '' : 's'}` };
    case 'e1rm':
      return { value: `${e.value} kg e1RM`, gain: `+${e.delta}` };
  }
}

// Estimates and changes: one decimal. 96 -> "96", 96.30000001 -> "96.3"
export const fmtNum = (n: number) => String(Number(n.toFixed(1)));

// Weights on the bar keep quarter steps: 83.75 stays 83.75.
export const fmtWeight = (n: number) => String(Number(n.toFixed(2)));

export const fmtKg = (n: number) => `${fmtNum(n)} kg`;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// "11 Nov", or "Wed 11 Nov" with the weekday.
export const shortDate = (iso: string | Date, weekday = false) => {
  const d = new Date(iso);
  return `${weekday ? WEEKDAYS[d.getDay()] + ' ' : ''}${d.getDate()} ${MONTHS[d.getMonth()]}`;
};

export const longDate = (d: Date, withYear = false) =>
  d.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', ...(withYear ? { year: 'numeric' } : {}) });

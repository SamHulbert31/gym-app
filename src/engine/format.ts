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

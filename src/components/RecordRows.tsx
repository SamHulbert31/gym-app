import type { Exercise } from '../db/types';
import { formatRecord } from '../engine/format';
import type { RecordEvent } from '../engine/records';

interface Props {
  events: RecordEvent[];
  exercises: Map<string, Exercise>;
  /** Show the exercise name on the left (default) or the date, for a single exercise's list. */
  left?: (e: RecordEvent) => string;
}

// One row per record: name on the left, "82.5 kg × 5 +2.5" on the right with the gain in the accent.
export default function RecordRows({ events, exercises, left }: Props) {
  return (
    <>
      {events.map((e) => {
        const f = formatRecord(e);
        return (
          <div key={`${e.workoutId}-${e.exerciseId}`} className="record-row">
            <div className="name">{left ? left(e) : (exercises.get(e.exerciseId)?.name ?? 'Exercise')}</div>
            <div className="val">
              {f.value} <span className="gain">{f.gain}</span>
            </div>
          </div>
        );
      })}
    </>
  );
}

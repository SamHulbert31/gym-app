import { describe, expect, it } from 'vitest';
import type { Workout } from '../db/types';
import { loggedExercises, thisWeek, weekStart, weeklyVolumes, workoutMinutes } from './stats';

// Local dates, so the week boundaries mean the same in any time zone.
const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h);

let n = 0;
function workout(date: Date, lifts: Record<string, [number, number][]>, status: Workout['status'] = 'done'): Workout {
  const iso = date.toISOString();
  return {
    id: `w${n++}`,
    source: 'manual',
    status,
    focus: [],
    startedAt: iso,
    endedAt: iso,
    exercises: Object.entries(lifts).map(([exerciseId, sets], order) => ({
      exerciseId,
      order,
      target: { sets: sets.length, repsLow: 8, repsHigh: 12 },
      sets: sets.map(([weight, reps]) => ({ weight, reps, done: true })),
    })),
    createdAt: iso,
    updatedAt: iso,
  };
}

describe('weekStart', () => {
  it('is Monday at local midnight', () => {
    const mon = at(2026, 11, 9, 0);
    expect(weekStart(at(2026, 11, 11))).toEqual(mon); // Wednesday
    expect(weekStart(at(2026, 11, 15, 23))).toEqual(mon); // Sunday night
    expect(weekStart(at(2026, 11, 9, 0))).toEqual(mon); // Monday itself
    expect(weekStart(at(2026, 11, 8, 23))).toEqual(at(2026, 11, 2, 0)); // the Sunday before
  });
});

describe('thisWeek', () => {
  const now = at(2026, 11, 11); // Wednesday
  it('marks trained days, counts sessions and sums volume for this week only', () => {
    const week = thisWeek(
      [
        workout(at(2026, 11, 9), { bench: [[100, 10]] }), // Mon: 1000
        workout(at(2026, 11, 11, 8), { squat: [[50, 10], [50, 10]] }), // Wed: 1000
        workout(at(2026, 11, 8), { bench: [[100, 10]] }), // last Sunday: not this week
        workout(at(2026, 11, 10), { bench: [[100, 10]] }, 'active'), // not finished
        { ...workout(at(2026, 11, 10), { bench: [[100, 10]] }), deletedAt: 'x' },
      ],
      now,
    );
    expect(week.trained).toEqual([true, false, true, false, false, false, false]);
    expect(week.sessions).toBe(2);
    expect(week.volume).toBe(2000);
  });

  it('is empty when nothing was done', () => {
    expect(thisWeek([], now)).toEqual({ trained: Array(7).fill(false), sessions: 0, volume: 0 });
  });
});

describe('weeklyVolumes', () => {
  it('gives eight weeks, oldest first, with the current week last', () => {
    const now = at(2026, 11, 11);
    const weeks = weeklyVolumes(
      [
        workout(at(2026, 11, 10), { a: [[100, 10]] }), // this week: 1000
        workout(at(2026, 11, 3), { a: [[100, 10]] }), // last week: 1000
        workout(at(2026, 11, 4), { a: [[50, 10]] }), // last week: 500
        workout(at(2026, 9, 14), { a: [[10, 10]] }), // eight weeks ago: out of range
      ],
      now,
    );
    expect(weeks).toHaveLength(8);
    expect(weeks[7]).toMatchObject({ kg: 1000, current: true });
    expect(weeks[6].kg).toBe(1500);
    expect(weeks.slice(0, 6).every((w) => w.kg === 0)).toBe(true);
    expect(weeks[7].start).toEqual(at(2026, 11, 9, 0));
    expect(weeks.filter((w) => w.current)).toHaveLength(1);
  });
});

describe('loggedExercises', () => {
  it('orders by sessions logged, then most recent', () => {
    const list = loggedExercises([
      workout(at(2026, 11, 1), { bench: [[80, 5]], row: [[60, 8]] }),
      workout(at(2026, 11, 3), { bench: [[80, 5]], squat: [[100, 5]] }),
      workout(at(2026, 11, 5), { squat: [[100, 5]] }),
    ]);
    expect(list.map((e) => [e.id, e.sessions])).toEqual([
      ['squat', 2],
      ['bench', 2],
      ['row', 1],
    ]);
  });
});

describe('workoutMinutes', () => {
  it('is the span between start and end, at least one minute', () => {
    const w = workout(at(2026, 11, 1), {});
    expect(workoutMinutes({ ...w, startedAt: at(2026, 11, 1, 10).toISOString(), endedAt: at(2026, 11, 1, 10).toISOString() })).toBe(1);
    expect(
      workoutMinutes({ ...w, startedAt: at(2026, 11, 1, 10).toISOString(), endedAt: new Date(at(2026, 11, 1, 10).getTime() + 47 * 60000).toISOString() }),
    ).toBe(47);
  });
});

import { describe, expect, it } from 'vitest';
import type { SetLog, Workout } from '../db/types';
import { bestsFor, recordEvents, setRecord } from './records';
import { exerciseHistory } from './history';

type Lift = [weight: number | undefined, reps: number];

let n = 0;
function workout(day: number, lifts: Record<string, Lift[]>, status: Workout['status'] = 'done'): Workout {
  const date = new Date(Date.UTC(2026, 9, day, 10)).toISOString();
  return {
    id: `w${n++}`,
    source: 'manual',
    status,
    focus: [],
    startedAt: date,
    endedAt: date,
    exercises: Object.entries(lifts).map(([exerciseId, sets], order) => ({
      exerciseId,
      order,
      target: { sets: sets.length, repsLow: 8, repsHigh: 12 },
      sets: sets.map(([weight, reps]): SetLog => ({ weight, reps, done: true })),
    })),
    createdAt: date,
    updatedAt: date,
  };
}

describe('recordEvents', () => {
  it('sets a baseline on the first session without reporting records', () => {
    expect(recordEvents([workout(1, { bench: [[80, 10], [85, 8]] })])).toEqual([]);
  });

  it('reports a heavier weight with the gain', () => {
    const events = recordEvents([workout(1, { bench: [[80, 10]] }), workout(3, { bench: [[82.5, 5]] })]);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ exerciseId: 'bench', kind: 'weight', weight: 82.5, reps: 5, delta: 2.5 });
  });

  it('reports more reps at a weight already lifted', () => {
    const events = recordEvents([workout(1, { row: [[73, 9]] }), workout(3, { row: [[73, 10]] })]);
    expect(events[0]).toMatchObject({ kind: 'reps', weight: 73, reps: 10, delta: 1 });
  });

  it('reports a better estimate when neither weight nor reps are records', () => {
    // 100 × 3 estimates 110; 90 × 8 estimates 114 at a lighter, never used weight.
    const events = recordEvents([workout(1, { squat: [[100, 3]] }), workout(3, { squat: [[90, 8]] })]);
    expect(events[0]).toMatchObject({ kind: 'e1rm', value: 114, delta: 4 });
  });

  it('reports at most one record per exercise per workout, heaviest weight first', () => {
    const events = recordEvents([workout(1, { bench: [[80, 10]] }), workout(3, { bench: [[82.5, 10], [85, 6]] })]);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ kind: 'weight', weight: 85, delta: 5 });
  });

  it('counts bodyweight reps as a reps record', () => {
    const events = recordEvents([workout(1, { pullup: [[undefined, 8]] }), workout(3, { pullup: [[undefined, 9]] })]);
    expect(events[0]).toMatchObject({ kind: 'reps', weight: 0, reps: 9, delta: 1 });
  });

  it('ignores unfinished, deleted and in-progress workouts and keeps date order', () => {
    const deleted = { ...workout(2, { bench: [[200, 10]] }), deletedAt: 'x' };
    const active = workout(4, { bench: [[200, 10]] }, 'active');
    const events = recordEvents([workout(5, { bench: [[90, 5]] }), deleted, active, workout(1, { bench: [[80, 10]] })]);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ kind: 'weight', weight: 90 });
  });
});

describe('setRecord', () => {
  it('compares a set against the bests so far', () => {
    const bests = bestsFor(exerciseHistory([workout(1, { bench: [[80, 10], [85, 8]] })], 'bench'));
    expect(setRecord({ weight: 90, reps: 5, done: true }, bests)?.kind).toBe('weight');
    expect(setRecord({ weight: 80, reps: 11, done: true }, bests)?.kind).toBe('reps');
    expect(setRecord({ weight: 85, reps: 8, done: true }, bests)).toBeUndefined();
    expect(setRecord({ weight: 90, reps: 5, done: false }, bests)).toBeUndefined();
  });
});

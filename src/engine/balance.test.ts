import { describe, expect, it } from 'vitest';
import type { Muscle, Workout } from '../db/types';
import { muscleBalance } from './balance';

const NOW = new Date('2026-11-11T10:00:00Z');
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86400000).toISOString();

const exercises = new Map<string, { primary: Muscle; name?: string }>([
  ['bench', { primary: 'chest' }],
  ['row', { primary: 'back' }],
  ['press', { primary: 'shoulders' }],
  ['curl', { primary: 'arms', name: 'Dumbbell curl' }],
  ['pushdown', { primary: 'arms', name: 'Triceps pushdown' }],
  ['squat', { primary: 'legs' }],
  ['plank', { primary: 'core' }],
]);

let n = 0;
function workout(ago: number, sets: Record<string, number>, status: Workout['status'] = 'done'): Workout {
  const date = daysAgo(ago);
  return {
    id: `w${n++}`,
    source: 'manual',
    status,
    focus: [],
    startedAt: date,
    endedAt: date,
    exercises: Object.entries(sets).map(([exerciseId, count], order) => ({
      exerciseId,
      order,
      target: { sets: count, repsLow: 8, repsHigh: 12 },
      sets: Array.from({ length: count }, () => ({ weight: 50, reps: 10, done: true })),
    })),
    createdAt: date,
    updatedAt: date,
  };
}

describe('muscleBalance', () => {
  it('counts done sets per primary muscle in the last 14 days', () => {
    const b = muscleBalance([workout(2, { bench: 4, row: 3 }), workout(9, { bench: 2, squat: 3 })], exercises, NOW);
    expect(b.sets).toMatchObject({ chest: 6, back: 3, legs: 3, shoulders: 0, arms: 0, core: 0 });
    expect(b.total).toBe(12);
  });

  it('leaves out sets older than the window and planned workouts', () => {
    const b = muscleBalance([workout(15, { bench: 4 }), workout(1, { row: 2 }, 'planned')], exercises, NOW);
    expect(b.total).toBe(0);
  });

  it('counts sets from a session in progress', () => {
    const b = muscleBalance([workout(0, { bench: 3 }, 'active')], exercises, NOW);
    expect(b.sets.chest).toBe(3);
  });

  it('flags a muscle as lagging under half the median', () => {
    const b = muscleBalance(
      [workout(1, { row: 16, bench: 14, curl: 5, pushdown: 5, press: 8, squat: 4, plank: 3 })],
      exercises,
      NOW,
    );
    expect(b.median).toBe(9);
    expect(b.lagging).toEqual(['legs', 'core']);
    expect(b.sentence).toBe('Legs and core are behind. The next generated session will lean that way unless you choose otherwise.');
  });

  it('words a single lagging muscle and the balanced case', () => {
    expect(muscleBalance([workout(1, { row: 10, bench: 10, curl: 10, press: 10, squat: 10, plank: 2 })], exercises, NOW).sentence).toMatch(
      /^Core is behind/,
    );
    const even = muscleBalance([workout(1, { row: 5, bench: 5, curl: 5, press: 5, squat: 5, plank: 5 })], exercises, NOW);
    expect(even.lagging).toEqual([]);
    expect(even.sentence).toMatch(/balanced/i);
  });

  it('splits arms into biceps and triceps without changing the arms total', () => {
    const b = muscleBalance([workout(1, { curl: 4, pushdown: 3, bench: 3 })], exercises, NOW);
    expect(b.sets.arms).toBe(7);
    expect(b.armParts).toEqual({ biceps: 4, triceps: 3 });
    expect(b.laggingPart).toBeUndefined();
  });

  it('says when one side of the arms is behind the other', () => {
    const b = muscleBalance([workout(1, { row: 6, bench: 6, curl: 5, pushdown: 1, press: 6, squat: 6, plank: 6 })], exercises, NOW);
    expect(b.lagging).toEqual([]);
    expect(b.laggingPart).toBe('triceps');
    expect(b.sentence).toMatch(/Triceps are behind biceps/);
  });

  it('does not compare arm sides on too few sets', () => {
    expect(muscleBalance([workout(1, { curl: 2 })], exercises, NOW).laggingPart).toBeUndefined();
  });

  it('flags the untrained muscles when most have no sets', () => {
    const b = muscleBalance([workout(1, { curl: 2, pushdown: 1 })], exercises, NOW);
    expect(b.median).toBe(0);
    expect(b.lagging).toEqual(['chest', 'back', 'shoulders', 'legs', 'core']);
    expect(b.sentence).toBe(
      'Only arms in the last two weeks, so everything else is behind. The next generated session will lean that way unless you choose otherwise.',
    );
    const two = muscleBalance([workout(1, { bench: 3, squat: 3 })], exercises, NOW);
    expect(two.lagging).toEqual(['back', 'shoulders', 'arms', 'core']);
    expect(two.sentence).toMatch(/^Only chest and legs in the last two weeks/);
  });

  it('says so plainly when nothing has been logged', () => {
    const b = muscleBalance([], exercises, NOW);
    expect(b.lagging).toEqual([]);
    expect(b.sentence).toMatch(/No sets logged/);
  });
});

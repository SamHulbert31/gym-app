import { describe, expect, it } from 'vitest';
import type { ExerciseSession } from './history';
import { incrementFor, roundTo, suggestWeight } from './progression';

const NOW = new Date('2026-11-11T10:00:00Z');
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86400000).toISOString();
const RANGE = { repsLow: 8, repsHigh: 12 };
const barbell = { equipment: 'barbell' } as const;

// A finished session with every set at one weight.
function session(ago: number, weight: number | undefined, reps: number[], range = RANGE): ExerciseSession {
  return {
    workoutId: `w${ago}`,
    date: daysAgo(ago),
    target: { sets: reps.length, ...range, weight },
    sets: reps.map((r) => ({ weight, reps: r, done: true })),
  };
}

const suggest = (history: ExerciseSession[], ex: Parameters<typeof suggestWeight>[0] = barbell) =>
  suggestWeight(ex, history, RANGE, NOW);

describe('increments', () => {
  it('uses equipment defaults and the per exercise override', () => {
    expect(incrementFor({ equipment: 'barbell' })).toBe(2.5);
    expect(incrementFor({ equipment: 'dumbbell' })).toBe(2);
    expect(incrementFor({ equipment: 'machine' })).toBe(5);
    expect(incrementFor({ equipment: 'cable' })).toBe(5);
    expect(incrementFor({ equipment: 'kettlebell' })).toBe(2.5);
    expect(incrementFor({ equipment: 'barbell', increment: 1.25 })).toBe(1.25);
    expect(incrementFor({ equipment: 'barbell' }, { barbell: 5 })).toBe(5);
  });

  it('rounds to the increment cleanly', () => {
    expect(roundTo(92.4, 2.5)).toBe(92.5);
    expect(roundTo(18.5, 2)).toBe(18);
    expect(roundTo(0.1 + 0.2, 0.1)).toBe(0.3);
  });
});

describe('suggestWeight', () => {
  it('has no weight without history', () => {
    const s = suggest([]);
    expect(s.reason).toBe('none');
    expect(s.weight).toBeUndefined();
  });

  it('goes up one increment when every set reached the top', () => {
    expect(suggest([session(3, 100, [12, 12, 12])])).toMatchObject({ reason: 'up', weight: 102.5, lastWeight: 100 });
    expect(suggest([session(3, 20, [12, 12])], { equipment: 'dumbbell' }).weight).toBe(22);
    expect(suggest([session(3, 100, [12, 12])], { equipment: 'machine' }).weight).toBe(105);
    expect(suggest([session(3, 60, [12, 12])], { equipment: 'barbell', increment: 1.25 }).weight).toBe(61.25);
  });

  it('keeps the weight when sets landed inside the range', () => {
    expect(suggest([session(3, 100, [12, 10, 9])])).toMatchObject({ reason: 'same', weight: 100 });
    expect(suggest([session(3, 100, [8, 8, 8])])).toMatchObject({ reason: 'same', weight: 100 });
  });

  it('keeps the weight after a single session with a set under the range', () => {
    expect(suggest([session(10, 100, [10, 10, 10]), session(3, 100, [9, 7, 6])])).toMatchObject({ reason: 'same', weight: 100 });
  });

  it('drops about 5 to 10 percent after two sessions in a row under the range', () => {
    const history = [session(10, 100, [8, 7, 6]), session(3, 100, [8, 6, 5])];
    expect(suggest(history)).toMatchObject({ reason: 'down', weight: 92.5 });
    // Always at least one increment below, and never below one increment.
    expect(suggest([session(10, 20, [6, 5]), session(3, 20, [6, 5])], { equipment: 'dumbbell' }).weight).toBe(18);
    expect(suggest([session(10, 5, [6, 5]), session(3, 5, [6, 5])], { equipment: 'machine' }).weight).toBe(5);
  });

  it('judges each past session against its own rep range', () => {
    const history = [session(10, 100, [6, 6], { repsLow: 5, repsHigh: 8 }), session(3, 100, [7, 6])];
    // Last session was under 8, but the one before was inside its own 5 to 8 range.
    expect(suggest(history).reason).toBe('same');
    // Top of a 5 to 8 range counts as hitting the top.
    expect(suggest([session(3, 100, [8, 8], { repsLow: 5, repsHigh: 8 })])).toMatchObject({ reason: 'up', weight: 102.5 });
  });

  it('suggests about 10 percent less after more than four weeks away', () => {
    expect(suggest([session(29, 100, [12, 12, 12])])).toMatchObject({ reason: 'stale', weight: 90 });
    expect(suggest([session(28, 100, [12, 12, 12])]).reason).toBe('up');
    expect(suggest([session(40, 60, [10, 10])]).weight).toBe(55);
  });

  it('uses the heaviest weight of the last session as the working weight', () => {
    const warmup: ExerciseSession = {
      workoutId: 'w',
      date: daysAgo(2),
      target: { sets: 3, ...RANGE },
      sets: [
        { weight: 60, reps: 12, done: true },
        { weight: 100, reps: 12, done: true },
        { weight: 100, reps: 12, done: true },
      ],
    };
    expect(suggest([warmup])).toMatchObject({ reason: 'up', weight: 102.5 });
  });

  it('ignores sets that were not done', () => {
    const s = session(3, 100, [12, 12]);
    s.sets.push({ weight: 100, reps: 3, done: false });
    expect(suggest([s]).reason).toBe('up');
  });

  it('gives no weight for bodyweight work', () => {
    const s = suggest([session(3, undefined, [10, 10])]);
    expect(s.reason).toBe('bodyweight');
    expect(s.weight).toBeUndefined();
  });

  it('writes a coaching line that names the new weight', () => {
    const up = suggest([session(3, 100, [12, 12, 12])]);
    expect(up.coaching).toContain('102.5 kg');
    expect(up.coaching).toContain('12, 12, 12');
    expect(suggest([session(3, 100, [10, 10])]).coaching).toContain('2.5 kg');
    expect(suggest([session(40, 100, [10, 10])]).coaching).toMatch(/5 weeks/);
  });
});

import { describe, expect, it } from 'vitest';
import { epley, sessionE1rm } from './e1rm';

describe('epley', () => {
  it('estimates weight × (1 + reps / 30)', () => {
    expect(epley(100, 10)).toBeCloseTo(133.3, 1);
    expect(epley(82.5, 5)).toBeCloseTo(96.3, 1);
    expect(epley(100, 1)).toBeCloseTo(103.3, 1);
  });

  it('gives no estimate for sets over 12 reps or without a weight', () => {
    expect(epley(100, 13)).toBeUndefined();
    expect(epley(0, 10)).toBeUndefined();
    expect(epley(100, 0)).toBeUndefined();
  });
});

describe('sessionE1rm', () => {
  it('is the best done set that day', () => {
    const best = sessionE1rm([
      { weight: 100, reps: 10, done: true },
      { weight: 110, reps: 8, done: true },
      { weight: 120, reps: 5, done: false },
    ]);
    expect(best?.set.weight).toBe(110);
    expect(best?.value).toBeCloseTo(139.3, 1);
  });

  it('is undefined when no set qualifies', () => {
    expect(sessionE1rm([{ weight: 50, reps: 15, done: true }, { reps: 10, done: true }])).toBeUndefined();
  });
});

import { describe, expect, it } from 'vitest';
import type { ExerciseSession } from './history';
import { bestSet, chartGeometry, forecast, seriesFor, type Point } from './progress';
import { latestRecords, type RecordEvent } from './records';

const NOW = new Date('2026-11-11T10:00:00Z');
const WEEK = 7 * 24 * 60 * 60 * 1000;
const weeksAgo = (w: number) => new Date(NOW.getTime() - w * WEEK).toISOString();

const sess = (date: string, sets: [number | undefined, number][]): ExerciseSession => ({
  workoutId: date,
  date,
  target: { sets: sets.length, repsLow: 8, repsHigh: 12 },
  sets: sets.map(([weight, reps]) => ({ weight, reps, done: true })),
});

describe('seriesFor', () => {
  it('charts the best estimated 1RM of each session for weighted lifts', () => {
    const { metric, points } = seriesFor([
      sess(weeksAgo(2), [[80, 10], [85, 5]]),
      sess(weeksAgo(1), [[90, 5]]),
    ]);
    expect(metric).toBe('e1rm');
    expect(points.map((p) => p.value)).toEqual([106.7, 105]);
  });

  it('falls back to best reps for bodyweight work', () => {
    const { metric, points } = seriesFor([sess(weeksAgo(2), [[undefined, 8], [undefined, 6]]), sess(weeksAgo(1), [[undefined, 9]])]);
    expect(metric).toBe('reps');
    expect(points.map((p) => p.value)).toEqual([8, 9]);
  });
});

describe('bestSet', () => {
  it('is the highest estimate for weighted lifts and the most reps otherwise', () => {
    const history = [sess(weeksAgo(2), [[100, 5], [80, 12]]), sess(weeksAgo(1), [[95, 8]])];
    expect(bestSet(history, 'e1rm')).toMatchObject({ weight: 95, reps: 8 });
    expect(bestSet([sess(weeksAgo(1), [[undefined, 7], [undefined, 12]])], 'reps')).toMatchObject({ reps: 12 });
  });
});

describe('forecast', () => {
  const rising = (values: number[]): Point[] => values.map((value, i) => ({ date: weeksAgo(values.length - 1 - i), value }));

  it('needs four points in the last 12 weeks', () => {
    expect(forecast(rising([90, 91, 92]), NOW)).toEqual({ kind: 'few', have: 3 });
    const old: Point[] = [20, 19, 18, 17].map((w) => ({ date: weeksAgo(w), value: 90 + w }));
    expect(forecast(old, NOW)).toEqual({ kind: 'few', have: 0 });
  });

  it('is hidden for a flat or falling trend', () => {
    expect(forecast(rising([95, 95, 95, 95]), NOW)).toEqual({ kind: 'flat' });
    expect(forecast(rising([100, 99, 98, 97]), NOW)).toEqual({ kind: 'flat' });
  });

  it('gives the weekly rate and the date of the next round milestone', () => {
    const f = forecast(rising([90, 91, 92, 93]), NOW);
    expect(f.kind).toBe('ok');
    if (f.kind !== 'ok') return;
    expect(f.ratePerWeek).toBeCloseTo(1, 5);
    expect(f.milestone).toBe(95);
    expect(f.date.getTime()).toBeCloseTo(NOW.getTime() + 2 * WEEK, -3);
  });

  it('moves the milestone up when the latest value sits on a round number', () => {
    const f = forecast(rising([97, 98, 99, 100]), NOW);
    expect(f.kind === 'ok' && f.milestone).toBe(105);
  });

  it('shows a slow but rising trend with a distant date, and hides one below 0.1 a week', () => {
    const slow = forecast(rising([90, 90.15, 90.3, 90.45]), NOW);
    expect(slow.kind === 'ok' && slow.date.getTime() - NOW.getTime()).toBeLessThan(52 * WEEK);
    expect(forecast(rising([90, 90.03, 90.06, 90.09]), NOW)).toEqual({ kind: 'flat' });
  });
});

describe('chartGeometry', () => {
  it('maps the lowest value to the bottom and the highest to the top, like the mockup', () => {
    const start = new Date(NOW.getTime() - 12 * WEEK);
    const g = chartGeometry(
      [
        { date: start.toISOString(), value: 87.5 },
        { date: NOW.toISOString(), value: 96 },
      ],
      start,
      NOW,
    );
    expect(g.points).toEqual([
      { x: 6, y: 96.4 },
      { x: 311.8, y: 19.1 },
    ]);
    expect(g.ticks.map((t) => t.value)).toEqual([90, 95]);
    expect(g.ticks.map((t) => t.y)).toEqual([73.7, 28.2]);
  });

  it('centres a single point and never leaves the plot area', () => {
    const start = new Date(NOW.getTime() - 12 * WEEK);
    const g = chartGeometry([{ date: NOW.toISOString(), value: 100 }], start, NOW);
    expect(g.points).toHaveLength(1);
    expect(g.points[0].y).toBeGreaterThan(19);
    expect(g.points[0].y).toBeLessThan(97);
  });
});

describe('latestRecords', () => {
  const ev = (exerciseId: string, date: string): RecordEvent => ({
    exerciseId,
    workoutId: date,
    date,
    kind: 'weight',
    weight: 100,
    reps: 5,
    value: 100,
    delta: 2.5,
  });

  it('keeps the newest record per exercise, newest first, up to the limit', () => {
    const out = latestRecords(
      [ev('bench', '2026-11-01'), ev('bench', '2026-11-08'), ev('row', '2026-11-05'), ev('squat', '2026-11-02'), ev('curl', '2026-10-01')],
      3,
    );
    expect(out.map((e) => [e.exerciseId, e.date])).toEqual([
      ['bench', '2026-11-08'],
      ['row', '2026-11-05'],
      ['squat', '2026-11-02'],
    ]);
  });
});

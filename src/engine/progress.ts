import type { SetLog } from '../db/types';
import { sessionE1rm, setE1rm } from './e1rm';
import type { ExerciseSession } from './history';

export type Metric = 'e1rm' | 'reps';

export interface Point {
  date: string;
  value: number;
}

export const WINDOW_WEEKS = 12;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// Weighted lifts chart the estimated one rep max (best set of each session). Bodyweight lifts,
// or lifts only ever done for more than 12 reps, chart their best reps in a set instead.
export function seriesFor(history: ExerciseSession[]): { metric: Metric; points: Point[] } {
  const e1rm: Point[] = [];
  for (const s of history) {
    const best = sessionE1rm(s.sets);
    if (best) e1rm.push({ date: s.date, value: best.value });
  }
  if (e1rm.length) return { metric: 'e1rm', points: e1rm };

  const reps: Point[] = [];
  for (const s of history) {
    const best = Math.max(0, ...s.sets.map((x) => x.reps ?? 0));
    if (best > 0) reps.push({ date: s.date, value: best });
  }
  return { metric: 'reps', points: reps };
}

// The single best set ever: highest estimate for weighted lifts, most reps otherwise.
export function bestSet(history: ExerciseSession[], metric: Metric): SetLog | undefined {
  let best: SetLog | undefined;
  let bestScore = -1;
  for (const session of history) {
    for (const s of session.sets) {
      if (!s.done || !s.reps) continue;
      const score = metric === 'e1rm' ? (setE1rm(s) ?? -1) : s.reps + (s.weight ?? 0) / 10000;
      if (score > bestScore) {
        bestScore = score;
        best = s;
      }
    }
  }
  return best;
}

export const windowStart = (now: Date) => new Date(now.getTime() - WINDOW_WEEKS * WEEK_MS);

export const inWindow = (points: Point[], now: Date) => {
  const start = windowStart(now).getTime();
  return points.filter((p) => new Date(p.date).getTime() >= start);
};

export type Forecast =
  | { kind: 'few'; have: number }
  | { kind: 'flat' }
  | { kind: 'ok'; ratePerWeek: number; milestone: number; date: Date };

export const MIN_FORECAST_POINTS = 4;
export const MIN_RATE = 0.1; // per week; anything slower is treated as flat
const MILESTONE_STEP = 5;

// Straight line fit over the last 12 weeks. Needs four points and a rising trend, otherwise
// the caller says plainly why there is no forecast. Rising at least 0.1 a week and aiming for
// the next multiple of 5 keeps the projected date within about a year.
export function forecast(points: Point[], now: Date): Forecast {
  const pts = inWindow(points, now);
  if (pts.length < MIN_FORECAST_POINTS) return { kind: 'few', have: pts.length };

  const xs = pts.map((p) => (new Date(p.date).getTime() - now.getTime()) / WEEK_MS); // weeks, <= 0
  const ys = pts.map((p) => p.value);
  const n = pts.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  const sxx = xs.reduce((a, x) => a + (x - mx) ** 2, 0);
  if (sxx === 0) return { kind: 'flat' };
  const slope = xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0) / sxx;
  if (slope < MIN_RATE) return { kind: 'flat' };

  const fittedNow = my - slope * mx;
  const latest = ys[n - 1];
  const milestone = Math.floor(Math.max(latest, fittedNow) / MILESTONE_STEP) * MILESTONE_STEP + MILESTONE_STEP;
  const weeks = (milestone - fittedNow) / slope;
  return {
    kind: 'ok',
    ratePerWeek: slope,
    milestone,
    date: new Date(now.getTime() + weeks * WEEK_MS),
  };
}

// ---------- Line chart geometry (matches the 318 × 124 mockup) ----------

const X0 = 6;
const X1 = 311.8;
const Y_TOP = 19.1;
const Y_BOTTOM = 96.4;
const STEPS = [1, 2, 2.5, 5, 10, 20, 25, 50, 100];

export interface ChartGeometry {
  points: { x: number; y: number }[];
  ticks: { value: number; y: number }[];
}

export function chartGeometry(points: Point[], start: Date, end: Date): ChartGeometry {
  if (!points.length) return { points: [], ticks: [] };
  let min = Math.min(...points.map((p) => p.value));
  let max = Math.max(...points.map((p) => p.value));
  if (max - min < 1) {
    const mid = (min + max) / 2;
    min = mid - 1;
    max = mid + 1;
  }
  const span = Math.max(1, end.getTime() - start.getTime());
  const y = (v: number) => Number((Y_BOTTOM - ((v - min) / (max - min)) * (Y_BOTTOM - Y_TOP)).toFixed(1));

  const pts = points.map((p) => {
    const t = (new Date(p.date).getTime() - start.getTime()) / span;
    return { x: Number((X0 + Math.min(1, Math.max(0, t)) * (X1 - X0)).toFixed(1)), y: y(p.value) };
  });

  // Gridlines at round values: the smallest step that leaves one or two of them in range.
  let ticks: number[] = [];
  for (const step of STEPS) {
    const found: number[] = [];
    for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) found.push(Number(v.toFixed(2)));
    if (found.length >= 1 && found.length <= 2) {
      ticks = found;
      break;
    }
  }
  return { points: pts, ticks: ticks.map((value) => ({ value, y: y(value) })) };
}

import type { Exercise, Muscle, Workout } from '../db/types';
import { defaultReps, isCompound, isHeavyCompound, STARTER_IDS } from './classify';
import { exerciseSeconds, secondsPerSet } from './time';
import { buildUsage, type Usage } from './usage';

export interface PlanItem {
  exerciseId: string;
  target: { sets: number; repsLow: number; repsHigh: number };
  swappedFromExerciseId?: string;
}

export interface GenerateInput {
  focus: Muscle[] | ['full'];
  minutes: number;
  /** Free text. The rule based path only understands simple "busy / no / avoid" notes. */
  note?: string;
  /** The whole library, including unavailable and deleted records (they are filtered here). */
  exercises: Exercise[];
  workouts: Workout[];
  restSeconds: number;
  now: Date;
  /** Exercises of the previous plan, so generating again gives something different. */
  avoid?: Iterable<string>;
  /** Sets per muscle recently. When time only allows some muscles, the lagging ones win. */
  muscleSets?: Record<Muscle, number>;
  rng?: () => number;
}

export const PRIORITY: Muscle[] = ['legs', 'back', 'chest', 'shoulders', 'arms', 'core'];

// Rough share of a session each muscle deserves, and the most exercises it can sensibly take.
const WEIGHT: Record<Muscle, number> = { legs: 1.5, back: 1.2, chest: 1.2, shoulders: 1, arms: 1, core: 0.7 };
const CAP: Record<Muscle, number> = { legs: 8, back: 6, chest: 6, shoulders: 5, arms: 5, core: 4 };
const MAX_EXERCISES = 8;
const DAY_MS = 24 * 60 * 60 * 1000;

// ---------- Notes like "squat racks are busy tonight" ----------

const CUE =
  /\b(busy|taken|occupied|crowded|no|not|avoid|skip|without|broken|out of order|can't|cant|cannot|don't|dont|hate|sore|hurts?|injured|injury)\b/i;
const IGNORE = new Set(
  'tonight today time much really want feel little lot gym workout session available anything some have busy taken occupied crowded avoid skip without broken order sore hurts hurt injured injury hate cant dont cannot nothing with that this they them from what when were been just also going only like need very more less'.split(
    ' ',
  ),
);
const stem = (w: string) => w.replace(/s$/, '');

// With a negative cue in the note, anything it names (an exercise word, a kind of equipment or a
// muscle) is left out. Without a cue the note is ignored here; the AI path reads it properly.
export function parseNoteAvoid(note?: string): (ex: Pick<Exercise, 'name' | 'equipment' | 'primary'>) => boolean {
  if (!note || !CUE.test(note)) return () => false;
  const words = note.toLowerCase().match(/[a-z']+/g) ?? [];
  const tokens = new Set(words.filter((w) => w.length >= 4 && !IGNORE.has(w)).map(stem));
  if (!tokens.size) return () => false;
  return (ex) => {
    const nameTokens = (ex.name.toLowerCase().match(/[a-z]+/g) ?? []).map(stem);
    return nameTokens.some((t) => tokens.has(t)) || tokens.has(stem(ex.equipment)) || tokens.has(stem(ex.primary));
  };
}

// ---------- Quotas ----------

// Splits `total` exercises across muscles by weight (largest remainder), at least one each.
function allocate(muscles: Muscle[], total: number): Record<Muscle, number> {
  const sum = muscles.reduce((a, m) => a + WEIGHT[m], 0);
  const exact = muscles.map((m) => (total * WEIGHT[m]) / sum);
  const q = exact.map((e) => Math.max(1, Math.floor(e)));
  let left = total - q.reduce((a, b) => a + b, 0);
  const byRemainder = muscles.map((_, i) => i).sort((a, b) => exact[b] - Math.floor(exact[b]) - (exact[a] - Math.floor(exact[a])));
  for (const i of byRemainder) {
    if (left <= 0) break;
    if (q[i] < CAP[muscles[i]]) {
      q[i]++;
      left--;
    }
  }
  return Object.fromEntries(muscles.map((m, i) => [m, Math.min(q[i], CAP[m])])) as Record<Muscle, number>;
}

// ---------- The generator ----------

export interface PlanPick {
  ex: Exercise;
  muscle: Muscle;
  order: number;
  sets: number;
}

export function generatePlan(input: GenerateInput): PlanItem[] {
  const rng = input.rng ?? Math.random;
  const budget = input.minutes * 60;
  const rest = input.restSeconds;
  const exMap = new Map(input.exercises.map((e) => [e.id, e]));
  const usage = buildUsage(input.workouts, exMap);
  const avoidNote = parseNoteAvoid(input.note);
  const avoid = new Set(input.avoid ?? []);
  const pool = input.exercises.filter((e) => !e.deletedAt && !e.unavailable && !avoidNote(e));

  const full = input.focus.length === 1 && input.focus[0] === 'full';
  const requested = full ? PRIORITY : ([...new Set(input.focus)] as Muscle[]);
  const lag = input.muscleSets;
  const ordered = [...requested].sort((a, b) => (lag ? lag[a] - lag[b] : 0) || PRIORITY.indexOf(a) - PRIORITY.indexOf(b));

  const maxEx = Math.min(MAX_EXERCISES, Math.max(2, Math.ceil(input.minutes / 10)));
  const muscles = ordered.slice(0, maxEx);
  const quota = allocate(muscles, maxEx);

  const affinity = new Map(muscles.map((m) => [m, usage.affinity(m)]));
  const knownIn = new Map(muscles.map((m) => [m, pool.some((e) => e.primary === m && (usage.count.get(e.id) ?? 0) > 0)]));
  // With history, at most one unfamiliar exercise per session, unless a muscle has never been logged at all.
  let unfamiliarLeft = usage.workouts === 0 ? Infinity : 1;

  const score = (ex: Exercise, m: Muscle, k: number) => {
    const n = usage.count.get(ex.id) ?? 0;
    let s = 0;
    if (n > 0) {
      s += 10 + Math.min(n, 10);
      const last = usage.last.get(ex.id);
      if (last && (input.now.getTime() - new Date(last).getTime()) / DAY_MS <= 56) s += 2;
    } else {
      // Staples guide a cold start; once there is history, what he actually uses guides instead.
      if (STARTER_IDS.has(ex.id)) s += usage.workouts === 0 ? 5 : 1;
      if (ex.equipment === 'other') s -= 1;
    }
    s += (affinity.get(m)?.get(ex.equipment) ?? 0) * 6; // equipment he tends to use for this muscle
    s -= 8 * Math.min(usage.swappedAway.get(ex.id) ?? 0, 3); // things he keeps swapping away from
    if (avoid.has(ex.id)) s -= 6;
    if (m !== 'core') s += isCompound(ex) === (k % 2 === 0) ? 5 : 0; // compound, isolation, compound...
    return s + rng() * 3;
  };

  const taken = new Set<string>();
  const picks: PlanPick[] = [];
  const filled = new Map(muscles.map((m) => [m, 0]));
  const pickFor = (m: Muscle): Exercise | undefined => {
    const k = filled.get(m) ?? 0;
    const ranked = pool
      .filter((e) => e.primary === m && !taken.has(e.id))
      .map((e) => ({ e, s: score(e, m, k) }))
      .sort((a, b) => b.s - a.s);
    for (const { e } of ranked) {
      const unfamiliar = (usage.count.get(e.id) ?? 0) === 0;
      const counts = unfamiliar && knownIn.get(m);
      if (counts && unfamiliarLeft <= 0) continue;
      if (counts) unfamiliarLeft--;
      return e;
    }
    return undefined;
  };

  let progressed = true;
  while (progressed) {
    progressed = false;
    for (const m of muscles) {
      if ((filled.get(m) ?? 0) >= quota[m]) continue;
      const ex = pickFor(m);
      if (!ex) {
        filled.set(m, quota[m]);
        continue;
      }
      taken.add(ex.id);
      picks.push({ ex, muscle: m, order: picks.length, sets: 3 });
      filled.set(m, (filled.get(m) ?? 0) + 1);
      progressed = true;
    }
  }

  // One heavier first lift per muscle when the session is focused on one or two muscles.
  const seen = new Set<Muscle>();
  for (const p of picks) {
    if (isCompound(p.ex) && !seen.has(p.muscle)) {
      seen.add(p.muscle);
      if (muscles.length <= 2) p.sets = 4;
    }
  }

  const items = fitToBudget(orderCompoundFirst(picks), budget, rest);
  return items.map((p) => ({ exerciseId: p.ex.id, target: { sets: p.sets, ...defaultReps(p.ex) } }));
}

// Compound lifts first, heavy ones before light, then by muscle priority.
export const orderCompoundFirst = (picks: PlanPick[]) =>
  [...picks].sort(
    (a, b) =>
      Number(isCompound(b.ex)) - Number(isCompound(a.ex)) ||
      Number(isHeavyCompound(b.ex)) - Number(isHeavyCompound(a.ex)) ||
      PRIORITY.indexOf(a.muscle) - PRIORITY.indexOf(b.muscle) ||
      a.order - b.order,
  );

// Makes a plan fit its time budget, whoever chose the exercises.
export function fitToBudget(items: PlanPick[], budget: number, rest: number): PlanPick[] {
  const total = () => items.reduce((t, i) => t + exerciseSeconds(i.ex, i.sets, rest), 0);
  const lastWhere = (pred: (p: PlanPick) => boolean) => {
    for (let i = items.length - 1; i >= 0; i--) if (pred(items[i])) return i;
    return -1;
  };

  // Trim to fit: shave isolation sets, then compound sets, then drop the last exercise of a muscle
  // that has more than one, then anything but the first exercise.
  while (total() > budget && items.length) {
    let i = lastWhere((p) => !isCompound(p.ex) && p.sets > 2);
    if (i >= 0) {
      items[i].sets--;
      continue;
    }
    i = lastWhere((p) => isCompound(p.ex) && p.sets > 3);
    if (i >= 0) {
      items[i].sets--;
      continue;
    }
    i = lastWhere((p) => items.filter((x) => x.muscle === p.muscle).length > 1);
    if (i >= 0) {
      items.splice(i, 1);
      continue;
    }
    if (items.length > 1) {
      items.pop();
      continue;
    }
    if (items[0].sets > 2) {
      items[0].sets--;
      continue;
    }
    break;
  }

  // Use up leftover time with extra sets rather than leaving the session short.
  for (let grew = true; grew; ) {
    grew = false;
    for (const p of items) {
      const max = isCompound(p.ex) ? 5 : 4;
      if (p.sets < max && total() + secondsPerSet(p.ex, rest) <= budget) {
        p.sets++;
        grew = true;
      }
    }
  }

  return items;
}

// ---------- Swap alternatives ----------

// Same primary muscle, exercises he has logged first (most used first), then the equipment he
// tends to use for that muscle, then staples. Things he keeps swapping away from sink.
export function alternativesFor(current: Exercise, library: Exercise[], usage: Usage, exclude: Iterable<string> = []): Exercise[] {
  const skip = new Set(exclude);
  skip.add(current.id);
  const affinity = usage.affinity(current.primary);
  const used = (e: Exercise) => usage.count.get(e.id) ?? 0;
  return library
    .filter((e) => !e.deletedAt && !e.unavailable && e.primary === current.primary && !skip.has(e.id))
    .sort(
      (a, b) =>
        used(b) - used(a) ||
        (usage.swappedAway.get(a.id) ?? 0) - (usage.swappedAway.get(b.id) ?? 0) ||
        (affinity.get(b.equipment) ?? 0) - (affinity.get(a.equipment) ?? 0) ||
        Number(STARTER_IDS.has(b.id)) - Number(STARTER_IDS.has(a.id)) ||
        a.name.localeCompare(b.name),
    );
}

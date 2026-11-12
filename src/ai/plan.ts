import { EQUIPMENT, MUSCLES, type Equipment, type Exercise, type Muscle, type Workout } from '../db/types';
import { muscleBalance } from '../engine/balance';
import { armPart, defaultReps, isCompound } from '../engine/classify';
import { fitToBudget, orderCompoundFirst, type PlanItem, type PlanPick } from '../engine/generate';
import { doneWorkouts, workoutDate } from '../engine/history';
import { buildUsage } from '../engine/usage';
import { AiError, type AiProvider } from './provider';

export interface AiPlanInput {
  focus: Muscle[] | ['full'];
  minutes: number;
  note?: string;
  exercises: Exercise[];
  workouts: Workout[];
  restSeconds: number;
  now: Date;
  avoid?: string[];
  /** Makes a custom exercise when nothing in the library fits. */
  createExercise: (init: { name: string; primary: Muscle; equipment: Equipment }) => Promise<Exercise>;
}

// What we ask for: an ordered list of exercises, each by library id or, failing that, by name.
const SCHEMA = {
  type: 'object',
  properties: {
    exercises: {
      type: 'array',
      minItems: 1,
      maxItems: 10,
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'An id from the library. Leave out only for a new exercise.' },
          name: { type: 'string', description: 'Only for a new exercise not in the library.' },
          primary: { type: 'string', enum: [...MUSCLES], description: 'Only for a new exercise.' },
          equipment: { type: 'string', enum: [...EQUIPMENT], description: 'Only for a new exercise.' },
          sets: { type: 'integer', minimum: 1, maximum: 6 },
          repsLow: { type: 'integer', minimum: 1, maximum: 30 },
          repsHigh: { type: 'integer', minimum: 1, maximum: 30 },
        },
        required: ['sets', 'repsLow', 'repsHigh'],
      },
    },
  },
  required: ['exercises'],
};

interface Proposed {
  id?: string;
  name?: string;
  primary?: string;
  equipment?: string;
  sets: number;
  repsLow: number;
  repsHigh: number;
}

const daysAgo = (iso: string, now: Date) => Math.round((now.getTime() - new Date(iso).getTime()) / 86400000);

// Only training data goes out: the library, what has been logged and how recently, what was
// swapped away or marked unavailable, sets per muscle, and the last three sessions.
export function buildPrompt(input: AiPlanInput): string {
  const exMap = new Map(input.exercises.map((e) => [e.id, e]));
  const usage = buildUsage(input.workouts, exMap);
  const available = input.exercises.filter((e) => !e.deletedAt && !e.unavailable);
  const balance = muscleBalance(input.workouts, exMap, input.now);
  const focus = input.focus.length === 1 && input.focus[0] === 'full' ? 'full body' : input.focus.join(', ');

  const logged = [...usage.count.entries()]
    .map(([id, n]) => ({ id, n, last: usage.last.get(id) }))
    .sort((a, b) => b.n - a.n)
    .map((l) => `${l.id} (${l.n}x, last ${l.last ? `${daysAgo(l.last, input.now)} days ago` : 'unknown'})`);
  const swapped = [...usage.swappedAway.keys()];
  const unavailable = input.exercises.filter((e) => e.unavailable).map((e) => e.id);
  const recent = doneWorkouts(input.workouts)
    .slice(-3)
    .reverse()
    .map((w) => `${daysAgo(workoutDate(w), input.now)} days ago: ${w.exercises.map((we) => exMap.get(we.exerciseId)?.name ?? we.exerciseId).join(', ')}`);

  return [
    'You are planning one gym session for a recreational lifter at a typical commercial gym. Units are kilograms, but never mention or choose weights: the app sets them.',
    '',
    `Focus: ${focus}. Time available: ${input.minutes} minutes. ${input.note ? `The lifter says: "${input.note.replace(/"/g, "'")}"` : 'No extra notes.'}`,
    '',
    'Rules:',
    '- Choose 3 to 8 exercises by id from the library below, in the order they should be done. Compound lifts first.',
    '- Strongly prefer exercises the lifter has logged before (listed below), since those are known to exist at this gym.',
    '- Introduce at most one exercise the lifter has never logged.',
    '- Never use the exercises marked unavailable, and avoid ones the lifter swapped away from.',
    '- Respect the note: if equipment is busy or something hurts, work around it.',
    `- Fit the time: about ${Math.max(3, Math.min(8, Math.round(input.minutes / 10)))} exercises of 3 to 4 sets for ${input.minutes} minutes.`,
    '- When arms are trained, balance biceps and triceps work, favouring the side that is behind.',
    '- Give each exercise sets and a rep range (repsLow to repsHigh).',
    '- Only if nothing in the library fits a need, add one new exercise by name with its primary muscle and equipment, and no id.',
    input.avoid?.length ? `- The previous plan used: ${input.avoid.join(', ')}. Offer something different.` : '',
    '',
    `Sets per muscle in the last 14 days: ${MUSCLES.map((m) => `${m} ${balance.sets[m]}`).join(', ')} (arms: biceps ${balance.armParts.biceps}, triceps ${balance.armParts.triceps}).${balance.lagging.length ? ` Lagging: ${balance.lagging.join(', ')}.` : ''}${balance.laggingPart ? ` Within arms, ${balance.laggingPart} are behind.` : ''}`,
    '',
    `Logged exercises (id, times, recency): ${logged.length ? logged.join('; ') : 'none yet, this is a new lifter'}.`,
    `Swapped away from: ${swapped.length ? swapped.join(', ') : 'none'}.`,
    `Unavailable at this gym: ${unavailable.length ? unavailable.join(', ') : 'none'}.`,
    `Last sessions: ${recent.length ? recent.join(' | ') : 'none'}.`,
    '',
    'Library (id | name | primary muscle | equipment):',
    ...available.map((e) => `${e.id} | ${e.name} | ${e.primary}${armPart(e) ? ` (${armPart(e)})` : ''} | ${e.equipment}`),
    '',
    'Answer with JSON only.',
  ]
    .filter((line) => line !== '')
    .join('\n');
}

const clamp = (n: unknown, lo: number, hi: number, fallback: number) =>
  typeof n === 'number' && Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n))) : fallback;

// Asks the provider, checks every line of the answer against the library and the rules, then
// hands the engine the result to fit the time budget. Throws on any failure; the caller falls
// back to the rule based generator.
export async function generateWithAi(provider: AiProvider, input: AiPlanInput): Promise<PlanItem[]> {
  const text = await provider.generate(buildPrompt(input), SCHEMA);
  let parsed: { exercises?: Proposed[] };
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new AiError('invalid', 'Gemini did not answer with valid JSON.');
  }
  if (!Array.isArray(parsed.exercises) || parsed.exercises.length === 0) throw new AiError('invalid', 'Gemini answered without any exercises.');

  const exMap = new Map(input.exercises.map((e) => [e.id, e]));
  const usage = buildUsage(input.workouts, exMap);
  const taken = new Set<string>();
  let newAllowed = 1;
  const picks: PlanPick[] = [];

  for (const p of parsed.exercises.slice(0, 10)) {
    let ex: Exercise | undefined;
    if (typeof p.id === 'string' && exMap.has(p.id)) {
      ex = exMap.get(p.id);
    } else if (typeof p.name === 'string' && p.name.trim() && (MUSCLES as string[]).includes(p.primary ?? '')) {
      const name = p.name.trim();
      const existing = input.exercises.find((e) => e.name.toLowerCase() === name.toLowerCase() && !e.deletedAt);
      if (existing) ex = existing;
      else if (newAllowed > 0) {
        const equipment = (EQUIPMENT as string[]).includes(p.equipment ?? '') ? (p.equipment as Equipment) : 'other';
        ex = await input.createExercise({ name, primary: p.primary as Muscle, equipment });
      }
    }
    if (!ex || ex.deletedAt || ex.unavailable || taken.has(ex.id)) continue;
    if ((usage.count.get(ex.id) ?? 0) === 0 && usage.workouts > 0) {
      if (newAllowed <= 0) continue;
      newAllowed--;
    }
    taken.add(ex.id);
    picks.push({ ex, muscle: ex.primary, order: picks.length, sets: clamp(p.sets, 1, 6, 3) });
  }
  if (picks.length === 0) throw new AiError('invalid', 'None of the exercises Gemini chose can be used.');

  const items = fitToBudget(orderCompoundFirst(picks), input.minutes * 60, input.restSeconds);
  return items.map((p) => {
    const proposed = parsed.exercises!.find((q) => q.id === p.ex.id);
    const dflt = defaultReps(p.ex);
    const repsLow = clamp(proposed?.repsLow, 1, 30, dflt.repsLow);
    const repsHigh = Math.max(repsLow, clamp(proposed?.repsHigh, 1, 30, dflt.repsHigh));
    return { exerciseId: p.ex.id, target: { sets: p.sets, repsLow, repsHigh } };
  });
}

export const describeCompound = (ex: Exercise) => (isCompound(ex) ? 'compound' : 'isolation');

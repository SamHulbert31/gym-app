import { describe, expect, it } from 'vitest';
import { SEED_EXERCISES } from '../db/seed';
import { MUSCLES, type Exercise, type Muscle, type Workout } from '../db/types';
import { isCompound, isHeavyCompound, restSecondsFor } from './classify';
import { alternativesFor, generatePlan, parseNoteAvoid, type GenerateInput, type PlanItem } from './generate';
import { exerciseSeconds, planMinutes, planSeconds } from './time';
import { buildUsage } from './usage';

const NOW = new Date('2026-11-11T10:00:00Z');
const lib = SEED_EXERCISES;
const byId = new Map(lib.map((e) => [e.id, e]));
const ex = (id: string) => byId.get(id) as Exercise;

function rngFrom(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let n = 0;
// A finished workout, `daysAgo` days back, in which each listed exercise was done for three sets.
function session(daysAgo: number, ids: string[], extra: Partial<Workout['exercises'][number]>[] = []): Workout {
  const date = new Date(NOW.getTime() - daysAgo * 86400000).toISOString();
  return {
    id: `w${n++}`,
    source: 'manual',
    status: 'done',
    focus: [],
    startedAt: date,
    endedAt: date,
    createdAt: date,
    updatedAt: date,
    exercises: ids.map((exerciseId, order) => ({
      exerciseId,
      order,
      target: { sets: 3, repsLow: 8, repsHigh: 12 },
      sets: [1, 2, 3].map(() => ({ weight: 50, reps: 10, done: true })),
      ...extra[order],
    })),
  };
}

const input = (over: Partial<GenerateInput> = {}): GenerateInput => ({
  focus: ['legs', 'core'],
  minutes: 45,
  exercises: lib,
  workouts: [],
  restSeconds: 90,
  now: NOW,
  rng: rngFrom(1),
  ...over,
});

const seconds = (plan: PlanItem[], rest = 90) => planSeconds(plan.map((p) => ({ ex: ex(p.exerciseId), sets: p.target.sets })), rest);
const muscles = (plan: PlanItem[]) => plan.map((p) => ex(p.exerciseId).primary);

describe('classification', () => {
  it('tells compound lifts from isolation', () => {
    for (const id of ['barbell-bench-press', 'leg-press', 'romanian-deadlift', 'lat-pulldown', 'pull-up', 'overhead-press', 'walking-lunge']) {
      expect(isCompound(ex(id)), id).toBe(true);
    }
    for (const id of ['dumbbell-curl', 'leg-extension', 'cable-crunch', 'dumbbell-lateral-raise', 'triceps-pushdown', 'leg-press-calf-raise', 'cable-fly', 'plank']) {
      expect(isCompound(ex(id)), id).toBe(false);
    }
  });

  it('gives heavy compound lifts the longer rest', () => {
    expect(isHeavyCompound(ex('back-squat'))).toBe(true);
    expect(isHeavyCompound(ex('leg-press'))).toBe(true);
    expect(isHeavyCompound(ex('dumbbell-bench-press'))).toBe(false);
    expect(restSecondsFor(ex('back-squat'), 90)).toBe(120);
    expect(restSecondsFor(ex('dumbbell-curl'), 90)).toBe(90);
    expect(restSecondsFor(ex('back-squat'), 150)).toBe(150);
  });
});

describe('time budget', () => {
  it('is work plus rest per set, plus two minutes of setup per exercise', () => {
    // 4 sets × (40 s work + 120 s rest) + 120 s setup
    expect(exerciseSeconds(ex('back-squat'), 4, 90)).toBe(4 * 160 + 120);
    expect(exerciseSeconds(ex('dumbbell-curl'), 3, 90)).toBe(3 * 130 + 120);
    expect(planMinutes(2790)).toBe(47);
  });
});

describe('generatePlan', () => {
  it('builds a sensible session from scratch: right muscles, compounds first, within the time', () => {
    const plan = generatePlan(input());
    const ms = muscles(plan);
    expect(ms.filter((m) => m === 'legs').length).toBeGreaterThanOrEqual(2);
    expect(ms.filter((m) => m === 'core').length).toBeGreaterThanOrEqual(1);
    expect(ms.every((m) => m === 'legs' || m === 'core')).toBe(true);
    expect(seconds(plan)).toBeLessThanOrEqual(45 * 60);
    // compound lifts come before isolation work
    const kinds = plan.map((p) => isCompound(ex(p.exerciseId)));
    expect(kinds).toEqual([...kinds].sort((a, b) => Number(b) - Number(a)));
    // a cold start uses staples, not obscure exercises
    expect(plan.map((p) => p.exerciseId)).toContain('leg-press');
    expect(new Set(plan.map((p) => p.exerciseId)).size).toBe(plan.length);
  });

  it('fits every duration for every focus', () => {
    const focuses: GenerateInput['focus'][] = [['legs'], ['chest'], ['back', 'arms'], ['legs', 'core'], ['shoulders', 'arms', 'core'], ['chest', 'back', 'legs', 'shoulders'], ['full'], ['core']];
    for (const focus of focuses) {
      for (const minutes of [30, 45, 60, 75]) {
        for (let seed = 1; seed <= 6; seed++) {
          const plan = generatePlan(input({ focus, minutes, rng: rngFrom(seed) }));
          expect(plan.length, `${focus} ${minutes}`).toBeGreaterThan(0);
          expect(seconds(plan), `${focus} ${minutes} seed ${seed}`).toBeLessThanOrEqual(minutes * 60);
          expect(new Set(plan.map((p) => p.exerciseId)).size).toBe(plan.length);
        }
      }
    }
  });

  it('uses most of the time it is given', () => {
    for (const minutes of [45, 60, 75]) {
      const used = seconds(generatePlan(input({ focus: ['chest', 'back'], minutes }))) / 60;
      expect(used).toBeGreaterThan(minutes - 14);
    }
  });

  it('stays within the chosen muscles; full body covers the big groups', () => {
    const chest = muscles(generatePlan(input({ focus: ['chest'], minutes: 60 })));
    expect(new Set(chest)).toEqual(new Set(['chest']));
    const full = new Set(muscles(generatePlan(input({ focus: ['full'], minutes: 60 }))));
    for (const m of ['legs', 'back', 'chest', 'shoulders'] as Muscle[]) expect(full.has(m), m).toBe(true);
  });

  it('puts the lagging muscles first when time only allows some', () => {
    const muscleSets = { chest: 10, back: 10, shoulders: 10, arms: 10, legs: 1, core: 0 } as Record<Muscle, number>;
    const plan = generatePlan(input({ focus: ['full'], minutes: 30, muscleSets }));
    expect(plan.length).toBeLessThanOrEqual(3);
    const ms = new Set(muscles(plan));
    expect(ms.has('legs')).toBe(true);
    expect(ms.has('core')).toBe(true);
  });

  it('prefers exercises that have been logged', () => {
    const history = [session(3, ['hack-squat', 'seated-leg-curl', 'plank', 'ab-wheel-rollout']), session(10, ['hack-squat', 'seated-leg-curl', 'plank', 'ab-wheel-rollout'])];
    const known = ['hack-squat', 'seated-leg-curl', 'plank', 'ab-wheel-rollout'];
    for (let seed = 1; seed <= 15; seed++) {
      const ids = generatePlan(input({ workouts: history, rng: rngFrom(seed) })).map((p) => p.exerciseId);
      // everything logged is used, and nothing more than one new exercise comes in
      for (const id of known) expect(ids, `seed ${seed}`).toContain(id);
      expect(ids.filter((id) => !known.includes(id)).length, `seed ${seed}`).toBeLessThanOrEqual(1);
    }
  });

  it('introduces at most one unfamiliar exercise when the muscle has history', () => {
    const history = [session(3, ['barbell-bench-press', 'incline-dumbbell-press', 'cable-fly']), session(9, ['barbell-bench-press', 'incline-dumbbell-press'])];
    for (let seed = 1; seed <= 20; seed++) {
      const plan = generatePlan(input({ focus: ['chest'], minutes: 60, workouts: history, rng: rngFrom(seed) }));
      const unfamiliar = plan.filter((p) => !['barbell-bench-press', 'incline-dumbbell-press', 'cable-fly'].includes(p.exerciseId));
      expect(unfamiliar.length, `seed ${seed}`).toBeLessThanOrEqual(1);
    }
  });

  it('never uses unavailable or deleted exercises', () => {
    const blocked = new Set(['leg-press', 'back-squat', 'romanian-deadlift', 'hack-squat', 'cable-crunch']);
    const library = lib.map((e) => (blocked.has(e.id) ? { ...e, unavailable: true } : e)).map((e) => (e.id === 'walking-lunge' ? { ...e, deletedAt: 'x' } : e));
    for (let seed = 1; seed <= 15; seed++) {
      const plan = generatePlan(input({ exercises: library, rng: rngFrom(seed) }));
      for (const p of plan) {
        expect(blocked.has(p.exerciseId)).toBe(false);
        expect(p.exerciseId).not.toBe('walking-lunge');
      }
    }
  });

  it('gives a different plan when generating again', () => {
    for (const focus of [['legs', 'core'], ['chest', 'back'], ['arms']] as GenerateInput['focus'][]) {
      const first = generatePlan(input({ focus, rng: rngFrom(3) }));
      const second = generatePlan(input({ focus, rng: rngFrom(4), avoid: first.map((p) => p.exerciseId) }));
      expect(second.map((p) => p.exerciseId)).not.toEqual(first.map((p) => p.exerciseId));
    }
  });

  it('steers away from exercises that keep getting swapped out', () => {
    const swapped = session(3, ['dumbbell-bench-press', 'hammer-curl'], [{ swappedFromExerciseId: 'leg-press' }, { swappedFromExerciseId: 'leg-press' }]);
    const w2 = session(5, ['dumbbell-bench-press'], [{ swappedFromExerciseId: 'leg-press' }]);
    const ids = generatePlan(input({ focus: ['legs'], minutes: 45, workouts: [swapped, w2] })).map((p) => p.exerciseId);
    expect(ids).not.toContain('leg-press');
  });

  it('learns the equipment he uses when it picks something new', () => {
    // Chest work has only ever been on machines and cables.
    const history = [session(2, ['machine-chest-press', 'pec-deck']), session(6, ['machine-chest-press', 'pec-deck']), session(9, ['machine-chest-press', 'cable-fly'])];
    const logged = ['machine-chest-press', 'pec-deck', 'cable-fly'];
    const fresh: string[] = [];
    for (let seed = 1; seed <= 30; seed++) {
      for (const p of generatePlan(input({ focus: ['chest'], minutes: 75, workouts: history, rng: rngFrom(seed) }))) {
        if (!logged.includes(p.exerciseId)) fresh.push(ex(p.exerciseId).equipment);
      }
    }
    // the one new exercise per plan is almost always machine or cable, like everything he has logged
    const leaning = fresh.filter((e) => e === 'machine' || e === 'cable').length / fresh.length;
    expect(fresh.length).toBeGreaterThan(10);
    expect(leaning).toBeGreaterThan(0.8);
    // with no history at all it is not biased that way
    const cold = generatePlan(input({ focus: ['chest'], minutes: 75, rng: rngFrom(1) })).map((p) => ex(p.exerciseId).equipment);
    expect(cold.some((e) => e === 'barbell' || e === 'dumbbell')).toBe(true);
    const usage = buildUsage(history, byId);
    // five machine sessions (press x3, pec deck x2) and one cable
    expect(usage.affinity('chest').get('machine')).toBeCloseTo(5 / 6, 5);
    expect(usage.affinity('chest').get('cable')).toBeCloseTo(1 / 6, 5);
  });

  it('sets heavier first lifts for a one or two muscle focus', () => {
    const plan = generatePlan(input({ focus: ['chest'], minutes: 45 }));
    expect(plan[0].target.sets).toBeGreaterThanOrEqual(4);
    expect(plan[0].target.repsLow).toBeLessThan(plan[plan.length - 1].target.repsLow + 1);
  });

  it('gives rep ranges by kind of lift', () => {
    const plan = generatePlan(input({ focus: ['legs', 'core'], minutes: 60 }));
    for (const p of plan) {
      const e = ex(p.exerciseId);
      if (isHeavyCompound(e)) expect([p.target.repsLow, p.target.repsHigh]).toEqual([6, 10]);
      else if (isCompound(e)) expect([p.target.repsLow, p.target.repsHigh]).toEqual([8, 12]);
      else expect([p.target.repsLow, p.target.repsHigh]).toEqual([10, 15]);
    }
  });

  it('works around a note like "squat racks are busy tonight"', () => {
    for (let seed = 1; seed <= 15; seed++) {
      const plan = generatePlan(input({ focus: ['legs'], note: 'Squat racks are busy tonight', rng: rngFrom(seed) }));
      for (const p of plan) expect(ex(p.exerciseId).name.toLowerCase()).not.toMatch(/squat|rack/);
      expect(plan.length).toBeGreaterThan(2);
    }
  });
});

describe('parseNoteAvoid', () => {
  const avoid = (note: string, id: string) => parseNoteAvoid(note)(ex(id));
  it('leaves out what a negative note names', () => {
    expect(avoid('squat racks are busy', 'back-squat')).toBe(true);
    expect(avoid('squat racks are busy', 'rack-pull')).toBe(true);
    expect(avoid('squat racks are busy', 'leg-press')).toBe(false);
    expect(avoid('no barbells tonight', 'barbell-row')).toBe(true);
    expect(avoid('no barbells tonight', 'dumbbell-row')).toBe(false);
    expect(avoid('shoulder is sore', 'overhead-press')).toBe(true);
  });
  it('ignores notes without a negative cue', () => {
    expect(avoid('feeling strong, short on time', 'back-squat')).toBe(false);
    expect(avoid('', 'back-squat')).toBe(false);
  });
});

describe('alternativesFor', () => {
  it('lists the same muscle, logged first and most used first, never the current or unavailable ones', () => {
    const history = [
      session(2, ['machine-chest-press', 'dumbbell-bench-press']),
      session(5, ['machine-chest-press']),
      session(9, ['machine-chest-press', 'dumbbell-bench-press', 'pec-deck']),
    ];
    const usage = buildUsage(history, byId);
    const library = lib.map((e) => (e.id === 'cable-fly' ? { ...e, unavailable: true } : e));
    const alts = alternativesFor(ex('barbell-bench-press'), library, usage);
    expect(alts.every((e) => e.primary === 'chest')).toBe(true);
    expect(alts.map((e) => e.id).slice(0, 3)).toEqual(['machine-chest-press', 'dumbbell-bench-press', 'pec-deck']);
    expect(alts.map((e) => e.id)).not.toContain('barbell-bench-press');
    expect(alts.map((e) => e.id)).not.toContain('cable-fly');
    expect(alternativesFor(ex('barbell-bench-press'), lib, usage, ['pec-deck']).map((e) => e.id)).not.toContain('pec-deck');
  });

  it('puts exercises that keep being swapped away after the rest of the same use', () => {
    const w = session(3, ['dumbbell-curl'], [{ swappedFromExerciseId: 'hammer-curl' }]);
    const usage = buildUsage([w], byId);
    const alts = alternativesFor(ex('barbell-curl'), lib, usage).map((e) => e.id);
    expect(alts[0]).toBe('dumbbell-curl');
    expect(alts.indexOf('hammer-curl')).toBeGreaterThan(alts.indexOf('cable-curl'));
  });

  it('covers every muscle', () => {
    const usage = buildUsage([], byId);
    for (const m of MUSCLES) {
      const first = lib.find((e) => e.primary === m) as Exercise;
      expect(alternativesFor(first, lib, usage).length, m).toBeGreaterThan(3);
    }
  });
});

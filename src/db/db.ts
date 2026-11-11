import Dexie, { type Table } from 'dexie';
import { SEED_EXERCISES } from './seed';
import type { Exercise, Meta, Workout } from './types';

export const SCHEMA_VERSION = 1;

class GymDB extends Dexie {
  exercises!: Table<Exercise, string>;
  workouts!: Table<Workout, string>;
  meta!: Table<Meta, string>;

  constructor() {
    super('gym-app');
    this.version(1).stores({
      exercises: 'id, name, primary, deletedAt',
      workouts: 'id, status, startedAt, endedAt, deletedAt',
      meta: 'id',
    });
  }
}

export const db = new GymDB();

export const newId = () => crypto.randomUUID();
export const nowISO = () => new Date().toISOString();

export const DEFAULT_META: Omit<Meta, 'createdAt' | 'updatedAt'> = {
  id: 'meta',
  schemaVersion: SCHEMA_VERSION,
  restSeconds: 90,
  increments: { barbell: 2.5, dumbbell: 2, machine: 5, cable: 5 },
};

// Runs once when the app opens: adds any seed exercises the device does not have yet
// (never overwrites an existing record, so edits and "unavailable" flags are kept),
// makes sure the meta record exists, and asks the browser to keep the data.
export async function initDb() {
  const have = await db.exercises.bulkGet(SEED_EXERCISES.map((e) => e.id));
  const missing = SEED_EXERCISES.filter((_, i) => !have[i]);
  if (missing.length) await db.exercises.bulkAdd(missing);

  if (!(await db.meta.get('meta'))) {
    const now = nowISO();
    await db.meta.put({ ...DEFAULT_META, createdAt: now, updatedAt: now });
  }

  try {
    await navigator.storage?.persist?.();
  } catch {
    // Best effort only.
  }
}

// Training settings that sync (rest default, increments). lastSync is set by the sync engine itself.
export async function updateMeta(patch: Partial<Pick<Meta, 'restSeconds' | 'increments'>>) {
  await db.meta.update('meta', { ...patch, updatedAt: nowISO() });
  const { schedulePush } = await import('../sync');
  schedulePush();
}

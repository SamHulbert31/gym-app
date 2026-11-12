import { ARM_PARTS, EQUIPMENT, MUSCLES, type Exercise, type Meta, type Workout } from '../db/types';

// The one JSON file kept in the private repo, and the shape of an export.
export const SYNC_FORMAT = 1;

export interface Snapshot {
  exercises: Exercise[];
  workouts: Workout[];
  meta?: Meta;
}

export interface SyncFile {
  app: 'overload';
  format: typeof SYNC_FORMAT;
  savedAt: string;
  exercises: Exercise[];
  workouts: Workout[];
  meta?: Omit<Meta, 'lastSync'>;
}

const byId = <T extends { id: string }>(a: T, b: T) => a.id.localeCompare(b.id);

// Records sorted by id and the device-only lastSync left out, so the same data always
// serialises to the same text and a no-op sync never commits.
export function toSyncFile(s: Snapshot, savedAt: string): SyncFile {
  let meta: SyncFile['meta'];
  if (s.meta) {
    const { lastSync: _lastSync, ...rest } = s.meta;
    meta = rest;
  }
  return {
    app: 'overload',
    format: SYNC_FORMAT,
    savedAt,
    exercises: [...s.exercises].sort(byId),
    workouts: [...s.workouts].sort(byId),
    ...(meta ? { meta } : {}),
  };
}

export const serialize = (file: SyncFile) => JSON.stringify(file, null, 2) + '\n';

// What matters when deciding whether the remote file needs rewriting: everything but the timestamp.
export const contentKey = (file: SyncFile) => serialize({ ...file, savedAt: '' });

const isRecord = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const isIso = (x: unknown) => typeof x === 'string' && !Number.isNaN(Date.parse(x));

function baseOk(r: unknown): r is Record<string, unknown> & { id: string; createdAt: string; updatedAt: string } {
  return isRecord(r) && typeof r.id === 'string' && r.id.length > 0 && isIso(r.createdAt) && isIso(r.updatedAt) && (r.deletedAt === undefined || isIso(r.deletedAt));
}

const exerciseOk = (r: unknown): r is Exercise =>
  baseOk(r) &&
  typeof r.name === 'string' &&
  (MUSCLES as string[]).includes(r.primary as string) &&
  Array.isArray(r.secondary) &&
  (EQUIPMENT as string[]).includes(r.equipment as string) &&
  typeof r.isCustom === 'boolean' &&
  (r.part === undefined || (ARM_PARTS as string[]).includes(r.part as string));

const workoutOk = (r: unknown): r is Workout =>
  baseOk(r) &&
  ['generated', 'manual'].includes(r.source as string) &&
  ['planned', 'active', 'done'].includes(r.status as string) &&
  Array.isArray(r.focus) &&
  Array.isArray(r.exercises) &&
  (r.exercises as unknown[]).every(
    (we) => isRecord(we) && typeof we.exerciseId === 'string' && isRecord(we.target) && Array.isArray(we.sets),
  );

const metaOk = (r: unknown): r is Meta =>
  baseOk(r) && r.id === 'meta' && typeof r.restSeconds === 'number' && isRecord(r.increments);

// Parses text from the repo or an import. Throws with a plain sentence when it is not Overload data,
// so a stray file is never merged in or written over.
export function parseSyncFile(text: string): SyncFile {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('The file is not valid JSON.');
  }
  if (!isRecord(data) || data.app !== 'overload' || !Array.isArray(data.exercises) || !Array.isArray(data.workouts)) {
    throw new Error('The file is not Overload data.');
  }
  if (data.format !== SYNC_FORMAT) {
    throw new Error(`The file uses data format ${String(data.format)}, which this version of the app does not know.`);
  }
  const badExercise = data.exercises.findIndex((e) => !exerciseOk(e));
  if (badExercise >= 0) throw new Error(`Exercise ${badExercise + 1} in the file is not valid.`);
  const badWorkout = data.workouts.findIndex((w) => !workoutOk(w));
  if (badWorkout >= 0) throw new Error(`Workout ${badWorkout + 1} in the file is not valid.`);
  if (data.meta !== undefined && !metaOk(data.meta)) throw new Error('The settings in the file are not valid.');
  return {
    app: 'overload',
    format: SYNC_FORMAT,
    savedAt: isIso(data.savedAt) ? (data.savedAt as string) : '',
    exercises: data.exercises as Exercise[],
    workouts: data.workouts as Workout[],
    ...(data.meta ? { meta: data.meta as Meta } : {}),
  };
}

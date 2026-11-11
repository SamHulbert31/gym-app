import { describe, expect, it } from 'vitest';
import { SEED_EXERCISES } from '../db/seed';
import type { Meta, Workout } from '../db/types';
import { contentKey, parseSyncFile, serialize, toSyncFile } from './format';
import { mergeRecords, mergeSnapshots } from './merge';

const w = (id: string, updatedAt: string, extra: Partial<Workout> = {}): Workout => ({
  id,
  source: 'manual',
  status: 'done',
  focus: [],
  exercises: [],
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt,
  ...extra,
});

describe('mergeRecords', () => {
  it('keeps records only one side has', () => {
    const r = mergeRecords([w('a', '2026-11-02T00:00:00Z')], [w('b', '2026-11-03T00:00:00Z')]);
    expect(r.merged.map((x) => x.id).sort()).toEqual(['a', 'b']);
    expect(r.toLocal.map((x) => x.id)).toEqual(['b']);
    expect(r.toRemote.map((x) => x.id)).toEqual(['a']);
  });

  it('lets the newest updatedAt win in either direction', () => {
    const older = w('a', '2026-11-02T00:00:00Z', { userNote: 'old' });
    const newer = w('a', '2026-11-05T00:00:00Z', { userNote: 'new' });
    let r = mergeRecords([older], [newer]);
    expect(r.merged[0].userNote).toBe('new');
    expect(r.toLocal).toHaveLength(1);
    expect(r.toRemote).toHaveLength(0);
    r = mergeRecords([newer], [older]);
    expect(r.merged[0].userNote).toBe('new');
    expect(r.toLocal).toHaveLength(0);
    expect(r.toRemote).toHaveLength(1);
  });

  it('lets a tombstone beat an older edit, and a newer edit beat an old tombstone', () => {
    const edit = w('a', '2026-11-02T00:00:00Z');
    const tomb = w('a', '2026-11-03T00:00:00Z', { deletedAt: '2026-11-03T00:00:00Z' });
    expect(mergeRecords([edit], [tomb]).merged[0].deletedAt).toBeDefined();
    const laterEdit = w('a', '2026-11-04T00:00:00Z');
    expect(mergeRecords([laterEdit], [tomb]).merged[0].deletedAt).toBeUndefined();
  });

  it('prefers the tombstone on an exact tie, otherwise the local copy, and reports no changes when identical', () => {
    const live = w('a', '2026-11-03T00:00:00Z');
    const tomb = w('a', '2026-11-03T00:00:00Z', { deletedAt: '2026-11-03T00:00:00Z' });
    expect(mergeRecords([live], [tomb]).merged[0].deletedAt).toBeDefined();
    expect(mergeRecords([tomb], [live]).merged[0].deletedAt).toBeDefined();
    const r = mergeRecords([live], [{ ...live }]);
    expect(r.toLocal).toHaveLength(0);
    expect(r.toRemote).toHaveLength(0);
  });
});

describe('format', () => {
  const meta: Meta = { id: 'meta', schemaVersion: 1, restSeconds: 90, increments: { barbell: 2.5 }, createdAt: '2026-11-01T00:00:00Z', updatedAt: '2026-11-01T00:00:00Z', lastSync: '2026-11-10T00:00:00Z' };

  it('serialises the same data to the same text regardless of order or lastSync', () => {
    const a = toSyncFile({ exercises: SEED_EXERCISES.slice(0, 3), workouts: [w('b', '2026-11-02T00:00:00Z'), w('a', '2026-11-02T00:00:00Z')], meta }, '2026-11-11T10:00:00Z');
    const b = toSyncFile({ exercises: [...SEED_EXERCISES.slice(0, 3)].reverse(), workouts: [w('a', '2026-11-02T00:00:00Z'), w('b', '2026-11-02T00:00:00Z')], meta: { ...meta, lastSync: 'other' } }, '2026-11-12T10:00:00Z');
    expect(contentKey(a)).toBe(contentKey(b));
    expect(serialize(a)).not.toBe(serialize(b)); // savedAt differs, which is fine
    expect(serialize(a)).not.toContain('lastSync');
  });

  it('parses what it wrote', () => {
    const file = toSyncFile({ exercises: SEED_EXERCISES.slice(0, 5), workouts: [w('a', '2026-11-02T00:00:00Z')], meta }, '2026-11-11T10:00:00Z');
    const back = parseSyncFile(serialize(file));
    expect(back.exercises).toHaveLength(5);
    expect(back.workouts[0].id).toBe('a');
    expect(back.meta?.restSeconds).toBe(90);
  });

  it('refuses things that are not Overload data, with a plain reason', () => {
    expect(() => parseSyncFile('not json')).toThrow('not valid JSON');
    expect(() => parseSyncFile('{"hello":1}')).toThrow('not Overload data');
    expect(() => parseSyncFile('{"app":"overload","format":9,"exercises":[],"workouts":[]}')).toThrow('data format 9');
    expect(() => parseSyncFile('{"app":"overload","format":1,"exercises":[{"id":"x"}],"workouts":[]}')).toThrow('Exercise 1');
    expect(() => parseSyncFile('{"app":"overload","format":1,"exercises":[],"workouts":[{"id":"x","createdAt":"2026-01-01","updatedAt":"2026-01-01","source":"manual","status":"nope","focus":[],"exercises":[]}]}')).toThrow('Workout 1');
  });
});

describe('mergeSnapshots', () => {
  it('merges each table and the settings record, and says whether the remote needs rewriting', () => {
    const local = { exercises: SEED_EXERCISES.slice(0, 2), workouts: [w('a', '2026-11-02T00:00:00Z')], meta: { id: 'meta', schemaVersion: 1, restSeconds: 90, increments: {}, createdAt: 'x', updatedAt: '2026-11-01T00:00:00Z' } as Meta };
    const remote = { exercises: SEED_EXERCISES.slice(0, 2), workouts: [w('a', '2026-11-02T00:00:00Z')], meta: { ...local.meta, restSeconds: 120, updatedAt: '2026-11-05T00:00:00Z' } };
    const r = mergeSnapshots(local, remote);
    expect(r.remoteChanged).toBe(false);
    expect(r.toLocal.meta?.restSeconds).toBe(120);
    expect(r.toLocal.workouts).toHaveLength(0);
    const r2 = mergeSnapshots({ ...local, workouts: [...local.workouts, w('new', '2026-11-06T00:00:00Z')] }, remote);
    expect(r2.remoteChanged).toBe(true);
  });
});

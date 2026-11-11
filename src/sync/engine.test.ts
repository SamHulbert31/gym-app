import { describe, expect, it } from 'vitest';
import { SEED_EXERCISES } from '../db/seed';
import type { Exercise, Meta, Workout } from '../db/types';
import { decodeBase64, encodeBase64 } from './base64';
import { createSyncEngine, type SyncStore } from './engine';
import { parseSyncFile, type Snapshot } from './format';
import { GitHubError, testConnection } from './github';

const cfg = { owner: 'sam', repo: 'app-data', path: 'gym-app/data.json', token: 'github_pat_SECRET_VALUE' };
const T0 = '2026-11-11T10:00:00.000Z';

const workout = (id: string, updatedAt = T0, extra: Partial<Workout> = {}): Workout => ({
  id, source: 'manual', status: 'done', focus: [], exercises: [], createdAt: T0, updatedAt, ...extra,
});
const meta = (updatedAt = T0, restSeconds = 90): Meta => ({ id: 'meta', schemaVersion: 1, restSeconds, increments: {}, createdAt: T0, updatedAt });

// A device: in-memory tables with the same semantics as the Dexie adapter.
function memoryStore(init: Partial<Snapshot> = {}) {
  const ex = new Map((init.exercises ?? SEED_EXERCISES).map((e) => [e.id, e]));
  const wo = new Map((init.workouts ?? []).map((w) => [w.id, w]));
  let m: Meta | undefined = init.meta ?? meta();
  let lastSync: string | undefined;
  const store: SyncStore = {
    snapshot: async () => ({ exercises: [...ex.values()], workouts: [...wo.values()], meta: m }),
    apply: async (c) => {
      c.exercises.forEach((e) => ex.set(e.id, e));
      c.workouts.forEach((w) => wo.set(w.id, w));
      if (c.meta) m = c.meta;
    },
    setLastSync: async (iso) => {
      lastSync = iso;
    },
  };
  return { store, ex, wo, meta: () => m, lastSync: () => lastSync };
}

// A fake GitHub contents API with real sha semantics.
function fakeGitHub(opts: { failWith?: number; beforePut?: () => void; offline?: boolean } = {}) {
  let file: { sha: string; text: string } | null = null;
  let version = 0;
  const log: string[] = [];
  const fetchFn: typeof fetch = async (input, init) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    log.push(`${method} ${url.replace('https://api.github.com', '')}`);
    if (opts.offline) throw new TypeError('Failed to fetch');
    const auth = (init?.headers as Record<string, string>)?.Authorization;
    if (auth !== `Bearer ${cfg.token}`) return new Response('{"message":"Bad credentials"}', { status: 401 });
    if (opts.failWith) return new Response('{}', { status: opts.failWith, headers: opts.failWith === 403 ? { 'x-ratelimit-remaining': '0' } : {} });
    if (url.endsWith('/repos/sam/app-data')) {
      return new Response(JSON.stringify({ full_name: 'sam/app-data', private: true, permissions: { push: true } }), { status: 200 });
    }
    if (!url.includes('/contents/gym-app/data.json')) return new Response('{}', { status: 404 });
    if (method === 'GET') {
      if (!file) return new Response('{"message":"Not Found"}', { status: 404 });
      return new Response(JSON.stringify({ type: 'file', sha: file.sha, encoding: 'base64', content: encodeBase64(file.text) }), { status: 200 });
    }
    if (method === 'PUT') {
      opts.beforePut?.();
      const body = JSON.parse(String(init?.body)) as { sha?: string; content: string; message: string };
      if ((file?.sha ?? undefined) !== body.sha) return new Response('{"message":"sha mismatch"}', { status: 409 });
      file = { sha: `sha${++version}`, text: decodeBase64(body.content) };
      log.push(`commit: ${body.message}`);
      return new Response(JSON.stringify({ content: { sha: file.sha } }), { status: 200 });
    }
    return new Response('{}', { status: 405 });
  };
  return { fetchFn, log, file: () => file, setFile: (text: string) => { file = { sha: `sha${++version}`, text }; } };
}

const engineFor = (store: SyncStore, gh: ReturnType<typeof fakeGitHub>, config = () => cfg) =>
  createSyncEngine({ store, config, fetchFn: gh.fetchFn, now: () => new Date(T0), online: () => true });

describe('sync engine', () => {
  it('creates the file on first sync, then does nothing when nothing changed', async () => {
    const dev = memoryStore({ workouts: [workout('a')] });
    const gh = fakeGitHub();
    const engine = engineFor(dev.store, gh);
    expect((await engine.sync()).status).toBe('synced');
    expect(gh.file()).not.toBeNull();
    const parsed = parseSyncFile(gh.file()!.text);
    expect(parsed.workouts.map((w) => w.id)).toEqual(['a']);
    expect(parsed.exercises).toHaveLength(SEED_EXERCISES.length);
    expect(gh.log.filter((l) => l.startsWith('commit'))).toEqual(['commit: Overload sync 2026-11-11T10:00']);
    expect(dev.lastSync()).toBe(T0);

    await engine.sync();
    expect(gh.log.filter((l) => l.startsWith('PUT'))).toHaveLength(1);
    expect(gh.log.filter((l) => l.startsWith('GET'))).toHaveLength(2);
  });

  it('pulls what another device pushed and pushes what this one has, merging both ways', async () => {
    const gh = fakeGitHub();
    const phone = memoryStore({ workouts: [workout('phone-1')] });
    const laptop = memoryStore({ workouts: [workout('laptop-1')] });
    await engineFor(phone.store, gh).sync();
    await engineFor(laptop.store, gh).sync();
    expect([...laptop.wo.keys()].sort()).toEqual(['laptop-1', 'phone-1']);
    await engineFor(phone.store, gh).sync();
    expect([...phone.wo.keys()].sort()).toEqual(['laptop-1', 'phone-1']);
    expect(parseSyncFile(gh.file()!.text).workouts).toHaveLength(2);
  });

  it('applies newest-wins and tombstones across devices', async () => {
    const gh = fakeGitHub();
    const phone = memoryStore({ workouts: [workout('a', '2026-11-11T10:00:00Z', { userNote: 'phone' })] });
    await engineFor(phone.store, gh).sync();
    const laptop = memoryStore({ workouts: [workout('a', '2026-11-11T11:00:00Z', { userNote: 'laptop' })] });
    await engineFor(laptop.store, gh).sync();
    await engineFor(phone.store, gh).sync();
    expect(phone.wo.get('a')?.userNote).toBe('laptop');
    // phone deletes it later: the tombstone reaches the laptop
    phone.wo.set('a', { ...phone.wo.get('a')!, deletedAt: '2026-11-11T12:00:00Z', updatedAt: '2026-11-11T12:00:00Z' });
    await engineFor(phone.store, gh).sync();
    await engineFor(laptop.store, gh).sync();
    expect(laptop.wo.get('a')?.deletedAt).toBeDefined();
  });

  it('syncs the settings record too', async () => {
    const gh = fakeGitHub();
    const phone = memoryStore({ meta: meta('2026-11-11T10:00:00Z', 90) });
    await engineFor(phone.store, gh).sync();
    const laptop = memoryStore({ meta: meta('2026-11-11T11:00:00Z', 120) });
    await engineFor(laptop.store, gh).sync();
    await engineFor(phone.store, gh).sync();
    expect(phone.meta()?.restSeconds).toBe(120);
    expect(gh.file()!.text).not.toContain('lastSync');
  });

  it('refetches, merges and retries when the file changed under it', async () => {
    const gh = fakeGitHub();
    const other = memoryStore({ workouts: [workout('other')] });
    await engineFor(other.store, gh).sync();
    // Someone else commits between our GET and PUT, once.
    let raced = false;
    const racer = memoryStore({ workouts: [workout('other'), workout('racer')] });
    const ghRacing = { ...gh, fetchFn: gh.fetchFn };
    const original = gh.fetchFn;
    ghRacing.fetchFn = async (input, init) => {
      if ((init?.method ?? 'GET') === 'PUT' && !raced) {
        raced = true;
        await engineFor(racer.store, { ...gh, fetchFn: original }).sync();
      }
      return original(input, init);
    };
    const mine = memoryStore({ workouts: [workout('other'), workout('mine')] });
    const state = await createSyncEngine({ store: mine.store, config: () => cfg, fetchFn: ghRacing.fetchFn, now: () => new Date(T0), online: () => true }).sync();
    expect(state.status).toBe('synced');
    expect(parseSyncFile(gh.file()!.text).workouts.map((w) => w.id).sort()).toEqual(['mine', 'other', 'racer']);
    expect([...mine.wo.keys()].sort()).toEqual(['mine', 'other', 'racer']);
    expect(gh.log.filter((l) => l.includes('409')).length).toBe(0); // conflicts are handled, not surfaced
  });

  it('never overwrites a remote file it cannot read, and explains', async () => {
    const gh = fakeGitHub();
    gh.setFile('{"something":"else"}');
    const dev = memoryStore({ workouts: [workout('a')] });
    const state = await engineFor(dev.store, gh).sync();
    expect(state.status).toBe('error');
    expect(state.message).toBe('The file is not Overload data.');
    expect(gh.file()!.text).toBe('{"something":"else"}');
  });

  it('reports errors in plain words without the token', async () => {
    const dev = memoryStore();
    for (const [status, expectWords] of [[401, 'rejected the token'], [403, 'rate limit'], [404, 'cannot find that repo'], [500, 'having trouble']] as const) {
      const state = await engineFor(dev.store, fakeGitHub({ failWith: status })).sync();
      expect(state.status).toBe('error');
      expect(state.message).toContain(expectWords);
      expect(state.message).not.toContain('SECRET');
    }
    const wrongToken = await engineFor(dev.store, fakeGitHub(), () => ({ ...cfg, token: 'bad' })).sync();
    expect(wrongToken.message).toContain('rejected the token');
    expect(wrongToken.message).not.toContain('bad');
  });

  it('is offline when there is no connection, and off when not configured', async () => {
    const dev = memoryStore();
    expect((await engineFor(dev.store, fakeGitHub({ offline: true })).sync()).status).toBe('offline');
    const unconfigured = createSyncEngine({ store: dev.store, config: () => null, fetchFn: fakeGitHub().fetchFn, online: () => true });
    expect(unconfigured.getState().status).toBe('off');
    expect((await unconfigured.sync()).status).toBe('off');
    const noNetwork = createSyncEngine({ store: dev.store, config: () => cfg, fetchFn: fakeGitHub().fetchFn, online: () => false });
    expect((await noNetwork.sync()).status).toBe('offline');
  });

  it('runs one sync at a time and goes again if asked meanwhile', async () => {
    const dev = memoryStore({ workouts: [workout('a')] });
    const gh = fakeGitHub();
    const engine = engineFor(dev.store, gh);
    const p1 = engine.sync();
    dev.wo.set('b', workout('b'));
    const p2 = engine.sync();
    expect(p2).toBe(p1);
    await p1;
    expect(parseSyncFile(gh.file()!.text).workouts.map((w) => w.id).sort()).toEqual(['a', 'b']);
  });

  it('debounces pushes', async () => {
    const dev = memoryStore();
    const gh = fakeGitHub();
    const engine = createSyncEngine({ store: dev.store, config: () => cfg, fetchFn: gh.fetchFn, now: () => new Date(T0), online: () => true, pushDelayMs: 20 });
    engine.schedulePush();
    engine.schedulePush();
    engine.schedulePush();
    expect(engine.hasPendingPush()).toBe(true);
    await new Promise((r) => setTimeout(r, 80));
    expect(gh.log.filter((l) => l.startsWith('PUT'))).toHaveLength(1);
    expect(engine.hasPendingPush()).toBe(false);
  });

  it('skips the sync altogether when the file is unchanged on both sides', async () => {
    const dev = memoryStore();
    const gh = fakeGitHub();
    await engineFor(dev.store, gh).sync();
    const puts = gh.log.filter((l) => l.startsWith('PUT')).length;
    const laptop = memoryStore();
    await engineFor(laptop.store, gh).sync();
    expect(gh.log.filter((l) => l.startsWith('PUT')).length).toBe(puts); // identical seed data on a second device: no commit
  });
});

describe('testConnection', () => {
  it('reports the repo, privacy and write access', async () => {
    const info = await testConnection(cfg, fakeGitHub().fetchFn);
    expect(info).toEqual({ fullName: 'sam/app-data', isPrivate: true, canWrite: true });
    await expect(testConnection({ ...cfg, token: 'nope' }, fakeGitHub().fetchFn)).rejects.toBeInstanceOf(GitHubError);
  });

  it('never leaks the token into an error', async () => {
    try {
      await testConnection(cfg, fakeGitHub({ failWith: 401 }).fetchFn);
    } catch (e) {
      expect(String(e)).not.toContain('SECRET');
      expect((e as GitHubError).kind).toBe('auth');
    }
  });
});

// Keep the type import used for the exercise table shape.
export type { Exercise };

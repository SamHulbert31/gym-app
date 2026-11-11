import type { Exercise, Meta, Workout } from '../db/types';
import { contentKey, parseSyncFile, serialize, toSyncFile, type Snapshot } from './format';
import { getFile, GitHubError, putFile, type GitHubConfig } from './github';
import { mergeSnapshots } from './merge';

export type SyncStatus = 'off' | 'synced' | 'syncing' | 'offline' | 'error';

export interface SyncState {
  status: SyncStatus;
  /** Plain words about what went wrong, for the error status. */
  message?: string;
  lastSync?: string;
}

// What the engine needs from the device's database, kept small so tests can use memory.
export interface SyncStore {
  snapshot(): Promise<Snapshot>;
  apply(changes: { exercises: Exercise[]; workouts: Workout[]; meta?: Meta }): Promise<void>;
  setLastSync(iso: string): Promise<void>;
}

export interface EngineDeps {
  store: SyncStore;
  /** null until the sync settings are complete. */
  config: () => GitHubConfig | null;
  fetchFn?: typeof fetch;
  now?: () => Date;
  online?: () => boolean;
  pushDelayMs?: number;
  initialLastSync?: string;
}

export const PUSH_DELAY_MS = 5000;
const MAX_CONFLICT_RETRIES = 3;

const commitMessage = (d: Date) => `Overload sync ${d.toISOString().slice(0, 16)}`;

// One sync: fetch the remote file, merge, write what is new to the device, push if the merge
// changed anything, and retry from a fresh fetch when the file moved under us.
export function createSyncEngine(deps: EngineDeps) {
  const fetchFn = deps.fetchFn ?? fetch;
  const now = deps.now ?? (() => new Date());
  const online = deps.online ?? (() => (typeof navigator === 'undefined' ? true : navigator.onLine));

  let state: SyncState = { status: deps.config() ? 'synced' : 'off', lastSync: deps.initialLastSync };
  const listeners = new Set<(s: SyncState) => void>();
  const set = (patch: Partial<SyncState>) => {
    state = { ...state, ...patch };
    listeners.forEach((fn) => fn(state));
  };

  let running: Promise<SyncState> | null = null;
  let again = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  async function run(): Promise<SyncState> {
    const cfg = deps.config();
    if (!cfg) {
      set({ status: 'off', message: undefined });
      return state;
    }
    if (!online()) {
      set({ status: 'offline', message: undefined });
      return state;
    }
    set({ status: 'syncing', message: undefined });

    try {
      let remote = await getFile(cfg, fetchFn);
      for (let attempt = 0; ; attempt++) {
        const local = await deps.store.snapshot();
        let remoteSnapshot: Snapshot = { exercises: [], workouts: [] };
        let remoteKey = '';
        if (remote) {
          const parsed = parseSyncFile(remote.text); // throws: never overwrite a file we do not understand
          remoteSnapshot = { exercises: parsed.exercises, workouts: parsed.workouts, meta: parsed.meta as Meta | undefined };
          remoteKey = contentKey(parsed);
        }

        const result = mergeSnapshots(local, remoteSnapshot);
        if (result.toLocal.exercises.length || result.toLocal.workouts.length || result.toLocal.meta) {
          await deps.store.apply(result.toLocal);
        }

        const file = toSyncFile(result.merged, now().toISOString());
        const needsPush = !remote || contentKey(file) !== remoteKey;
        if (!needsPush) break;

        try {
          await putFile(cfg, serialize(file), commitMessage(now()), remote?.sha, fetchFn);
          break;
        } catch (e) {
          if (e instanceof GitHubError && e.kind === 'conflict' && attempt < MAX_CONFLICT_RETRIES) {
            remote = await getFile(cfg, fetchFn);
            continue;
          }
          throw e;
        }
      }

      const at = now().toISOString();
      await deps.store.setLastSync(at);
      set({ status: 'synced', lastSync: at, message: undefined });
    } catch (e) {
      if (e instanceof GitHubError && e.kind === 'network') set({ status: 'offline', message: undefined });
      else set({ status: 'error', message: e instanceof Error ? e.message : 'Sync failed.' });
    }
    return state;
  }

  const sync = (): Promise<SyncState> => {
    if (timer) {
      clearTimeout(timer);
      timer = undefined;
    }
    if (running) {
      again = true;
      return running;
    }
    running = (async () => {
      let s = await run();
      while (again) {
        again = false;
        s = await run();
      }
      running = null;
      return s;
    })();
    return running;
  };

  return {
    sync,
    getState: () => state,
    subscribe(fn: (s: SyncState) => void) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    // Edits outside a live session push after a short quiet period rather than on every change.
    schedulePush(delayMs = deps.pushDelayMs ?? PUSH_DELAY_MS) {
      if (!deps.config()) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = undefined;
        void sync();
      }, delayMs);
    },
    hasPendingPush: () => timer !== undefined,
    // A live session is starting: whatever was about to push can wait until it ends.
    cancelPush() {
      if (timer) clearTimeout(timer);
      timer = undefined;
    },
    // Called when the settings change: the status is 'off' until they are complete.
    refresh() {
      if (!deps.config()) set({ status: 'off', message: undefined });
      else if (state.status === 'off') set({ status: 'synced' });
    },
  };
}

export type SyncEngine = ReturnType<typeof createSyncEngine>;

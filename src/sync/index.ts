import { useSyncExternalStore } from 'react';
import { db } from '../db/db';
import { syncConfig } from './config';
import { createSyncEngine, type SyncState } from './engine';
import { dexieStore } from './store';

export const syncEngine = createSyncEngine({ store: dexieStore, config: () => syncConfig() });

// After an edit outside a live session: push after a short quiet period.
export const schedulePush = () => syncEngine.schedulePush();
export const cancelPush = () => syncEngine.cancelPush();

export const useSyncState = (): SyncState => useSyncExternalStore(syncEngine.subscribe, syncEngine.getState);

const FOREGROUND_GAP_MS = 30_000;
let lastAttempt = 0;
const syncNow = () => {
  lastAttempt = Date.now();
  return syncEngine.sync();
};

// App open, return to the foreground, and the connection coming back. Runs once.
let started = false;
export async function startSync() {
  if (started) return;
  started = true;
  const meta = await db.meta.get('meta');
  if (meta?.lastSync) syncEngine.refresh();
  void syncNow();

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    if (Date.now() - lastAttempt > FOREGROUND_GAP_MS || syncEngine.hasPendingPush()) void syncNow();
  });
  window.addEventListener('online', () => void syncNow());
}

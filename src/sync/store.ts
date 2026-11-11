import { db } from '../db/db';
import type { SyncStore } from './engine';

// The engine's view of the device database.
export const dexieStore: SyncStore = {
  async snapshot() {
    const [exercises, workouts, meta] = await Promise.all([db.exercises.toArray(), db.workouts.toArray(), db.meta.get('meta')]);
    return { exercises, workouts, meta };
  },

  // Incoming records replace local ones wholesale (the merge already decided they are newer).
  // lastSync is kept out of the sync file, so a synced settings record keeps the local value.
  apply(changes) {
    return db.transaction('rw', db.exercises, db.workouts, db.meta, async () => {
      if (changes.exercises.length) await db.exercises.bulkPut(changes.exercises);
      if (changes.workouts.length) await db.workouts.bulkPut(changes.workouts);
      if (changes.meta) {
        const current = await db.meta.get('meta');
        await db.meta.put({ ...changes.meta, lastSync: current?.lastSync });
      }
    });
  },

  // Written without touching updatedAt, so recording a sync never causes another one.
  async setLastSync(iso) {
    await db.meta.update('meta', { lastSync: iso });
  },
};

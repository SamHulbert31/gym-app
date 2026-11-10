import { useCallback, useEffect, useState } from 'react';
import { useNow } from './useNow';

const KEY = 'gym.rest';

interface StoredRest {
  workoutId: string;
  endsAt: number;
  durationMs: number;
}

const read = (): StoredRest | null => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? 'null');
  } catch {
    return null;
  }
};

const write = (rest: StoredRest | null) => {
  try {
    if (rest) localStorage.setItem(KEY, JSON.stringify(rest));
    else localStorage.removeItem(KEY);
  } catch {
    // Storage unavailable: the timer still works for this page load.
  }
};

export const clearRest = () => write(null);

// Rest countdown kept as an end timestamp in localStorage, so it survives a lock, close or reload.
export function useRest(workoutId: string) {
  const [rest, setRest] = useState<StoredRest | null>(() => {
    const r = read();
    return r && r.workoutId === workoutId ? r : null;
  });
  const now = useNow(250);

  const remainingMs = rest ? Math.max(0, rest.endsAt - now) : 0;
  const active = !!rest && remainingMs > 0;

  // At zero: buzz if we are watching it happen (not if the phone was locked for ages), then clear.
  useEffect(() => {
    if (!rest || now < rest.endsAt) return;
    if (now - rest.endsAt < 3000) navigator.vibrate?.(250);
    write(null);
    setRest(null);
  }, [rest, now]);

  const start = useCallback(
    (seconds: number) => {
      const next = { workoutId, endsAt: Date.now() + seconds * 1000, durationMs: seconds * 1000 };
      write(next);
      setRest(next);
    },
    [workoutId],
  );

  const skip = useCallback(() => {
    write(null);
    setRest(null);
  }, []);

  return { active, remainingMs, durationMs: rest?.durationMs ?? 0, start, skip };
}

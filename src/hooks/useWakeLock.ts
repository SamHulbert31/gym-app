import { useEffect } from 'react';

// Keeps the screen on while `enabled`, and asks again when the app returns to the foreground
// (the browser drops the lock whenever the page is hidden).
export function useWakeLock(enabled: boolean) {
  useEffect(() => {
    if (!enabled || !('wakeLock' in navigator)) return;
    let sentinel: WakeLockSentinel | undefined;

    const request = async () => {
      if (sentinel && !sentinel.released) return;
      try {
        sentinel = await navigator.wakeLock.request('screen');
      } catch {
        // Denied (low battery, unsupported context). The session works fine without it.
      }
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') void request();
    };

    void request();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      sentinel?.release().catch(() => {});
    };
  }, [enabled]);
}

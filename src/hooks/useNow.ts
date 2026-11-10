import { useEffect, useState } from 'react';

// Re-renders on a tick so clocks refresh. Every displayed value is computed from stored
// timestamps and this number, so a throttled or suspended timer never causes drift.
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const id = setInterval(tick, intervalMs);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [intervalMs]);
  return now;
}

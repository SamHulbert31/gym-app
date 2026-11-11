import { useSyncState } from '../sync';

const LABEL = { synced: 'synced', syncing: 'syncing', offline: 'offline', error: 'sync error', off: '' } as const;

// A few muted words after the date on Home. Nothing at all until sync is set up.
export default function SyncDot() {
  const { status } = useSyncState();
  if (status === 'off') return null;
  return (
    <span className={`sync-dot ${status}`} role="status" aria-live="polite">
      {' · '}
      {LABEL[status]}
    </span>
  );
}

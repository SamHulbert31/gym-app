import { useRegisterSW } from 'virtual:pwa-register/react';

// Shown when a new version has been deployed and is waiting to take over.
export default function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) return null;

  return (
    <div className="toast" role="status">
      <span>Update available</span>
      <div>
        <button className="btn-text" onClick={() => setNeedRefresh(false)} style={{ color: 'var(--muted)' }}>
          Later
        </button>
        <button className="btn-text" onClick={() => updateServiceWorker(true)}>
          Reload
        </button>
      </div>
    </div>
  );
}

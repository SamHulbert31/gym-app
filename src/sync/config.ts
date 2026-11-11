import type { GitHubConfig } from './github';

// Device-only settings. Secrets live here and nowhere else: never in the database, the synced
// file, logs or error messages.
export interface DeviceSettings {
  owner: string;
  repo: string;
  path: string;
  token: string;
  geminiKey: string;
  geminiModel: string;
}

export const DEFAULT_REPO = 'app-data';
export const DEFAULT_PATH = 'gym-app/data.json';

const KEYS: Record<keyof DeviceSettings, string> = {
  owner: 'gym.sync.owner',
  repo: 'gym.sync.repo',
  path: 'gym.sync.path',
  token: 'gym.sync.token',
  geminiKey: 'gym.ai.key',
  geminiModel: 'gym.ai.model',
};

const read = (key: string) => {
  try {
    return localStorage.getItem(key) ?? '';
  } catch {
    return '';
  }
};

export function readSettings(): DeviceSettings {
  return {
    owner: read(KEYS.owner),
    repo: read(KEYS.repo) || DEFAULT_REPO,
    path: read(KEYS.path) || DEFAULT_PATH,
    token: read(KEYS.token),
    geminiKey: read(KEYS.geminiKey),
    geminiModel: read(KEYS.geminiModel),
  };
}

export function writeSettings(patch: Partial<DeviceSettings>) {
  try {
    for (const [k, v] of Object.entries(patch) as [keyof DeviceSettings, string][]) {
      if (v.trim()) localStorage.setItem(KEYS[k], v.trim());
      else localStorage.removeItem(KEYS[k]);
    }
  } catch {
    // Private mode or storage blocked: settings last for this page load only.
  }
}

// Complete enough to sync, or null.
export function syncConfig(s: DeviceSettings = readSettings()): GitHubConfig | null {
  return s.owner && s.repo && s.path && s.token ? { owner: s.owner, repo: s.repo, path: s.path, token: s.token } : null;
}

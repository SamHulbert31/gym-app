import { decodeBase64, encodeBase64 } from './base64';

export interface GitHubConfig {
  owner: string;
  repo: string;
  path: string;
  token: string;
}

export type GitHubErrorKind = 'auth' | 'forbidden' | 'notfound' | 'conflict' | 'ratelimit' | 'network' | 'server' | 'other';

// Every message is written from the status code alone, in plain words. Nothing from the request
// (the token above all) and nothing from the response body ever ends up in one.
export class GitHubError extends Error {
  constructor(
    public kind: GitHubErrorKind,
    message: string,
    public status?: number,
  ) {
    super(message);
    this.name = 'GitHubError';
  }
}

export interface RemoteFile {
  sha: string;
  text: string;
}

const API = 'https://api.github.com';
const encodePath = (path: string) => path.split('/').filter(Boolean).map(encodeURIComponent).join('/');

const headers = (token: string, accept = 'application/vnd.github+json') => ({
  Authorization: `Bearer ${token}`,
  Accept: accept,
  'X-GitHub-Api-Version': '2022-11-28',
});

function errorFor(res: Response, what: string): GitHubError {
  const s = res.status;
  if (s === 401) return new GitHubError('auth', 'GitHub rejected the token. Check it was copied in full and has not expired.', s);
  if (s === 403) {
    if (res.headers.get('x-ratelimit-remaining') === '0') {
      return new GitHubError('ratelimit', "GitHub's rate limit is used up for now. Try again in a few minutes.", s);
    }
    return new GitHubError('forbidden', `The token is not allowed to ${what}. It needs Contents read and write on this repo.`, s);
  }
  if (s === 404) {
    return new GitHubError('notfound', 'GitHub cannot find that repo for this token. Check the owner and repo name, and that the token can access the repo.', s);
  }
  if (s === 409 || s === 422) return new GitHubError('conflict', 'The file changed while syncing.', s);
  if (s >= 500) return new GitHubError('server', `GitHub is having trouble (status ${s}). Try again later.`, s);
  return new GitHubError('other', `GitHub returned an unexpected status ${s}.`, s);
}

async function send(input: string, init: RequestInit, fetchFn: typeof fetch): Promise<Response> {
  try {
    return await fetchFn(input, init);
  } catch {
    throw new GitHubError('network', 'No connection to GitHub.');
  }
}

const fileUrl = (cfg: GitHubConfig) =>
  `${API}/repos/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}/contents/${encodePath(cfg.path)}`;

// The current file, or null when it does not exist yet.
export async function getFile(cfg: GitHubConfig, fetchFn: typeof fetch = fetch): Promise<RemoteFile | null> {
  const res = await send(fileUrl(cfg), { headers: headers(cfg.token), cache: 'no-store' }, fetchFn);
  if (res.status === 404) return null;
  if (!res.ok) throw errorFor(res, 'read the file');
  const body = (await res.json()) as { sha?: string; content?: string; encoding?: string; type?: string };
  if (body.type && body.type !== 'file') throw new GitHubError('other', 'The path in the repo is a folder, not a file.');
  if (typeof body.sha !== 'string') throw new GitHubError('other', 'GitHub sent an answer without a file version.');
  if (body.encoding === 'base64' && typeof body.content === 'string') return { sha: body.sha, text: decodeBase64(body.content) };
  // Over 1 MB GitHub leaves the content out; ask for it raw.
  const raw = await send(fileUrl(cfg), { headers: headers(cfg.token, 'application/vnd.github.raw+json'), cache: 'no-store' }, fetchFn);
  if (!raw.ok) throw errorFor(raw, 'read the file');
  return { sha: body.sha, text: await raw.text() };
}

// Creates or updates the file. `sha` must be the version being replaced; GitHub refuses otherwise.
export async function putFile(
  cfg: GitHubConfig,
  text: string,
  message: string,
  sha: string | undefined,
  fetchFn: typeof fetch = fetch,
): Promise<{ sha: string }> {
  const res = await send(
    fileUrl(cfg),
    {
      method: 'PUT',
      headers: { ...headers(cfg.token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, content: encodeBase64(text), ...(sha ? { sha } : {}) }),
    },
    fetchFn,
  );
  if (!res.ok) throw errorFor(res, 'write the file');
  const body = (await res.json()) as { content?: { sha?: string } };
  if (typeof body.content?.sha !== 'string') throw new GitHubError('other', 'GitHub sent an answer without the new file version.');
  return { sha: body.content.sha };
}

export interface ConnectionInfo {
  fullName: string;
  isPrivate: boolean;
  canWrite: boolean;
}

// "Test connection": can the token see the repo, and may it write to it?
export async function testConnection(cfg: GitHubConfig, fetchFn: typeof fetch = fetch): Promise<ConnectionInfo> {
  const res = await send(
    `${API}/repos/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}`,
    { headers: headers(cfg.token), cache: 'no-store' },
    fetchFn,
  );
  if (!res.ok) throw errorFor(res, 'see the repo');
  const body = (await res.json()) as { full_name?: string; private?: boolean; permissions?: { push?: boolean } };
  return {
    fullName: body.full_name ?? `${cfg.owner}/${cfg.repo}`,
    isPrivate: body.private === true,
    canWrite: body.permissions?.push === true,
  };
}

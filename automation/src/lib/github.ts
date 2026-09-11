/**
 * Minimal GitHub REST client for the vault automation (issue create/search).
 *
 * Uses `fetch` + `GITHUB_TOKEN` (F3) — NOT the `gh` CLI — so the SAME code path
 * works on GitHub-hosted runners (issue-sync) and on self-hosted runners
 * (issue-gate), which may not have `gh` installed. Zero runtime deps (Node 18+
 * global `fetch`). Idempotency (search-before-create) lives here so both callers
 * share one behaviour.
 */

/** GitHub API host; overridable for GHES via `GITHUB_API_URL`. */
const API = process.env.GITHUB_API_URL?.replace(/\/+$/, '') || 'https://api.github.com';

/** `owner/repo` from the Actions-provided `GITHUB_REPOSITORY`. */
export function currentRepo(): string {
  const repo = process.env.GITHUB_REPOSITORY?.trim();
  if (!repo) throw new Error('GITHUB_REPOSITORY is not set (run inside GitHub Actions).');
  return repo;
}

function token(): string {
  const t = process.env.GITHUB_TOKEN?.trim();
  if (!t) throw new Error('GITHUB_TOKEN is not set (needs `permissions: issues: write`).');
  return t;
}

async function api(path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token()}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  return res;
}

/** An existing issue, as far as the automation cares. */
export interface ExistingIssue {
  number: number;
  title: string;
  html_url: string;
}

/**
 * Find an OPEN or CLOSED issue whose title contains the exact `[identifier]`
 * token. Search is scoped to the repo via the Search API; the client-side
 * `includes` check guards against Search's fuzzy tokenising so we never create a
 * duplicate for an already-tracked experiment.
 */
export async function findIssueByIdentifier(
  repo: string,
  identifier: string
): Promise<ExistingIssue | undefined> {
  const token = `[${identifier}]`;
  const q = encodeURIComponent(`repo:${repo} in:title "${token}" type:issue`);
  const res = await api(`/search/issues?q=${q}&per_page=100`);
  if (!res.ok) {
    throw new Error(`Issue search failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { items?: ExistingIssue[] };
  return (data.items ?? []).find(item => item.title.includes(token));
}

/** Parameters for creating a new experiment issue. */
export interface CreateIssueInput {
  title: string;
  body: string;
  labels: string[];
}

/** Create an issue, returning the created record. */
export async function createIssue(
  repo: string,
  input: CreateIssueInput
): Promise<ExistingIssue> {
  const res = await api(`/repos/${repo}/issues`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    throw new Error(`Issue create failed: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as ExistingIssue;
}

/**
 * Create the experiment issue only when one does not already exist for
 * `identifier` (idempotent). Returns the existing or newly created issue plus
 * whether it was created, so callers can log a deterministic summary.
 */
export async function ensureIssue(
  repo: string,
  identifier: string,
  input: CreateIssueInput
): Promise<{ issue: ExistingIssue; created: boolean }> {
  const existing = await findIssueByIdentifier(repo, identifier);
  if (existing) return { issue: existing, created: false };
  const issue = await createIssue(repo, input);
  return { issue, created: true };
}

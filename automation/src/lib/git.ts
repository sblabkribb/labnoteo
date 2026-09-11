/**
 * Git helpers for the vault automation scripts (Phase 3–5).
 *
 * Zero-dependency (node built-ins only). The bundled `.mjs` runs inside a vault
 * checked out by a GitHub Actions `push` job, so the working directory is the
 * repository root. These helpers derive the set of files a push changed so the
 * downstream scripts only act on what actually moved (noise/loop avoidance).
 */
import { execFileSync } from 'node:child_process';

/** All-zero SHA GitHub sends for the first push to a new branch. */
const ZERO_SHA = '0000000000000000000000000000000000000000';

/** Run `git` and return trimmed non-empty stdout lines (never throws upward). */
function git(args: string[]): string[] {
  try {
    const out = execFileSync('git', args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return out
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * The files changed by the current push.
 *
 * Prefers the `github.event.before`/`after` range (env `BEFORE_SHA`/`AFTER_SHA`,
 * wired by the workflow). Falls back to the last commit, then — when git is
 * unavailable — an empty list so callers can decide on a full scan.
 *
 * Returns forward-slash POSIX paths (git already emits these) so they compose
 * with the `@labnoteo/core` path helpers.
 */
export function getChangedFiles(): string[] {
  const before = process.env.BEFORE_SHA?.trim();
  const after = process.env.AFTER_SHA?.trim();

  if (before && after && before !== ZERO_SHA) {
    const diff = git(['diff', '--name-only', `${before}..${after}`]);
    if (diff.length > 0) return diff;
  }

  // First push on a branch (or no range provided): use the tip commit.
  const head = after && after !== ZERO_SHA ? after : 'HEAD';
  const show = git(['show', '--name-only', '--pretty=format:', head]);
  return show;
}

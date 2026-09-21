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

/**
 * Run a path-listing `git` command and return the paths it reports. Throws when
 * git fails, so callers can tell "no changes" from "not a repository".
 *
 * `-z` is required for correctness, not speed. Without it git honours
 * `core.quotePath` and emits non-ASCII paths double-quoted and octal-escaped
 * (`"labnote/001_\353\213\250\353\260\261\354\247\210/README.labnote.md"`).
 * Those strings match no file on disk, so every Korean-named path silently
 * dropped out of the large-file guard and the issue sync. NUL separation also
 * keeps paths containing spaces or newlines intact — which is why the parts are
 * deliberately not trimmed.
 */
export function gitPaths(args: string[]): string[] {
  const out = execFileSync('git', [...args, '-z'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  return out.split('\0').filter(Boolean);
}

/** {@link gitPaths}, but an unavailable repo/binary reads as an empty list. */
function git(args: string[]): string[] {
  try {
    return gitPaths(args);
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

// Globals convention (no `import ... from 'vitest'`) — matches the core tests.
//
// These tests run a REAL `git` against a throwaway repository on purpose. The
// bug they pin lived exactly at the boundary the pure-function tests never
// crossed: git's own stdout formatting. With `core.quotePath` at its default,
// git double-quotes and octal-escapes non-ASCII paths, so a Korean-named file
// came back as `"\354\213\244\355\227\230.bam"` — a string that matches nothing
// on disk. The large-file guard then skipped it and the issue sync never saw
// its experiment folder, both without a word of warning.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { gitPaths } from './git';

const KOREAN = '실험_원시데이터.bam';
const ASCII = 'plain.bam';

function git(repo: string, args: string[]): void {
  execFileSync('git', args, { cwd: repo, stdio: 'ignore' });
}

describe('gitPaths', () => {
  let repo: string;
  let cwd: string;

  beforeEach(() => {
    repo = mkdtempSync(path.join(tmpdir(), 'labnoteo-git-'));
    git(repo, ['init', '--quiet']);
    // A fresh CI runner has no identity configured, and `commit` refuses
    // without one.
    git(repo, ['config', 'user.email', 'test@example.com']);
    git(repo, ['config', 'user.name', 'Test']);
    // Leave `core.quotePath` at its default: the escaping this guards against
    // is the out-of-the-box behaviour, not an exotic configuration.
    writeFileSync(path.join(repo, KOREAN), 'x');
    writeFileSync(path.join(repo, ASCII), 'x');
    git(repo, ['add', '-A']);

    cwd = process.cwd();
    process.chdir(repo);
  });

  afterEach(() => {
    process.chdir(cwd);
    rmSync(repo, { recursive: true, force: true });
  });

  it('reports non-ASCII staged paths unescaped, exactly as they are on disk', () => {
    const staged = gitPaths(['diff', '--cached', '--name-only', '--diff-filter=ACM']);

    expect(staged).toContain(KOREAN);
    expect(staged).toContain(ASCII);
    // The regression: a quoted, octal-escaped entry instead of the real name.
    expect(staged.some(p => p.startsWith('"'))).toBe(false);
  });

  it('reports non-ASCII tracked paths unescaped', () => {
    git(repo, ['commit', '--quiet', '-m', 'init']);

    const tracked = gitPaths(['ls-files']);

    expect(tracked).toContain(KOREAN);
    expect(tracked.some(p => p.startsWith('"'))).toBe(false);
  });

  it('keeps paths that contain a space intact', () => {
    // NUL separation, not line splitting, is what makes this safe — and it is
    // why the returned parts must not be trimmed.
    const spaced = 'raw data 001.bam';
    writeFileSync(path.join(repo, spaced), 'x');
    git(repo, ['add', '-A']);

    expect(gitPaths(['diff', '--cached', '--name-only', '--diff-filter=ACM'])).toContain(spaced);
  });

  it('throws when git cannot resolve a repository', () => {
    // `collectFiles` relies on the throw to fall back to walking the working
    // tree; an empty list would instead read as "nothing to check".
    //
    // Pointing `GIT_DIR` at a missing directory rather than just chdir-ing
    // somewhere outside a repo: the OS temp dir is often nested under another
    // checkout (a `git init`-ed home directory is enough), which would make
    // this pass or fail depending on whose machine it runs on.
    const previous = process.env.GIT_DIR;
    process.env.GIT_DIR = path.join(repo, 'no-such-git-dir');
    try {
      expect(() => gitPaths(['ls-files'])).toThrow();
    } finally {
      if (previous === undefined) delete process.env.GIT_DIR;
      else process.env.GIT_DIR = previous;
    }
  });
});

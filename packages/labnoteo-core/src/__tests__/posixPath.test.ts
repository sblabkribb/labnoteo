// Globals convention (no `import ... from 'vitest'`) — see sampleDefinition.test.ts.
//
// Phase 0 regression safety net for the path helpers that every write path is
// built on (`util/posixPath.ts`, previously 0 direct tests). Correct behaviour
// is locked in with plain `it(...)`. A currently-reproduced bug is pinned with
// `it.fails(...)`, which passes *because* the assertion currently throws; when
// Phase 7 fixes the UNC handling, `it.fails` will start erroring ("expected to
// fail") and must be flipped to a normal `it(...)`.
import { normalize, join, dirname, basename, extname } from '../util/posixPath';

describe('posixPath.normalize', () => {
  it('collapses . and .. segments', () => {
    expect(normalize('a/./b/../c')).toBe('a/c');
  });

  it('dedups slashes and drops a trailing slash, preserving POSIX root', () => {
    expect(normalize('/a//b/')).toBe('/a/b');
    expect(normalize('a/b/')).toBe('a/b');
  });

  it('does not let .. escape above a rooted path', () => {
    expect(normalize('/a/../../b')).toBe('/b');
  });

  it('keeps leading .. for relative paths (so traversal is visible to callers)', () => {
    // This is *current* behaviour and the reason Phase 1-1 must add an explicit
    // guard: normalize alone does not neutralise a `..` prefix on a relative
    // path.
    expect(normalize('../../evil')).toBe('../../evil');
  });

  it('converts backslashes and preserves a Windows drive prefix', () => {
    expect(normalize('C:\\vault\\note.md')).toBe('C:/vault/note.md');
    expect(normalize('C:/a/../b')).toBe('C:/b');
  });

  it('returns "." for an empty result', () => {
    expect(normalize('')).toBe('.');
    expect(normalize('a/..')).toBe('.');
  });

  // Fixed in Phase 7: a UNC path `//server/share` preserves its leading `//`
  // (previously collapsed to `/server/share`, losing the host).
  it('preserves a leading // for UNC paths', () => {
    expect(normalize('//server/share/file')).toBe('//server/share/file');
    // 3+ leading slashes still collapse to a single root (POSIX).
    expect(normalize('///server/share')).toBe('/server/share');
  });
});

describe('posixPath.join', () => {
  it('joins vault-relative segments, ignoring empty parts', () => {
    expect(join('', 'labnote', '001_Exp')).toBe('labnote/001_Exp');
  });

  it('normalises the joined result', () => {
    expect(join('a', 'b', '..', 'c')).toBe('a/c');
  });

  it('returns "." when given nothing to join', () => {
    expect(join()).toBe('.');
    expect(join('', null, undefined)).toBe('.');
  });
});

describe('posixPath dirname/basename/extname', () => {
  it('dirname returns the parent (POSIX semantics)', () => {
    expect(dirname('a/b/c')).toBe('a/b');
    expect(dirname('a')).toBe('.');
    expect(dirname('/a')).toBe('/');
  });

  it('basename returns the final segment, optionally stripping an extension', () => {
    expect(basename('a/b/c.md')).toBe('c.md');
    expect(basename('a/b/c.md', '.md')).toBe('c');
  });

  it('extname returns the trailing extension including the dot', () => {
    expect(extname('a/b/c.md')).toBe('.md');
    expect(extname('a/b/c')).toBe('');
    expect(extname('.dotfile')).toBe('');
  });
});

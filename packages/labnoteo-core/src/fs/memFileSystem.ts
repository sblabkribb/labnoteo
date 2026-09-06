import type { LabnoteFs } from './labnoteFs';

/**
 * Minimal shape of a Node `ErrnoException` without depending on the `NodeJS`
 * global namespace — this module is browser-safe (re-exported from the core
 * barrel, which the webview typechecks) and must not require `@types/node`.
 */
interface ErrnoError extends Error {
  code?: string;
}

/**
 * In-memory {@link LabnoteFs} for tests. Paths are used verbatim as map keys,
 * so tests should be consistent about separators (POSIX `/` recommended). This
 * lets shared logic be tested without mocking `node:fs`, which is the whole
 * point of routing I/O through the LabnoteFs port.
 *
 * Directory semantics are intentionally lightweight: a "directory" exists if it
 * was created via {@link mkdir}, if a file lives under it, or if a child dir
 * lives under it. `list` returns the immediate child entry names.
 */
export class MemFileSystem implements LabnoteFs {
  private files = new Map<string, string>();
  private dirs = new Set<string>();

  constructor(initial?: Record<string, string>) {
    if (initial) {
      for (const [p, content] of Object.entries(initial)) {
        this.files.set(p, content);
        this.markParents(p);
      }
    }
  }

  private markParents(p: string): void {
    let dir = parentOf(p);
    while (dir && !this.dirs.has(dir)) {
      this.dirs.add(dir);
      dir = parentOf(dir);
    }
  }

  async read(path: string): Promise<string> {
    const v = this.files.get(path);
    if (v === undefined) {
      const err = new Error(`ENOENT: no such file, open '${path}'`) as ErrnoError;
      err.code = 'ENOENT';
      throw err;
    }
    return v;
  }

  async write(path: string, content: string): Promise<void> {
    this.files.set(path, content);
    this.markParents(path);
  }

  async exists(path: string): Promise<boolean> {
    return this.files.has(path) || this.dirs.has(path);
  }

  async mkdir(path: string): Promise<void> {
    this.dirs.add(path);
    this.markParents(path);
  }

  async list(dir: string): Promise<string[]> {
    const prefix = dir.endsWith('/') ? dir : `${dir}/`;
    const names = new Set<string>();
    for (const key of [...this.files.keys(), ...this.dirs]) {
      if (!key.startsWith(prefix)) continue;
      const rest = key.slice(prefix.length);
      const name = rest.split('/')[0];
      if (name) names.add(name);
    }
    return [...names];
  }

  async remove(path: string): Promise<void> {
    this.files.delete(path);
  }

  /** Test helper: raw snapshot of written file contents. */
  snapshot(): Record<string, string> {
    return Object.fromEntries(this.files);
  }
}

function parentOf(p: string): string {
  const idx = p.replace(/\/+$/, '').lastIndexOf('/');
  return idx <= 0 ? '' : p.slice(0, idx);
}

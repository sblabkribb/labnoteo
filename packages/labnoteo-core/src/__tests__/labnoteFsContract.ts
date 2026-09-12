/**
 * Shared behavioural contract for {@link LabnoteFs} implementations.
 *
 * Every implementation (in-memory `MemFileSystem`, and — once the Phase 3 Vault
 * API rewrite lands — the plugin's `VaultFileSystem`) must satisfy the same
 * observable semantics: create/overwrite, `modify` atomicity, `list` returning
 * bare entry names, and sensible handling of missing paths. Import this from a
 * `*.test.ts` and call {@link runLabnoteFsContract} with a factory.
 *
 * This file is intentionally NOT named `*.test.ts` so vitest does not collect it
 * as a standalone suite (it exposes no top-level tests, only the shared runner).
 */
import { describe, it, expect } from 'vitest';
import type { LabnoteFs } from '../fs/labnoteFs';

export function runLabnoteFsContract(name: string, makeFs: () => LabnoteFs): void {
  describe(`LabnoteFs contract: ${name}`, () => {
    it('read rejects for a missing path', async () => {
      const fs = makeFs();
      await expect(fs.read('missing.txt')).rejects.toThrow();
    });

    it('write then read round-trips (creating parent dirs)', async () => {
      const fs = makeFs();
      await fs.write('a/b/c.txt', 'hello');
      expect(await fs.read('a/b/c.txt')).toBe('hello');
    });

    it('write overwrites existing content', async () => {
      const fs = makeFs();
      await fs.write('f.txt', 'one');
      await fs.write('f.txt', 'two');
      expect(await fs.read('f.txt')).toBe('two');
    });

    it('exists reflects writes and removals', async () => {
      const fs = makeFs();
      expect(await fs.exists('x.txt')).toBe(false);
      await fs.write('x.txt', '.');
      expect(await fs.exists('x.txt')).toBe(true);
      await fs.remove('x.txt');
      expect(await fs.exists('x.txt')).toBe(false);
    });

    it('remove is a no-op for a missing path', async () => {
      const fs = makeFs();
      await expect(fs.remove('gone.txt')).resolves.toBeUndefined();
    });

    it('rmdir removes an empty directory', async () => {
      const fs = makeFs();
      await fs.mkdir('empty');
      expect(await fs.exists('empty')).toBe(true);
      await fs.rmdir('empty');
      expect(await fs.exists('empty')).toBe(false);
    });

    it('rmdir leaves a non-empty directory (and its contents) alone', async () => {
      const fs = makeFs();
      await fs.write('keep/file.txt', '.');
      await fs.rmdir('keep');
      expect(await fs.exists('keep')).toBe(true);
      expect(await fs.read('keep/file.txt')).toBe('.');
    });

    it('rmdir is a no-op for a missing directory', async () => {
      const fs = makeFs();
      await expect(fs.rmdir('never-existed')).resolves.toBeUndefined();
    });

    it('list returns bare entry names, empty for a missing dir', async () => {
      const fs = makeFs();
      expect(await fs.list('nope')).toEqual([]);
      await fs.write('dir/one.txt', '1');
      await fs.write('dir/two.txt', '2');
      expect((await fs.list('dir')).sort()).toEqual(['one.txt', 'two.txt']);
    });

    it('modify creates the file when absent (updater sees the empty string)', async () => {
      const fs = makeFs();
      let seen: string | undefined;
      await fs.modify('m.txt', (data) => {
        seen = data;
        return `${data}x`;
      });
      expect(seen).toBe('');
      expect(await fs.read('m.txt')).toBe('x');
    });

    it('modify updates existing content', async () => {
      const fs = makeFs();
      await fs.write('m.txt', 'a');
      await fs.modify('m.txt', (d) => `${d}b`);
      expect(await fs.read('m.txt')).toBe('ab');
    });

    it('concurrent modify calls never lose an update (per-file atomicity)', async () => {
      const fs = makeFs();
      await fs.write('c.json', JSON.stringify({ n: 0 }));
      const inc = () =>
        fs.modify('c.json', (raw) => {
          const obj = JSON.parse(raw || '{"n":0}') as { n: number };
          obj.n += 1;
          return JSON.stringify(obj);
        });
      // If read and write could interleave, some increments would clobber
      // others and the final count would be < 5.
      await Promise.all([inc(), inc(), inc(), inc(), inc()]);
      const final = JSON.parse(await fs.read('c.json')) as { n: number };
      expect(final.n).toBe(5);
    });
  });
}

/**
 * `writeNoteThroughVault` is the seam that keeps an AI or sync-driven edit from
 * being silently undone.
 *
 * When a note is open, Obsidian's editor holds its own buffer and flushes it on
 * its own schedule. A write that goes straight to the vault *adapter* is
 * invisible to that buffer, so the next flush overwrites it. Routing through
 * `vault.process` makes the editor observe the change instead. Picking the
 * wrong branch loses user data with no error anywhere, which is exactly the
 * kind of failure a unit test has to catch.
 */
import { describe, it, expect } from 'vitest';
import type { App } from 'obsidian';
import { TFile, TFolder } from '../stubs/obsidian';
import type { LabnoteHost } from '@labnoteo/core';
import { MemFileSystem } from '../../packages/labnoteo-core/src/fs/memFileSystem';
import { writeNoteThroughVault } from '../../src/commands';

/** Records which path each write took, so a silent fallback cannot pass. */
function makeApp(indexed: Record<string, TFile | TFolder>) {
  const processed: Array<{ path: string; content: string }> = [];
  const app = {
    vault: {
      getFileByPath: (path: string) => indexed[path] ?? null,
      process: async (file: TFile, fn: (data: string) => string) => {
        const next = fn('previous contents');
        processed.push({ path: file.path, content: next });
        return next;
      },
    },
  };
  return { app: app as unknown as App, processed };
}

function makeHost(fs: MemFileSystem) {
  return { fs } as unknown as LabnoteHost;
}

const NOTE = 'labnote/001_Test/README.labnote.md';

describe('writeNoteThroughVault', () => {
  it('routes through vault.process when the note is in the vault index', async () => {
    const file = new TFile(NOTE);
    const { app, processed } = makeApp({ [NOTE]: file });
    const fs = new MemFileSystem();

    await writeNoteThroughVault(app, makeHost(fs), NOTE, 'new content');

    expect(processed).toEqual([{ path: NOTE, content: 'new content' }]);
    // The adapter must NOT also be written: that is the path the open editor
    // cannot see, and doing both would defeat the point.
    expect(fs.snapshot()).toEqual({});
  });

  it('replaces the contents wholesale, ignoring what process hands it', async () => {
    const { app, processed } = makeApp({ [NOTE]: new TFile(NOTE) });

    await writeNoteThroughVault(app, makeHost(new MemFileSystem()), NOTE, 'replacement');

    // The updater is a constant function; the previous contents are discarded
    // because callers have already computed the full new document.
    expect(processed[0].content).toBe('replacement');
  });

  it('falls back to the adapter when the note is not in the index', async () => {
    const { app, processed } = makeApp({});
    const fs = new MemFileSystem();

    await writeNoteThroughVault(app, makeHost(fs), NOTE, 'brand new');

    expect(processed).toEqual([]);
    expect(await fs.read(NOTE)).toBe('brand new');
  });

  it('falls back when the path resolves to a folder rather than a file', async () => {
    // `getFileByPath` is typed as returning a TFile, but a stale or odd index
    // entry must not reach `vault.process`, which would throw.
    const folder = new TFolder();
    folder.path = NOTE;
    const { app, processed } = makeApp({ [NOTE]: folder });
    const fs = new MemFileSystem();

    await writeNoteThroughVault(app, makeHost(fs), NOTE, 'content');

    expect(processed).toEqual([]);
    expect(await fs.read(NOTE)).toBe('content');
  });

  it('preserves content exactly, including trailing newlines and unicode', async () => {
    const { app, processed } = makeApp({ [NOTE]: new TFile(NOTE) });
    const content = '# 실험 노트\n\n- 항목 1\n\n';

    await writeNoteThroughVault(app, makeHost(new MemFileSystem()), NOTE, content);

    expect(processed[0].content).toBe(content);
  });

  it('writes an empty document rather than skipping the write', async () => {
    const { app, processed } = makeApp({ [NOTE]: new TFile(NOTE) });

    await writeNoteThroughVault(app, makeHost(new MemFileSystem()), NOTE, '');

    expect(processed).toEqual([{ path: NOTE, content: '' }]);
  });
});

import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';
import * as nodePath from 'node:path';
import type { LabnoteFs } from '../fs/labnoteFs';

/**
 * Node / VS Code implementation of {@link LabnoteFs}.
 *
 * Atomicity strategy: `write` lands data via write-temp-then-rename. rename(2)
 * is atomic on POSIX and Node maps it to a replace-existing move on Windows, so
 * a reader never observes a half-written file and a previously valid file
 * survives an interrupted write. This is the same technique the legacy
 * `atomicWrite.ts` used; it lives here now because atomicity is an adapter
 * concern that must NOT leak into shared core logic (the temp+rename trick
 * breaks inside an Obsidian vault).
 *
 * `write` also creates missing parent directories, matching the ergonomics the
 * previous sample/workflow save helpers provided via explicit `mkdirSync`.
 */
export class NodeFileSystem implements LabnoteFs {
  async read(path: string): Promise<string> {
    return fsp.readFile(path, 'utf8');
  }

  async write(path: string, content: string): Promise<void> {
    await fsp.mkdir(nodePath.dirname(path), { recursive: true });
    const tmpPath = `${path}.tmp-${process.pid}-${Date.now()}`;
    await fsp.writeFile(tmpPath, content, 'utf8');
    try {
      await fsp.rename(tmpPath, path);
    } catch (err) {
      try {
        await fsp.unlink(tmpPath);
      } catch {
        // Ignore cleanup failure; surface the original rename error.
      }
      throw err;
    }
  }

  async exists(path: string): Promise<boolean> {
    try {
      await fsp.access(path, fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  async mkdir(path: string): Promise<void> {
    await fsp.mkdir(path, { recursive: true });
  }

  async list(dir: string): Promise<string[]> {
    try {
      return await fsp.readdir(dir);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw err;
    }
  }

  async remove(path: string): Promise<void> {
    try {
      await fsp.unlink(path);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return;
      throw err;
    }
  }
}

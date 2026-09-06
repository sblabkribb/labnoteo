/**
 * VaultFileSystem — the Obsidian implementation of {@link LabnoteFs}.
 *
 * Backed by Obsidian's `DataAdapter` (`app.vault.adapter`), which speaks
 * vault-relative POSIX paths and is fully async. We deliberately use the
 * *adapter* rather than the `Vault`/`TFile` API because sample/workflow storage
 * files (`resources/labsamples/*.json`, catalog JSON) are plain data files that
 * may live outside the markdown file cache, and the adapter gives uniform
 * path-based access to them.
 *
 * Atomicity note (see LabnoteFs docs): Obsidian persists writes through its own
 * mechanism; the temp-then-rename trick used by the Node adapter actively breaks
 * inside a vault, so `write` here is a plain adapter write.
 */
import type { DataAdapter } from 'obsidian';
import type { LabnoteFs } from '@labnoteo/core';
import * as posix from '@labnoteo/core/posix';

export class VaultFileSystem implements LabnoteFs {
  constructor(private readonly adapter: DataAdapter) {}

  async read(path: string): Promise<string> {
    return this.adapter.read(normalize(path));
  }

  async write(path: string, content: string): Promise<void> {
    const p = normalize(path);
    await this.ensureParent(p);
    await this.adapter.write(p, content);
  }

  /**
   * Interim `modify`: a plain read-or-empty → update → write over the adapter.
   *
   * NOTE: this is NOT yet atomic. True per-file atomicity requires the Vault
   * API (`vault.process`), which is the deferred Phase 3 rewrite. Behaviour here
   * is intentionally identical to the previous read+write callers, so nothing
   * regresses; the atomicity guarantee only becomes real once this class is
   * migrated off the adapter. The core logic is already structured around
   * `modify` so that migration is a drop-in.
   */
  async modify(path: string, updater: (data: string) => string): Promise<void> {
    const p = normalize(path);
    await this.ensureParent(p);
    const current = (await this.adapter.exists(p)) ? await this.adapter.read(p) : '';
    await this.adapter.write(p, updater(current));
  }

  async exists(path: string): Promise<boolean> {
    return this.adapter.exists(normalize(path));
  }

  async mkdir(path: string): Promise<void> {
    const p = normalize(path);
    if (!(await this.adapter.exists(p))) {
      await this.adapter.mkdir(p);
    }
  }

  async list(dir: string): Promise<string[]> {
    const p = normalize(dir);
    if (!(await this.adapter.exists(p))) return [];
    const listed = await this.adapter.list(p);
    // The adapter returns full vault-relative paths for both files and folders;
    // LabnoteFs.list is specified to return bare entry names.
    return [...listed.files, ...listed.folders].map(entry => posix.basename(entry));
  }

  async remove(path: string): Promise<void> {
    const p = normalize(path);
    if (await this.adapter.exists(p)) {
      await this.adapter.remove(p);
    }
  }

  /** Recursively create the parent directory chain for a file path. */
  private async ensureParent(filePath: string): Promise<void> {
    const dir = posix.dirname(filePath);
    if (dir && dir !== '.' && dir !== '/' && !(await this.adapter.exists(dir))) {
      await this.adapter.mkdir(dir);
    }
  }
}

/**
 * Normalise an incoming path to the vault-relative POSIX form the adapter
 * expects. A leading `/` is stripped since the adapter roots everything at the
 * vault folder.
 */
function normalize(path: string): string {
  const p = posix.normalize(path);
  return p.startsWith('/') ? p.slice(1) : p;
}

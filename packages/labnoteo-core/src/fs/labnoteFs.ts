/**
 * LabnoteFs — the platform-neutral file-system port.
 *
 * Core logic (sample storage, workflow catalogs, exporters) MUST talk to disk
 * exclusively through this interface so the same code runs on any host:
 *   - Obsidian  → `VaultFileSystem`, backed by the vault's `DataAdapter`
 *   - Tests     → `MemFileSystem`, entirely in memory
 *
 * Design notes:
 * - Every method is async. Obsidian's `vault`/`adapter` API has no synchronous
 *   surface, so a sync interface could never be honoured there.
 * - `write` does NOT expose an "atomic" flag. Atomicity is the implementation's
 *   responsibility — callers just ask for the bytes to land, and how durably is
 *   the adapter's concern. (The classic write-temp-then-rename trick actively
 *   breaks inside an Obsidian vault, so it must not leak into shared logic.)
 * - Paths are opaque strings; the Obsidian adapter reads them as vault-relative
 *   POSIX paths. Shared logic composes paths via the POSIX helpers in
 *   `util/posixPath`, never `node:path`.
 *
 * Every implementation must pass `__tests__/labnoteFsContract`, which is where
 * the guarantees below are actually enforced.
 */
export interface LabnoteFs {
  /** Read a UTF-8 text file. Rejects if the path does not exist. */
  read(path: string): Promise<string>;
  /**
   * Write a UTF-8 text file, creating or replacing it. The implementation is
   * responsible for doing so as durably/atomically as its platform allows.
   */
  write(path: string, content: string): Promise<void>;
  /**
   * Atomically read-modify-write a text file. `updater` receives the current
   * contents (the empty string `''` when the file does not exist yet) and
   * returns the bytes to persist.
   *
   * The implementation MUST guarantee that the read and the write happen without
   * another write to the same path interleaving between them, so that concurrent
   * callers targeting one file never lose updates (the classic lost-update race
   * behind `{Type}.json` corruption). `updater` MUST be synchronous — the
   * Obsidian adapter delegates to `process()`, whose callback is synchronous, so
   * any async work (e.g. reading a second file) has to be hoisted out and
   * captured before calling `modify`.
   */
  modify(path: string, updater: (data: string) => string): Promise<void>;
  /** True if a file or directory exists at `path`. */
  exists(path: string): Promise<boolean>;
  /** Recursively create `path` as a directory. No-op if it already exists. */
  mkdir(path: string): Promise<void>;
  /**
   * List the entry names (not full paths) directly inside `dir`. Returns an
   * empty array if `dir` does not exist.
   */
  list(dir: string): Promise<string[]>;
  /** Delete the file at `path`. No-op if it does not exist. */
  remove(path: string): Promise<void>;
  /**
   * Delete the directory at `path`. Non-recursive by design: a no-op if the
   * directory is missing or still has entries, so a caller pruning leftovers
   * can never take a user's files with it.
   */
  rmdir(path: string): Promise<void>;
}

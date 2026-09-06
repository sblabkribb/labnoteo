/**
 * LabnoteFs — the platform-neutral file-system port.
 *
 * Core logic (sample storage, workflow catalogs, exporters) MUST talk to disk
 * exclusively through this interface so the same code runs on:
 *   - VS Code / Node  → `NodeFileSystem` (fs-backed, see `@labnoteo/core/node`)
 *   - Obsidian        → a `vault`-backed adapter (async-only API)
 *
 * Design notes:
 * - Every method is async. Obsidian's `vault`/`adapter` API has no synchronous
 *   surface, so a sync interface could never be honoured there.
 * - `write` does NOT expose an "atomic" flag. Atomicity is the implementation's
 *   responsibility: the Node adapter uses write-temp-then-rename, while the
 *   Obsidian adapter uses `vault.process()`/`vault.modify()`. Callers just ask
 *   for the bytes to land; how durably is the adapter's concern. (The classic
 *   temp+rename trick actively breaks inside an Obsidian vault, so it must not
 *   leak into shared logic.)
 * - Paths are opaque strings. The Node adapter treats them as absolute OS
 *   paths; the Obsidian adapter treats them as vault-relative POSIX paths.
 *   Shared logic composes paths via the POSIX helpers, never `node:path`.
 */
export interface LabnoteFs {
  /** Read a UTF-8 text file. Rejects if the path does not exist. */
  read(path: string): Promise<string>;
  /**
   * Write a UTF-8 text file, creating or replacing it. The implementation is
   * responsible for doing so as durably/atomically as its platform allows.
   */
  write(path: string, content: string): Promise<void>;
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
}

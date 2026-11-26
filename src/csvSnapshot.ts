import type { LabnoteFs } from '@labnoteo/core';

/** Raw text, null for an absent path, or undefined when it could not be read. */
export async function csvSnapshot(fs: LabnoteFs, path: string): Promise<string | null | undefined> {
  try {
    return await fs.exists(path) ? await fs.read(path) : null;
  } catch {
    return undefined;
  }
}

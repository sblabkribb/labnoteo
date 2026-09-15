/**
 * check-large-files — CLI entry for the vault large-file guard.
 *
 * Source of the zero-dependency `.labnoteo/scripts/check-large-files.mjs` the
 * plugin scaffolds into a vault; the pre-commit hook runs it with `--staged`.
 * The logic lives in `lib/largeFiles.ts`.
 *
 * This file holds NOTHING but the entry guard, and that separation is load
 * bearing. Each script is bundled standalone, so an `import.meta.url` check in
 * a shared module would be inlined into every bundle that reuses it and would
 * match there too — `validate.mjs` would exit through this guard before running
 * a single check of its own. Keep entry guards in files nothing else imports.
 */
import { pathToFileURL } from 'node:url';
import { run } from './lib/largeFiles';

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(run());
}

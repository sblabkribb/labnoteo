/**
 * validate — deterministic server-side check for a research vault (Phase 3).
 *
 * Scans every `labnote/**\/README.labnote.md`, and for notes with
 * `experiment_type: labnote` verifies:
 *   - `status` is one of the controlled `EXPERIMENT_STATUSES` (required),
 *   - `id` values are unique across experiments (duplicate → error),
 * then re-runs the central large-file size guard.
 *
 * Lenient by design initially: only `status` is required; other fields are
 * recommended. Deterministic and AI-free. Exits non-zero with clear messages so
 * `validate.yml` gates a push. Reuses the SAME `@labnoteo/core` primitives the
 * plugin uses (no re-implementation → no drift) and the same large-file check.
 *
 * Zero runtime deps: node built-ins + inlined `@labnoteo/core`.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { isValidStatus, EXPERIMENT_STATUSES } from '@labnoteo/core/lib/experimentStatus';
import { parseFrontMatterYaml } from '@labnoteo/core';
import { run as runLargeFileCheck } from './check-large-files';
import { README_NAME, readStringField } from './lib/experiments';

/** One parsed note handed to the pure validator. */
export interface ValidatedNote {
  /** Repo-relative POSIX path to the README. */
  path: string;
  frontMatter: Record<string, unknown>;
}

/**
 * Pure validation of the experiment notes. Returns a list of human-readable
 * error strings (empty = valid). Kept side-effect free for unit testing.
 *
 * Rules (lenient phase): `status` required and must be a known value; `id`, when
 * present, must be unique across notes.
 */
export function validateExperiments(notes: ValidatedNote[]): string[] {
  const errors: string[] = [];
  const idOwners = new Map<string, string[]>();

  for (const note of notes) {
    if (readStringField(note.frontMatter, 'experiment_type') !== 'labnote') continue;

    const status = readStringField(note.frontMatter, 'status');
    if (!status) {
      errors.push(`${note.path}: missing required \`status\` front-matter.`);
    } else if (!isValidStatus(status)) {
      errors.push(
        `${note.path}: invalid \`status: ${status}\` ` +
          `(allowed: ${EXPERIMENT_STATUSES.join(', ')}).`
      );
    }

    const id = readStringField(note.frontMatter, 'id');
    if (id) {
      const owners = idOwners.get(id) ?? [];
      owners.push(note.path);
      idOwners.set(id, owners);
    }
  }

  for (const [id, owners] of idOwners) {
    if (owners.length > 1) {
      errors.push(`Duplicate \`id: ${id}\` used by: ${owners.join(', ')}.`);
    }
  }

  return errors;
}

const IGNORED_DIRS = new Set(['.git', 'node_modules']);

/** Recursively collect every `README.labnote.md` under `labnote/`. */
function findReadmes(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = `${dir}/${entry.name}`;
      if (entry.isDirectory()) {
        if (IGNORED_DIRS.has(entry.name)) continue;
        walk(full);
      } else if (entry.isFile() && entry.name === README_NAME) {
        out.push(full);
      }
    }
  };
  walk(root);
  return out;
}

/** Load and parse every experiment README under `labnote/`. */
function loadNotes(): ValidatedNote[] {
  let hasLabnote = true;
  try {
    if (!statSync('labnote').isDirectory()) hasLabnote = false;
  } catch {
    hasLabnote = false;
  }
  if (!hasLabnote) return [];

  return findReadmes('labnote').map(path => {
    let frontMatter: Record<string, unknown> = {};
    try {
      const raw = readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
      frontMatter = parseFrontMatterYaml(raw).frontMatter;
    } catch {
      // Unreadable file: surfaced as a missing-status error downstream.
    }
    return { path, frontMatter };
  });
}

/** Run all checks. Returns the process exit code (0 = ok, 1 = failures). */
export function run(): number {
  const notes = loadNotes();
  const errors = validateExperiments(notes);

  for (const err of errors) {
    console.error(`❌ ${err}`);
  }

  // Central re-run of the large-file guard (same module the hook uses).
  const largeFileCode = runLargeFileCheck([]);

  if (errors.length === 0 && largeFileCode === 0) {
    console.log(`✅ validate: ${notes.length}개 노트 검증 통과.`);
    return 0;
  }
  if (errors.length > 0) {
    console.error(`\n${errors.length}개 검증 오류가 있습니다. 위 메시지를 확인하세요.`);
  }
  return errors.length > 0 || largeFileCode !== 0 ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(run());
}

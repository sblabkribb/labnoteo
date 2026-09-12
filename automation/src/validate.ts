/**
 * validate — deterministic server-side check for a research vault (Phase 3).
 *
 * Scans every `labnote/**\/README.labnote.md`, and for notes with
 * `experiment_type: labnote` verifies:
 *   - `status` is one of the controlled `EXPERIMENT_STATUSES` (required),
 *   - `id` values are unique across experiments (duplicate → error),
 *   - `@issue` markers parse and their IDs are unique within the note,
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
import { parseFrontMatterYaml, parseIssueMarkers } from '@labnoteo/core';
import { run as runLargeFileCheck } from './check-large-files';
import { README_NAME, readStringField } from './lib/experiments';

/** One parsed note handed to the pure validator. */
export interface ValidatedNote {
  /** Repo-relative POSIX path to the README. */
  path: string;
  frontMatter: Record<string, unknown>;
  /** Body (front matter stripped); scanned for `@issue` markers. */
  body: string;
  /** Lines dropped ahead of `body`, so errors can cite the line in the FILE. */
  bodyLineOffset: number;
}

/**
 * Pure validation of the experiment notes. Returns a list of human-readable
 * error strings (empty = valid). Kept side-effect free for unit testing.
 *
 * Rules (lenient phase): `status` required and must be a known value; `id`, when
 * present, must be unique across notes; `@issue` markers must be well formed
 * and their IDs unique within a note.
 *
 * Markers are checked strictly because the failure is otherwise silent — a
 * mistyped marker opens no issue and says nothing, so a discussion the
 * researcher believed they had raised is simply lost. Failing here costs a red
 * check (the pre-commit hook only guards file size, so the push still lands).
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

    errors.push(...validateMarkers(note));
  }

  for (const [id, owners] of idOwners) {
    if (owners.length > 1) {
      errors.push(`Duplicate \`id: ${id}\` used by: ${owners.join(', ')}.`);
    }
  }

  return errors;
}

/**
 * Errors for one note's `@issue` markers: malformed ones, and IDs reused within
 * the note (which would collapse two discussions into one issue).
 *
 * Line numbers are translated to FILE lines so the message points where the
 * editor does.
 */
function validateMarkers(note: ValidatedNote): string[] {
  const errors: string[] = [];
  const { markers, malformed } = parseIssueMarkers(note.body);

  for (const bad of malformed) {
    const detail =
      bad.reason === 'missing-id'
        ? 'missing marker ID'
        : 'missing topic sentence';
    errors.push(
      `${note.path}:${bad.line + note.bodyLineOffset}: malformed \`@issue\` marker ` +
        `(${detail}). Expected \`@issue;<ID>;<topic>\` — use the ` +
        `"Insert issue marker" command so the ID is generated for you. Got: ${bad.text}`
    );
  }

  const seen = new Map<string, number>();
  for (const marker of markers) {
    const first = seen.get(marker.id);
    if (first !== undefined) {
      errors.push(
        `${note.path}:${marker.line + note.bodyLineOffset}: duplicate marker ID ` +
          `\`${marker.id}\` (already used on line ${first + note.bodyLineOffset}).`
      );
    } else {
      seen.set(marker.id, marker.line);
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
    let body = '';
    let bodyLineOffset = 0;
    try {
      const raw = readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
      const parsed = parseFrontMatterYaml(raw);
      frontMatter = parsed.frontMatter;
      body = parsed.body;
      // `body` is a suffix of `raw`, so the line delta is exactly what was dropped.
      bodyLineOffset = raw.split('\n').length - body.split('\n').length;
    } catch {
      // Unreadable file: surfaced as a missing-status error downstream.
    }
    return { path, frontMatter, body, bodyLineOffset };
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

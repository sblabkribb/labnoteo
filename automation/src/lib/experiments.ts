/**
 * Deterministic experiment-context gathering shared by the vault automation
 * scripts (issue-sync, issue-gate, wiki-propose).
 *
 * Everything here is deterministic — no AI. The identifier, title and Objective
 * are derived by pure rules from the note itself so the automation never invents
 * content. The heavy lifting (front-matter parse, path scoping) is delegated to
 * `@labnoteo/core`, so these scripts stay in lock-step with the plugin runtime
 * (the no-drift guarantee — do NOT re-implement those primitives here).
 *
 * Zero runtime deps: only node built-ins + the inlined `@labnoteo/core`.
 */
import { existsSync, readFileSync } from 'node:fs';
import { getExperimentDir } from '@labnoteo/core/lib/labnoteStructure';
import { parseFrontMatterYaml } from '@labnoteo/core';

/** File name of the single-source-of-truth note inside each experiment folder. */
export const README_NAME = 'README.labnote.md';

/** Heading of the Objective section extracted deterministically for issues. */
export const OBJECTIVE_HEADING = '🎯 Experiment Objective';

/**
 * Default placeholder body seeded by `generateReadmeContent`. When the Objective
 * section still holds this, there is no real objective yet, so it is omitted.
 */
export const OBJECTIVE_PLACEHOLDER =
  'Briefly describe the main objective and hypothesis of this experiment.';

/** A parsed experiment note (README front-matter + body + location). */
export interface ExperimentNote {
  /** `labnote/###_Name` folder (POSIX) that owns the note. */
  dir: string;
  /** Folder base name, e.g. `001_PCR_Optimization`. */
  folderName: string;
  /** Parsed README front-matter. */
  frontMatter: Record<string, unknown>;
  /** README body (front-matter stripped). */
  body: string;
}

/** Read a front-matter string field, trimmed; undefined when absent/blank. */
export function readStringField(
  frontMatter: Record<string, unknown>,
  key: string
): string | undefined {
  const raw = frontMatter[key];
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  return trimmed === '' ? undefined : trimmed;
}

/**
 * Base name of an experiment folder path (`labnote/001_Foo` → `001_Foo`).
 * Pure string logic; tolerant of a trailing slash.
 */
export function experimentFolderName(dir: string): string {
  const parts = dir.replace(/\/+$/, '').split('/');
  return parts[parts.length - 1] ?? dir;
}

/**
 * The automation identifier for an experiment: the front-matter `id` when set
 * (e.g. `EXP-001`), otherwise the folder name `###_Name`. This is the stable
 * link key between a note, its Issue and the Wiki — NOT the Issue number.
 */
export function deriveIdentifier(
  frontMatter: Record<string, unknown>,
  folderName: string
): string {
  return readStringField(frontMatter, 'id') ?? folderName;
}

/**
 * Issue title `[identifier] <note title>`. Falls back to the identifier as the
 * title text when the note has no `title` front-matter.
 */
export function deriveIssueTitle(
  identifier: string,
  frontMatter: Record<string, unknown>
): string {
  const title = readStringField(frontMatter, 'title') ?? identifier;
  return `[${identifier}] ${title}`;
}

/**
 * Body of the first Markdown section whose heading text equals `heading`
 * (matched at any `#`..`######` level), trimmed. Returns undefined when the
 * heading is absent. Pure; mirrors the boundary rule of core `replaceSectionBody`
 * (section runs until the next heading of the same or higher level). Blockquote
 * markers (`>`) are stripped so a placeholder/objective reads as plain prose.
 */
export function getSectionBody(md: string, heading: string): string | undefined {
  const lines = md.split(/\r?\n/);
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const headingRe = new RegExp(`^(#{1,6})\\s+${escaped}\\s*$`);
  let start = -1;
  let level = 0;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(headingRe);
    if (m) {
      start = i + 1;
      level = m[1].length;
      break;
    }
  }
  if (start === -1) return undefined;

  const boundary = new RegExp(`^#{1,${level}}\\s`);
  let end = lines.length;
  for (let i = start; i < lines.length; i++) {
    if (boundary.test(lines[i])) {
      end = i;
      break;
    }
  }

  const body = lines
    .slice(start, end)
    .map(line => line.replace(/^\s*>\s?/, '').trimEnd())
    .join('\n')
    .trim();
  return body;
}

/**
 * Deterministically extract the experiment Objective from the README body.
 * Returns undefined when the section is missing, empty, or still the seeded
 * placeholder (so issues omit a meaningless objective). NEVER uses AI.
 */
export function extractObjective(body: string): string | undefined {
  const section = getSectionBody(body, OBJECTIVE_HEADING);
  if (!section) return undefined;
  const normalized = section.replace(/\s+/g, ' ').trim();
  if (normalized === '' || normalized === OBJECTIVE_PLACEHOLDER) return undefined;
  return section;
}

/**
 * Group a list of changed files into the unique set of `labnote/###_Name`
 * experiment folders they belong to (via core `getExperimentDir`). Files outside
 * any experiment (or non-`###_` folders) are ignored. Order is deterministic
 * (sorted) so downstream output is stable.
 */
export function groupChangedExperiments(changedFiles: string[]): string[] {
  const dirs = new Set<string>();
  for (const file of changedFiles) {
    const dir = getExperimentDir(file);
    if (dir) dirs.add(dir);
  }
  return [...dirs].sort();
}

/** A deterministic issue payload derived from an experiment note. */
export interface ExperimentIssue {
  identifier: string;
  title: string;
  body: string;
  labels: string[];
}

/**
 * Build the deterministic Issue payload for an experiment (shared by the 4a
 * deterministic path and the 4b AI-gated path so both create identical issues).
 *
 * Body = note link + deterministically extracted Objective (omitted when it is
 * the placeholder) + status + an empty Discussion prompt. NEVER a full copy of
 * the note. Labels = `experiment` plus `status:<status>` when a status is set.
 */
export function buildExperimentIssue(note: ExperimentNote): ExperimentIssue {
  const identifier = deriveIdentifier(note.frontMatter, note.folderName);
  const title = deriveIssueTitle(identifier, note.frontMatter);
  const status = readStringField(note.frontMatter, 'status');
  const objective = extractObjective(note.body);

  const labels = ['experiment'];
  if (status) labels.push(`status:${status}`);

  const lines: string[] = [
    `**Experiment:** \`${identifier}\``,
    `**Note:** \`${note.dir}/${README_NAME}\``,
    `**Status:** ${status ?? '(unset)'}`,
    '',
    '## 🎯 Objective',
    objective ?? '_No objective recorded in the note yet._',
    '',
    '## 💬 Discussion',
    '_Use this issue to discuss this experiment. The linked note remains the source of truth._',
  ];

  return { identifier, title, body: lines.join('\n'), labels };
}

/**
 * Read and parse an experiment's README. Returns undefined when the README is
 * missing or is not an `experiment_type: labnote` note (so non-experiments and
 * partial folders are skipped). Uses node fs; the pure parsing is delegated to
 * core `parseFrontMatterYaml`.
 */
export function readExperimentNote(dir: string): ExperimentNote | undefined {
  const readmePath = `${dir}/${README_NAME}`;
  if (!existsSync(readmePath)) return undefined;
  let raw: string;
  try {
    raw = readFileSync(readmePath, 'utf8').replace(/\r\n/g, '\n');
  } catch {
    return undefined;
  }
  const { frontMatter, body } = parseFrontMatterYaml(raw);
  if (readStringField(frontMatter, 'experiment_type') !== 'labnote') return undefined;
  return { dir, folderName: experimentFolderName(dir), frontMatter, body };
}

/**
 * issue-sync — deterministic Experiment ↔ Issue automation (Phase 4a).
 *
 * On a `labnote/**` push it groups the changed files into experiment folders,
 * reads each `README.labnote.md`, and promotes ONLY experiments whose
 * front-matter carries an explicit signal — `discuss: true` OR
 * `status: needs-review` (no free-text scan → no false positives). For each it
 * ensures a `[identifier]` issue exists (idempotent), labelled `experiment` and
 * `status:*`. Title + Objective are extracted DETERMINISTICALLY (never AI).
 *
 * GitHub is reached with `fetch` + `GITHUB_TOKEN` (REST) — NOT `gh` — so the 4b
 * self-hosted path reuses the exact same code. Issue numbers are NOT written
 * back into notes (loop/merge-conflict avoidance).
 *
 * Zero runtime deps: node built-ins + inlined `@labnoteo/core`.
 */
import { pathToFileURL } from 'node:url';
import { isDiscussFlagged } from '@labnoteo/core';
import { getChangedFiles } from './lib/git';
import {
  buildExperimentIssue,
  groupChangedExperiments,
  readExperimentNote,
  readStringField,
  type ExperimentNote,
} from './lib/experiments';
import { currentRepo, ensureIssue } from './lib/github';

/**
 * Whether an experiment carries an explicit "please open an issue" signal.
 * Pure: the `discuss` flag OR `status: needs-review`. Nothing else —
 * deliberately no free-text scanning, so a passing mention of "논의" in a note
 * cannot open an issue. Judging free text is the local AI agent's job
 * (AGENTS.md Playbook A); it sets the flag, and this script acts on it.
 *
 * The flag predicate comes from `@labnoteo/core` so the plugin's toggle command
 * and this script can never disagree about what counts as flagged.
 */
export function shouldPromote(frontMatter: Record<string, unknown>): boolean {
  const status = readStringField(frontMatter, 'status');
  return isDiscussFlagged(frontMatter) || status === 'needs-review';
}

/** The experiments a push should promote to issues (pure selection step). */
export function selectPromotable(notes: ExperimentNote[]): ExperimentNote[] {
  return notes.filter(note => shouldPromote(note.frontMatter));
}

/** Run the sync. Returns the process exit code (0 = ok, 1 = an issue failed). */
export async function run(): Promise<number> {
  const dirs = groupChangedExperiments(getChangedFiles());
  const notes = dirs
    .map(dir => readExperimentNote(dir))
    .filter((n): n is ExperimentNote => n !== undefined);
  const promotable = selectPromotable(notes);

  if (promotable.length === 0) {
    console.log('issue-sync: 승격할 실험이 없습니다 (discuss/needs-review 신호 없음).');
    return 0;
  }

  const repo = currentRepo();
  let failed = 0;

  for (const note of promotable) {
    const payload = buildExperimentIssue(note);
    try {
      const { issue, created } = await ensureIssue(repo, payload.identifier, {
        title: payload.title,
        body: payload.body,
        labels: payload.labels,
      });
      console.log(
        `${created ? '🆕 생성' : '↺ 존재'}: [${payload.identifier}] → #${issue.number} ${issue.html_url}`
      );
    } catch (err) {
      failed += 1;
      console.error(`❌ [${payload.identifier}] 이슈 처리 실패: ${(err as Error).message}`);
    }
  }

  return failed > 0 ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().then(code => process.exit(code));
}

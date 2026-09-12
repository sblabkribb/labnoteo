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
 * It ALSO promotes every `@issue;ID;topic` marker in the note to its own
 * `[identifier/ID]` issue. A marker is an explicit token, not prose, so acting
 * on it does not reintroduce the false positives that free-text scanning had.
 * The two kinds differ in one way that matters: the experiment thread is
 * reopened when closed, a resolved marker issue is left closed.
 *
 * GitHub is reached with `fetch` + `GITHUB_TOKEN` (REST) — NOT `gh` — so the 4b
 * self-hosted path reuses the exact same code. Issue numbers are NOT written
 * back into notes (loop/merge-conflict avoidance).
 *
 * Zero runtime deps: node built-ins + inlined `@labnoteo/core`.
 */
import { pathToFileURL } from 'node:url';
import { isDiscussFlagged, parseIssueMarkers } from '@labnoteo/core';
import { getChangedFiles } from './lib/git';
import {
  buildDiscussionIssue,
  buildExperimentIssue,
  groupChangedExperiments,
  readExperimentNote,
  readStringField,
  type ExperimentIssue,
  type ExperimentNote,
} from './lib/experiments';
import { currentRepo, ensureIssue, type EnsureIssueOptions } from './lib/github';

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
  const scans = notes.map(note => ({ note, scan: parseIssueMarkers(note.body) }));
  const markerCount = scans.reduce((n, s) => n + s.scan.markers.length, 0);

  // Broken markers are reported but never guessed at: `validate` fails the run
  // with the same information, so this is a nudge, not the gate.
  for (const { note, scan } of scans) {
    for (const bad of scan.malformed) {
      console.warn(
        `⚠️  ${note.dir}/README.labnote.md:${bad.line + note.bodyLineOffset} ` +
          `마커 형식 오류(${bad.reason}): ${bad.text}`
      );
    }
  }

  if (promotable.length === 0 && markerCount === 0) {
    console.log('issue-sync: 승격할 실험이 없습니다 (discuss/needs-review 신호, @issue 마커 없음).');
    return 0;
  }

  const repo = currentRepo();
  const sha = process.env.GITHUB_SHA?.trim() || undefined;
  let failed = 0;

  /** Create/find one issue and log what happened; returns true on failure. */
  const sync = async (payload: ExperimentIssue, options: EnsureIssueOptions): Promise<boolean> => {
    try {
      const { issue, created, reopened } = await ensureIssue(
        repo,
        payload.identifier,
        { title: payload.title, body: payload.body, labels: payload.labels },
        options
      );
      const verb = created ? '🆕 생성' : reopened ? '♻️ 재오픈' : '↺ 존재';
      console.log(`${verb}: [${payload.identifier}] → #${issue.number} ${issue.html_url}`);
      return false;
    } catch (err) {
      console.error(`❌ [${payload.identifier}] 이슈 처리 실패: ${(err as Error).message}`);
      return true;
    }
  };

  // An experiment thread is long-lived: re-raising `discuss` after the thread
  // was closed must revive it, otherwise the experiment can never be discussed
  // a second time.
  for (const note of promotable) {
    const payload = buildExperimentIssue(note);
    const bad = await sync(payload, {
      reopenClosed: true,
      reopenComment:
        '논의가 다시 요청되어 이슈를 재오픈했습니다' +
        `${sha ? ` (커밋 \`${sha.slice(0, 7)}\`)` : ''}.`,
    });
    if (bad) failed += 1;
  }

  // A marker issue is one resolved question. Its marker stays in the note as a
  // record, so a closed issue must stay closed — no `reopenClosed` here.
  for (const { note, scan } of scans) {
    for (const marker of scan.markers) {
      const bad = await sync(buildDiscussionIssue(note, marker, repo, sha), {});
      if (bad) failed += 1;
    }
  }

  return failed > 0 ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().then(code => process.exit(code));
}

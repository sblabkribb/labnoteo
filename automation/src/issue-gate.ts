/**
 * issue-gate — AI context gate for experiment issues (Phase 4b).
 *
 * Two stages, cheapest first:
 *   1. A pure keyword prefilter over every `*.labnote.md` in each changed
 *      experiment folder (`이슈` / `논의 필요` / `논의필요` / `discuss`; bare
 *      `질문` is intentionally NOT a trigger — too noisy). No match → skip.
 *   2. Only the flagged experiments are sent to a self-hosted LOCAL LLM with a
 *      fixed prompt, which must reply with structured JSON
 *      `{ "needs_issue": boolean, "reason": string }`. On `true` we reuse the
 *      SAME deterministic issue-creation path as Phase 4a — title and Objective
 *      remain deterministic; the LLM only decides *whether* to open an issue.
 *
 * Prompt/schema are read from the vault's version-controlled `ai/` folder (single
 * source). Zero runtime deps: node built-ins + inlined `@labnoteo/core`.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import {
  buildExperimentIssue,
  groupChangedExperiments,
  readExperimentNote,
  type ExperimentNote,
} from './lib/experiments';
import { currentRepo, ensureIssue } from './lib/github';
import { chatJson, chatOptionsFromEnv, type ChatClientOptions } from './lib/chat';
import { getChangedFiles } from './lib/git';

/** Keyword tokens that flag an experiment for the AI gate (bare `질문` excluded). */
export const ISSUE_KEYWORDS = ['이슈', '논의 필요', '논의필요', 'discuss'] as const;

/**
 * Pure prefilter: does `text` contain any issue keyword? Case-insensitive for
 * the ASCII token. Deliberately excludes the bare `질문` token (false-positive
 * heavy). Kept side-effect free for unit testing.
 */
export function matchesIssueKeywords(text: string): boolean {
  const lower = text.toLowerCase();
  return ISSUE_KEYWORDS.some(tok => lower.includes(tok.toLowerCase()));
}

/** The structured verdict the local LLM must return. */
export interface GateVerdict {
  needs_issue: boolean;
  reason: string;
}

/** Narrow an unknown parsed reply to a {@link GateVerdict}. Pure/testable. */
export function parseVerdict(value: unknown): GateVerdict | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const v = value as Record<string, unknown>;
  if (typeof v.needs_issue !== 'boolean') return undefined;
  return { needs_issue: v.needs_issue, reason: typeof v.reason === 'string' ? v.reason : '' };
}

const IGNORED_DIRS = new Set(['.git', 'node_modules']);

/** Concatenate every `*.labnote.md` under an experiment folder (recursive). */
function readExperimentText(dir: string): string {
  const chunks: string[] = [];
  const walk = (d: string): void => {
    let entries;
    try {
      entries = readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = `${d}/${entry.name}`;
      if (entry.isDirectory()) {
        if (IGNORED_DIRS.has(entry.name)) continue;
        walk(full);
      } else if (entry.isFile() && entry.name.endsWith('.labnote.md')) {
        try {
          chunks.push(readFileSync(full, 'utf8'));
        } catch {
          // skip unreadable file
        }
      }
    }
  };
  walk(dir);
  return chunks.join('\n\n');
}

/** Read the version-controlled gate prompt from the vault `ai/` folder. */
function loadPrompt(): string {
  return readFileSync('ai/prompts/issue-gate.md', 'utf8');
}

/** Ask the local LLM whether the flagged experiment warrants an issue. */
async function askGate(
  opts: ChatClientOptions,
  prompt: string,
  experimentText: string
): Promise<GateVerdict | undefined> {
  const reply = await chatJson<unknown>(opts, [
    { role: 'system', content: prompt },
    { role: 'user', content: experimentText },
  ]);
  return parseVerdict(reply);
}

/** Run the gate. Returns the process exit code (0 = ok, 1 = a failure). */
export async function run(): Promise<number> {
  const dirs = groupChangedExperiments(getChangedFiles());
  const notes = dirs
    .map(dir => readExperimentNote(dir))
    .filter((n): n is ExperimentNote => n !== undefined);

  const flagged = notes.filter(note => matchesIssueKeywords(readExperimentText(note.dir)));
  if (flagged.length === 0) {
    console.log('issue-gate: 키워드 프리필터 통과 실험 없음 (스킵).');
    return 0;
  }

  const opts = chatOptionsFromEnv();
  const prompt = loadPrompt();
  const repo = currentRepo();
  let failed = 0;

  for (const note of flagged) {
    try {
      const verdict = await askGate(opts, prompt, readExperimentText(note.dir));
      if (!verdict) {
        failed += 1;
        console.error(`❌ [${note.folderName}] LLM 응답 파싱 실패.`);
        continue;
      }
      if (!verdict.needs_issue) {
        console.log(`⏭️  [${note.folderName}] needs_issue=false: ${verdict.reason}`);
        continue;
      }
      const payload = buildExperimentIssue(note);
      const { issue, created } = await ensureIssue(repo, payload.identifier, {
        title: payload.title,
        body: payload.body,
        labels: payload.labels,
      });
      console.log(
        `${created ? '🆕 생성' : '↺ 존재'}: [${payload.identifier}] → #${issue.number} (${verdict.reason})`
      );
    } catch (err) {
      failed += 1;
      console.error(`❌ [${note.folderName}] 게이트 처리 실패: ${(err as Error).message}`);
    }
  }

  return failed > 0 ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().then(code => process.exit(code));
}

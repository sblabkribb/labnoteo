/**
 * Scaffold asset registry — the single list of files the "연구노트 자동화 설정"
 * command provisions into the current vault.
 *
 * Each asset's `content` is imported as a string via esbuild's `text` loader
 * (see `esbuild.config.mjs`), so the built automation `.mjs` and the static
 * templates are embedded directly into `main.js`. That is what makes a 3-file
 * install (main.js / manifest.json / styles.css) self-sufficient: no separate
 * `.mjs` assets need to ship to the plugin folder.
 *
 * Extending in later phases is intentionally trivial: author the source under
 * `automation/` (add script entry points to `AUTOMATION_ENTRYPOINTS` in the
 * esbuild config), import the built string here, and append a `ScaffoldAsset`.
 * For example Phase 3/4/5 will add `scripts/validate.mjs`,
 * `.github/workflows/*.yml`, `ai/prompts/*` entries alongside these.
 */
// Stage-1 build output (dist-automation) — embedded as text.
import checkLargeFilesScript from '../../dist-automation/check-large-files.mjs';
import validateScript from '../../dist-automation/validate.mjs';
import issueSyncScript from '../../dist-automation/issue-sync.mjs';
import issueGateScript from '../../dist-automation/issue-gate.mjs';
import wikiProposeScript from '../../dist-automation/wiki-propose.mjs';
// Static templates — embedded as text.
import gitignoreSnippet from '../../automation/templates/gitignore.snippet';
import preCommitHook from '../../automation/templates/pre-commit.sh';
import setupReadme from '../../automation/templates/SETUP.md';
// Workflow templates (Phase 3–5).
import validateWorkflow from '../../automation/templates/validate.yml';
import experimentIssuesWorkflow from '../../automation/templates/experiment-issues.yml';
import wikiSyncWorkflow from '../../automation/templates/wiki-sync.yml';
// Issue template (Phase 4a).
import experimentIssueTemplate from '../../automation/templates/experiment.md';
// AI prompts + schemas (Phase 4b, 5) — version-controlled single source in `ai/`.
import issueGatePrompt from '../../automation/templates/issue-gate.prompt.md';
import issueGateSchema from '../../automation/templates/issue-gate.schema.jsonc';
import wikiProposePrompt from '../../automation/templates/wiki-propose.prompt.md';
import wikiProposeSchema from '../../automation/templates/wiki-propose.schema.jsonc';
// Living Manuscript Wiki skeleton (Phase 5) — staged proposals live here.
import wikiHome from '../../automation/templates/wiki/Home.md';
import wikiAbstract from '../../automation/templates/wiki/Abstract.md';
import wikiIntroduction from '../../automation/templates/wiki/Introduction.md';
import wikiResearchQuestions from '../../automation/templates/wiki/Research-Questions.md';
import wikiMethods from '../../automation/templates/wiki/Methods.md';
import wikiResults from '../../automation/templates/wiki/Results.md';
import wikiDiscussion from '../../automation/templates/wiki/Discussion.md';
import wikiLimitations from '../../automation/templates/wiki/Limitations.md';
import wikiFutureWork from '../../automation/templates/wiki/Future-Work.md';
import wikiEvidenceIndex from '../../automation/templates/wiki/Evidence-Index.md';
import wikiReferences from '../../automation/templates/wiki/References.md';

/**
 * How to reconcile an asset with a pre-existing vault file:
 *  - `overwrite` (default): replace, but only after the user confirms.
 *  - `append-missing`: keep the file, append only lines it does not already
 *    contain (used for `.gitignore` so user patterns are preserved).
 */
export type ScaffoldMergeStrategy = 'overwrite' | 'append-missing';

/** A single file the scaffold command writes into the vault. */
export interface ScaffoldAsset {
  /** Vault-relative POSIX path (VaultFileSystem creates parent dirs). */
  vaultPath: string;
  /** File contents (embedded string). */
  content: string;
  /** Reconciliation strategy when the file already exists. Default `overwrite`. */
  merge?: ScaffoldMergeStrategy;
}

/** Vault path of the setup guide, surfaced in the completion notice. */
export const SETUP_DOC_PATH = 'SETUP.md';

/**
 * Assets installed by the current phase (Phase 2c: large-file protection).
 * Append new entries here in later phases.
 */
export const SCAFFOLD_ASSETS: ScaffoldAsset[] = [
  // Phase 2c — large-file protection.
  { vaultPath: 'scripts/check-large-files.mjs', content: checkLargeFilesScript },
  { vaultPath: '.githooks/pre-commit', content: preCommitHook },
  { vaultPath: SETUP_DOC_PATH, content: setupReadme },
  { vaultPath: '.gitignore', content: gitignoreSnippet, merge: 'append-missing' },

  // Phase 3 — deterministic validation.
  { vaultPath: 'scripts/validate.mjs', content: validateScript },
  { vaultPath: '.github/workflows/validate.yml', content: validateWorkflow },

  // Phase 4a — deterministic Experiment ↔ Issue.
  { vaultPath: 'scripts/issue-sync.mjs', content: issueSyncScript },
  { vaultPath: '.github/workflows/experiment-issues.yml', content: experimentIssuesWorkflow },
  { vaultPath: '.github/ISSUE_TEMPLATE/experiment.md', content: experimentIssueTemplate },

  // Phase 4b — AI context gate (self-hosted local LLM). Shares experiment-issues.yml.
  { vaultPath: 'scripts/issue-gate.mjs', content: issueGateScript },
  { vaultPath: 'ai/prompts/issue-gate.md', content: issueGatePrompt },
  { vaultPath: 'ai/schemas/issue-gate.schema.json', content: issueGateSchema },

  // Phase 5 — Living Manuscript Wiki.
  { vaultPath: 'scripts/wiki-propose.mjs', content: wikiProposeScript },
  { vaultPath: '.github/workflows/wiki-sync.yml', content: wikiSyncWorkflow },
  { vaultPath: 'ai/prompts/wiki-propose.md', content: wikiProposePrompt },
  { vaultPath: 'ai/schemas/wiki-propose.schema.json', content: wikiProposeSchema },
  { vaultPath: 'wiki-staging/Home.md', content: wikiHome },
  { vaultPath: 'wiki-staging/Abstract.md', content: wikiAbstract },
  { vaultPath: 'wiki-staging/Introduction.md', content: wikiIntroduction },
  { vaultPath: 'wiki-staging/Research-Questions.md', content: wikiResearchQuestions },
  { vaultPath: 'wiki-staging/Methods.md', content: wikiMethods },
  { vaultPath: 'wiki-staging/Results.md', content: wikiResults },
  { vaultPath: 'wiki-staging/Discussion.md', content: wikiDiscussion },
  { vaultPath: 'wiki-staging/Limitations.md', content: wikiLimitations },
  { vaultPath: 'wiki-staging/Future-Work.md', content: wikiFutureWork },
  { vaultPath: 'wiki-staging/Evidence-Index.md', content: wikiEvidenceIndex },
  { vaultPath: 'wiki-staging/References.md', content: wikiReferences },
];

/**
 * Pure planner for the "Renumber Workflows" command (issue #38 follow-up, C option).
 *
 * Given the current README checklist order and the workflow files present on
 * disk, compute the file renames and the renumbered checklist items needed to
 * make the `NNN` sequence prefixes match the visual list order (1..N). The
 * planner never touches the filesystem — the caller sequences the renames and
 * the README rewrite. Any inconsistency (unknown file name, listed-but-missing
 * file, or an on-disk workflow file absent from the checklist) aborts with a
 * discriminated error code so nothing is renamed on a dubious state.
 */
import { parseWorkflowFileName, type WorkflowChecklistItem } from './workflowStructure';

export type RenumberErrorCode =
  | 'no_items'
  | 'invalid_filename'
  | 'missing_files'
  | 'orphan_files';

export interface RenumberError {
  code: RenumberErrorCode;
  details?: string[];
}

export interface RenumberRename {
  oldFileName: string;
  newFileName: string;
}

export interface RenumberPlan {
  renames: RenumberRename[];
  newItems: WorkflowChecklistItem[];
  changed: boolean;
}

export type RenumberResult = RenumberPlan | { error: RenumberError };

export interface PlanRenumberWorkflowsArgs {
  /** Checklist items in README order (target order). */
  items: WorkflowChecklistItem[];
  /** Basenames of workflow files present in the labnote folder. */
  diskWorkflowFiles: string[];
}

export function planRenumberWorkflows(args: PlanRenumberWorkflowsArgs): RenumberResult {
  const { items, diskWorkflowFiles } = args;

  if (items.length === 0) {
    return { error: { code: 'no_items' } };
  }

  const invalid = items.filter(it => parseWorkflowFileName(it.fileName) === null);
  if (invalid.length > 0) {
    return { error: { code: 'invalid_filename', details: invalid.map(it => it.fileName) } };
  }

  const diskSet = new Set(diskWorkflowFiles);
  const missing = items.filter(it => !diskSet.has(it.fileName));
  if (missing.length > 0) {
    return { error: { code: 'missing_files', details: missing.map(it => it.fileName) } };
  }

  const listed = new Set(items.map(it => it.fileName));
  const orphan = diskWorkflowFiles.filter(
    file => parseWorkflowFileName(file) !== null && !listed.has(file)
  );
  if (orphan.length > 0) {
    return { error: { code: 'orphan_files', details: orphan } };
  }

  const renames: RenumberRename[] = [];
  const newItems: WorkflowChecklistItem[] = items.map((it, index) => {
    const parsed = parseWorkflowFileName(it.fileName)!;
    const targetSeq = String(index + 1).padStart(3, '0');
    const newFileName = `${targetSeq}_${parsed.id}_${parsed.safeName}.labnote.md`;
    if (newFileName !== it.fileName) {
      renames.push({ oldFileName: it.fileName, newFileName });
    }
    return { ...it, fileName: newFileName, title: renumberTitle(it.title, targetSeq) };
  });

  return { renames, newItems, changed: renames.length > 0 };
}

/**
 * Replace the leading 3-digit sequence in a checklist title with `targetSeq`.
 * Titles produced by the extension have the form `NNN <id> <name>`; a `_`
 * separator is tolerated defensively. When no leading sequence is present the
 * target number is prepended.
 */
function renumberTitle(title: string, targetSeq: string): string {
  if (/^\d{3}(?=[ _])/.test(title)) {
    return title.replace(/^\d{3}/, targetSeq);
  }
  return `${targetSeq} ${title}`;
}

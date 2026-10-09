/**
 * Tidy a workflow note after an Outline drag, at the file level.
 *
 * Obsidian's Outline view moves a section by rewriting the file
 * (`vault.read` → splice → `vault.modify`), not through the editor. Tidying it
 * in the editor would leave the file — and the cached heading positions the
 * Outline navigates by — out of step, so the TOC/separator cleanup is written
 * back to the file with `vault.process` instead.
 *
 * Only the first `modify` after a drop on the Outline pane is handled (the path
 * is "armed" by the drop), so editor saves, git pulls, other plugins' writes
 * and the save that follows an undo are left alone.
 *
 * With a snapshot of the drag, the same write also undoes the Outline's nesting
 * side effect (a block dropped onto a unit op splitting it from its `####`
 * subsections, see `fixOutlineDropNesting`). That repair runs regardless of the
 * TOC setting; the TOC/separator tidy still follows it.
 */
import {
  applyTextEdits,
  computeUnitOpSyncEdits,
  fixOutlineDropNesting,
  type OutlineHeading,
} from '@labnoteo/core';
import { isValidWorkflowPath } from '@labnoteo/core/lib/workflowStructure';

/** The drop handler reads and writes the file right away; this only bounds a no-op drop. */
export const OUTLINE_DROP_ARM_MS = 3000;

export interface OutlineDropTidyDeps {
  isEnabled: () => boolean;
  now: () => number;
  /** Rewrite the file; `vault.process` skips the write when `fn` returns its input. */
  process: (path: string, fn: (data: string) => string) => Promise<void>;
}

/** The dragged heading, captured at drop time before the Outline rewrites the file. */
export interface OutlineDropSnapshot {
  /** The file text the Outline is about to splice. */
  before: Promise<string>;
  headings: OutlineHeading[];
  movedIdx: number;
}

export interface OutlineDropTidy {
  arm(path: string, drop?: OutlineDropSnapshot): void;
  onModify(path: string): Promise<void>;
}

export function tidyReorderedWorkflow(data: string): string {
  return applyTextEdits(data, computeUnitOpSyncEdits(data, { onlyOnReorder: true }));
}

export function createOutlineDropTidy(deps: OutlineDropTidyDeps): OutlineDropTidy {
  const armed = new Map<string, { until: number; drop?: OutlineDropSnapshot }>();
  return {
    arm(path, drop) {
      // A no-op drop never reaches `onModify`, so the read may go unobserved.
      drop?.before.catch(() => undefined);
      armed.set(path, { until: deps.now() + OUTLINE_DROP_ARM_MS, drop });
    },
    async onModify(path) {
      const entry = armed.get(path);
      if (entry === undefined) return;
      armed.delete(path);
      if (deps.now() > entry.until || !isValidWorkflowPath(path)) return;
      const tidyOn = deps.isEnabled();
      const { drop } = entry;
      if (!drop && !tidyOn) return;
      const before = drop ? await drop.before.catch(() => null) : null;
      await deps.process(path, data => {
        const moved =
          drop && before !== null
            ? (fixOutlineDropNesting(before, data, drop.headings, drop.movedIdx) ?? data)
            : data;
        return tidyOn ? tidyReorderedWorkflow(moved) : moved;
      });
    },
  };
}

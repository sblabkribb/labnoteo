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
 */
import { applyTextEdits, computeUnitOpSyncEdits } from '@labnoteo/core';
import { isValidWorkflowPath } from '@labnoteo/core/lib/workflowStructure';

/** The drop handler reads and writes the file right away; this only bounds a no-op drop. */
export const OUTLINE_DROP_ARM_MS = 3000;

export interface OutlineDropTidyDeps {
  isEnabled: () => boolean;
  now: () => number;
  /** Rewrite the file; `vault.process` skips the write when `fn` returns its input. */
  process: (path: string, fn: (data: string) => string) => Promise<void>;
}

export interface OutlineDropTidy {
  arm(path: string): void;
  onModify(path: string): Promise<void>;
}

export function tidyReorderedWorkflow(data: string): string {
  return applyTextEdits(data, computeUnitOpSyncEdits(data, { onlyOnReorder: true }));
}

export function createOutlineDropTidy(deps: OutlineDropTidyDeps): OutlineDropTidy {
  const armedUntil = new Map<string, number>();
  return {
    arm(path) {
      armedUntil.set(path, deps.now() + OUTLINE_DROP_ARM_MS);
    },
    async onModify(path) {
      const until = armedUntil.get(path);
      if (until === undefined) return;
      armedUntil.delete(path);
      if (deps.now() > until || !deps.isEnabled() || !isValidWorkflowPath(path)) return;
      await deps.process(path, tidyReorderedWorkflow);
    },
  };
}

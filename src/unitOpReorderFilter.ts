/**
 * Tidy a workflow note in the SAME transaction that reorders its unit-op
 * blocks (e.g. an Outline drag): the `## Related Unit Operations` TOC is
 * re-ordered and the `---` separators restored, so the move and the cleanup are
 * one undo step with no intermediate state.
 *
 * Only reorders are handled here (`onlyOnReorder`); added, removed or renamed
 * headings are left to the debounced TOC sync in `main.ts`. The pure edit
 * computation lives in `@labnoteo/core` and is unit-tested there.
 *
 * An Outline drag is NOT an editor edit: Obsidian rewrites the file and mirrors
 * it into the editor as a `set` transaction. Changing that transaction would
 * leave the editor out of step with the file (and the heading positions the
 * Outline navigates by), so `set` is skipped and `outlineDropTidy` tidies the
 * file itself.
 */
import { EditorState, type Extension, type Transaction } from '@codemirror/state';
import { computeUnitOpSyncEdits } from '@labnoteo/core';
import { isValidWorkflowPath } from '@labnoteo/core/lib/workflowStructure';

const UNIT_OP_HEADING_MARK = '### [';

export interface UnitOpReorderFilterOptions {
  /** Read live so toggling the setting takes effect without a reload. */
  isEnabled: () => boolean;
  /** Vault path of the note being edited, or null (canvas embeds, hover previews, …). */
  getFilePath: (state: EditorState) => string | null;
  /** Called for every document change of a file-backed editor, before any skip. */
  onDocChange?: (path: string, fromHistory: boolean) => void;
}

/** Cheap pre-check: a block move always inserts or deletes a `### [` heading. */
function touchesUnitOpHeading(tr: Transaction): boolean {
  let hit = false;
  tr.changes.iterChanges((fromA, toA, _fromB, _toB, inserted) => {
    if (hit) return;
    hit =
      inserted.toString().includes(UNIT_OP_HEADING_MARK) ||
      tr.startState.doc.sliceString(fromA, toA).includes(UNIT_OP_HEADING_MARK);
  });
  return hit;
}

export function createUnitOpReorderFilter(opts: UnitOpReorderFilterOptions): Extension {
  return EditorState.transactionFilter.of(tr => {
    try {
      if (!tr.docChanged) return tr;
      const path = opts.getFilePath(tr.startState);
      const fromHistory = tr.isUserEvent('undo') || tr.isUserEvent('redo');
      if (path) opts.onDocChange?.(path, fromHistory);
      if (!opts.isEnabled()) return tr;
      // Never interfere with IME composition or file reloads (`set`). Undo/redo
      // already restore a tidy document, because the move and its cleanup were
      // recorded together.
      if (tr.isUserEvent('input.type.compose') || tr.isUserEvent('set') || fromHistory) return tr;
      if (!path || !isValidWorkflowPath(path)) return tr;
      if (!touchesUnitOpHeading(tr)) return tr;

      // CodeMirror documents are `\n`-only, so string offsets map 1:1 to positions.
      const edits = computeUnitOpSyncEdits(tr.newDoc.toString(), { onlyOnReorder: true });
      if (edits.length === 0) return tr;
      return [tr, { changes: edits, sequential: true }];
    } catch (err) {
      console.warn('[labnoteo] unit-op reorder sync failed:', err);
      return tr;
    }
  });
}

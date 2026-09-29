/**
 * Tidy a workflow note in the SAME transaction that reorders its unit-op
 * blocks (e.g. an Outline drag): the `## Related Unit Operations` TOC is
 * re-ordered and the `---` separators restored, so the move and the cleanup are
 * one undo step with no intermediate state.
 *
 * Only reorders are handled here (`onlyOnReorder`); added, removed or renamed
 * headings are left to the debounced TOC sync in `main.ts`. The pure edit
 * computation lives in `@labnoteo/core` and is unit-tested there.
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
      if (!tr.docChanged || !opts.isEnabled()) return tr;
      // Never interfere with IME composition. Undo/redo already restore a tidy
      // document, because the move and its cleanup were recorded together.
      if (tr.isUserEvent('input.type.compose') || tr.isUserEvent('undo') || tr.isUserEvent('redo')) {
        return tr;
      }
      const path = opts.getFilePath(tr.startState);
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

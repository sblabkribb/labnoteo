/**
 * Live Preview edits a table cell in its own nested CodeMirror editor, whose
 * text is the cell alone and whose cursor is an offset inside the cell.
 * Commands that insert at the cursor there write into the cell, where Obsidian
 * escapes every newline and `|` as `<br>` and `\|` (#196). These helpers find
 * that cell editor, and send edits that do not belong in a cell to the note
 * itself instead, just below the table.
 */
import { EditorView } from '@codemirror/view';
import type { Editor } from 'obsidian';
import type { EditTarget } from '@labnoteo/core';
import { endsAliasedReference } from '@labnoteo/core';

const isTableRow = (line: string): boolean => line.trimStart().startsWith('|');

/**
 * End offset of the last line of the Markdown table holding `offset` (or of
 * the line itself when it is not a table row).
 */
export function tableBlockEnd(text: string, offset: number): number {
  const lineStart = offset === 0 ? 0 : text.lastIndexOf('\n', offset - 1) + 1;
  let end = text.indexOf('\n', lineStart);
  if (end === -1) end = text.length;
  if (!isTableRow(text.slice(lineStart, end))) return end;
  while (end < text.length) {
    const nextEnd = text.indexOf('\n', end + 1);
    const next = text.slice(end + 1, nextEnd === -1 ? text.length : nextEnd);
    if (!isTableRow(next)) break;
    end = nextEnd === -1 ? text.length : nextEnd;
  }
  return end;
}

/**
 * The editor of the table cell being edited, or null when none is (#303).
 *
 * `MarkdownView.editor` stays on the note even while a cell is focused: only
 * the cell component holds an editor over the cell text. Obsidian reaches it
 * the same way for its own table commands, but neither the component nor its
 * `tableCell` is in the public API, so both are read defensively.
 */
export function activeTableCellEditor(editor: Editor): Editor | null {
  const component = (editor as unknown as { editorComponent?: { tableCell?: { editor?: Editor } } })
    .editorComponent;
  return component?.tableCell?.editor ?? null;
}

/** The CodeMirror view behind an editor, which Obsidian keeps out of its API. */
export function editorView(editor: Editor): EditorView | undefined {
  return (editor as unknown as { cm?: EditorView }).cm;
}

/** The note's own editor when `editor` is a table cell editor nested inside it. */
export function tableCellHostView(editor: Editor): EditorView | null {
  const cm = editorView(editor);
  const outer = cm?.dom?.parentElement?.closest('.cm-editor');
  if (!cm || !outer || !(outer instanceof HTMLElement)) return null;
  return EditorView.findFromDOM(outer);
}

/**
 * Write text that fits in a table cell into the focused cell's own editor.
 * Only the cell text is there, so a reference whose alias is read up to
 * whitespace needs a space before it (#464, #479).
 */
export function writeIntoCell(cell: Editor, text: string, types: readonly string[]): void {
  const from = cell.getCursor('from');
  const lineBefore = cell.getValue().split('\n')[from.line]?.slice(0, from.ch) ?? '';
  cell.replaceSelection(endsAliasedReference(lineBefore, types) ? ` ${text}` : text);
}

/**
 * An edit target on the note behind a focused table cell. The cursor is the
 * end of that table, and an insertion there always starts on a new line, so
 * nothing is appended to the table's last row.
 */
export function noteTargetBelowTable(path: string, view: EditorView, cell: HTMLElement): EditTarget {
  const doc = () => view.state.doc.toString();
  const cursor = (): number => {
    let at = view.state.selection.main.head;
    try {
      at = view.posAtDOM(cell);
    } catch {
      // Keep the note's own selection.
    }
    return tableBlockEnd(doc(), at);
  };
  const replace = (start: number, end: number, text: string): void => {
    const insert = start === end && start === cursor() && !text.startsWith('\n') ? `\n${text}` : text;
    view.dispatch({ changes: { from: start, to: end, insert } });
  };
  return {
    path,
    async getText() {
      return doc();
    },
    async insertAtCursor(text: string) {
      const at = cursor();
      replace(at, at, text);
    },
    async replaceRange(start: number, end: number, text: string) {
      replace(start, end, text);
    },
    async getCursorOffset() {
      return cursor();
    },
    async revealOffset(offset: number) {
      view.dispatch({ selection: { anchor: offset }, scrollIntoView: true });
      view.focus();
    },
  };
}

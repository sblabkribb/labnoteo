/**
 * Keep the caret of a note being exported off the top of the note (#470).
 *
 * Closing the command palette or a prompt hands the focus back to the editor,
 * and with some plugins (Copilot) CodeMirror then reads the browser's selection
 * while it still sits at the start of the content: a `select` transaction puts
 * the caret at 0:0, and the next table typed goes above the front matter.
 *
 * Such a transaction is told apart from Ctrl+Home or a click by what came just
 * before it in the editor, since CodeMirror gives both the same `select` event.
 * While an editor is armed, a selection that goes to the top without a pointer
 * press or a caret-moving key, and without changing the text, is replaced by the
 * selection it started from. Typing in between does not matter: the caret goes
 * back to where the typing left it.
 */
import { EditorState, type EditorSelection, type Extension, type Transaction } from '@codemirror/state';
import { EditorView } from '@codemirror/view';

/** How soon after a pointer press or a caret-moving key a move to the top is the user's own. */
const INPUT_MS = 50;

const MOVE_KEYS = new Set(['Home', 'End', 'PageUp', 'PageDown', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

/**
 * A key that can take the caret to the top by itself: the navigation keys and
 * any Ctrl or Cmd chord. Enter and characters cannot, so a jump right after
 * them is still put back.
 */
export function movesCaret(e: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey'>): boolean {
  return e.ctrlKey || e.metaKey || MOVE_KEYS.has(e.key);
}

export interface CaretGuardOptions {
  /** The editor a state belongs to (the `editorInfoField` owner), or null. */
  editorOf: (state: EditorState) => object | null | undefined;
  now?: () => number;
}

const atTop = (sel: EditorSelection): boolean => sel.ranges.every(r => r.anchor === 0 && r.head === 0);

export class CaretGuard {
  private readonly armed = new WeakMap<object, number>();
  private readonly inputs = new WeakMap<object, number>();
  private readonly now: () => number;

  constructor(private readonly opts: CaretGuardOptions) {
    this.now = opts.now ?? Date.now;
  }

  /** Guard `editor` for `ms` from now (Infinity until armed again); a later call replaces the time. */
  arm(editor: object, ms: number): void {
    this.armed.set(editor, this.now() + ms);
  }

  /** A pointer press or a caret-moving key in `editor`, just now. */
  noteInput(editor: object): void {
    this.inputs.set(editor, this.now());
  }

  /** Whether `tr` takes an armed editor's caret to the top on its own. */
  private jumps(tr: Transaction): boolean {
    const editor = this.opts.editorOf(tr.startState);
    if (!editor) return false;
    const now = this.now();
    if (!((this.armed.get(editor) ?? 0) > now)) return false;
    if (!atTop(tr.newSelection) || atTop(tr.startState.selection)) return false;
    if (now - (this.inputs.get(editor) ?? -Infinity) <= INPUT_MS) return false;
    return !tr.docChanged || tr.startState.doc.eq(tr.newDoc);
  }

  extension(): Extension {
    // The text is the same, so the old positions hold in the new document as they are.
    const filter = EditorState.transactionFilter.of(tr => {
      try {
        return this.jumps(tr) ? [tr, { selection: tr.startState.selection, sequential: true }] : tr;
      } catch (err) {
        console.warn('[labnoteo] caret guard failed:', err);
        return tr;
      }
    });
    // Observers, since a keymap that handles Ctrl+Home stops the event before any handler.
    const note = (view: EditorView): void => {
      const editor = this.opts.editorOf(view.state);
      if (editor) this.noteInput(editor);
    };
    const inputs = EditorView.domEventObservers({
      keydown: (event, view) => {
        if (movesCaret(event)) note(view);
      },
      pointerdown: (_event, view) => note(view),
    });
    return [filter, inputs];
  }
}

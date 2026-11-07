/**
 * #470: closing the palette or a prompt during a CSV export can hand the editor
 * a `select` transaction that puts the caret at 0:0. An armed editor gets the
 * selection it started from instead, unless the user just clicked or pressed a
 * caret-moving key, or the text changed.
 */
import { describe, it, expect } from 'vitest';
import { EditorSelection, EditorState, Facet, Transaction } from '@codemirror/state';
import { CaretGuard, movesCaret } from '../../src/caretGuard';

const DOC = '---\ntitle: x\n---\n\n| a |\n|---|\n| 1 |\n';
const END = DOC.length - 1;

const owner = Facet.define<object, object | null>({ combine: v => v[0] ?? null });

function setup() {
  let clock = 1000;
  const guard = new CaretGuard({ editorOf: s => s.facet(owner), now: () => clock });
  const editor = {};
  const state = (editorOf: object = editor, doc = DOC, head = END) =>
    EditorState.create({
      doc,
      selection: { anchor: head },
      extensions: [guard.extension(), owner.of(editorOf), EditorState.allowMultipleSelections.of(true)],
    });
  return { guard, editor, state, tick: (ms: number) => (clock += ms) };
}

const toTop = (s: EditorState) => s.update({ selection: { anchor: 0 }, userEvent: 'select' });

describe('the caret guard (#470)', () => {
  it('puts back a caret an armed editor moves to the top', () => {
    const { guard, editor, state } = setup();
    guard.arm(editor, Infinity);

    expect(toTop(state()).state.selection.main.head).toBe(END);
  });

  it('keeps the transaction’s own event', () => {
    const { guard, editor, state } = setup();
    guard.arm(editor, Infinity);

    const tr = toTop(state());
    expect(tr.annotation(Transaction.userEvent)).toBe('select');
    expect(tr.state.selection.main.head).toBe(END);
  });

  // A file reload replaces the whole text, so the old caret maps to the top.
  it('puts it back when the text is replaced by the same text', () => {
    const { guard, editor, state } = setup();
    guard.arm(editor, Infinity);
    const s = state(editor, DOC, 8);

    const tr = s.update({ changes: { from: 0, to: DOC.length, insert: DOC }, userEvent: 'set' });
    expect(tr.docChanged).toBe(true);
    expect(tr.state.selection.main.head).toBe(8);
  });

  it('leaves it when the text changes', () => {
    const { guard, editor, state } = setup();
    guard.arm(editor, Infinity);

    const tr = state().update({ changes: { from: 0, to: DOC.length, insert: 'new' }, selection: { anchor: 0 } });
    expect(tr.state.selection.main.head).toBe(0);
  });

  it('puts it back where the user typed, when the jump comes after the typing', () => {
    const { guard, editor, state } = setup();
    guard.arm(editor, Infinity);
    const typed = state().update({ changes: { from: END, insert: 'x' }, selection: { anchor: END + 1 }, userEvent: 'input.type' }).state;

    expect(toTop(typed).state.selection.main.head).toBe(END + 1);
  });

  it('leaves a move to the top right after a click or a caret-moving key', () => {
    const { guard, editor, state, tick } = setup();
    guard.arm(editor, Infinity);
    guard.noteInput(editor);
    tick(30);

    expect(toTop(state()).state.selection.main.head).toBe(0);
  });

  it('puts it back once the click or key is past', () => {
    const { guard, editor, state, tick } = setup();
    guard.arm(editor, Infinity);
    guard.noteInput(editor);
    tick(200);

    expect(toTop(state()).state.selection.main.head).toBe(END);
  });

  it('leaves another editor, and an editor no longer armed', () => {
    const { guard, editor, state, tick } = setup();
    guard.arm(editor, Infinity);
    expect(toTop(state({})).state.selection.main.head).toBe(0);

    guard.arm(editor, 2000);
    tick(2001);
    expect(toTop(state()).state.selection.main.head).toBe(0);
  });

  it('leaves a selection that keeps a cursor off the top', () => {
    const { guard, editor, state } = setup();
    guard.arm(editor, Infinity);

    const tr = state().update({
      selection: EditorSelection.create([EditorSelection.cursor(0), EditorSelection.cursor(5)]),
    });
    expect(tr.state.selection.ranges.map(r => r.head)).toEqual([0, 5]);
  });

  // A jump read on the first key after the focus came back is the symptom, not the key.
  it('counts navigation keys and chords as caret moves, not Enter or characters', () => {
    const key = (k: string, mod: Partial<Record<'ctrlKey' | 'metaKey', boolean>> = {}) =>
      movesCaret({ key: k, ctrlKey: false, metaKey: false, ...mod });

    expect(['Home', 'PageUp', 'ArrowUp', 'ArrowLeft'].every(k => key(k))).toBe(true);
    expect(key('Home', { ctrlKey: true })).toBe(true);
    expect(key('ArrowUp', { metaKey: true })).toBe(true);
    expect(key('Enter')).toBe(false);
    expect(key('a')).toBe(false);
  });
});

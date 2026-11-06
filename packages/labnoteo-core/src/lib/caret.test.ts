import { describe, it, expect } from 'vitest';
import { caretBeforeModal, caretIn } from './caret';
import type { EditTarget } from '../host';

const target = (cursor?: number): EditTarget =>
  ({
    path: 'labnote/001_A/001_WD010_A.labnote.md',
    getText: async () => 'text',
    getCursorOffset: cursor === undefined ? undefined : async () => cursor,
    insertAtCursor: async () => undefined,
    replaceRange: async () => undefined,
  }) as EditTarget;

// #544
describe('caretBeforeModal', () => {
  it('reads the cursor, and is undefined for a host that tracks none', async () => {
    expect(await caretBeforeModal(target(7))).toBe(7);
    expect(await caretBeforeModal(target())).toBeUndefined();
  });
});

describe('caretIn', () => {
  it('keeps a cursor that is still inside the text', () => {
    expect(caretIn(3, 'abcdefg')).toBe(3);
    expect(caretIn(0, 'abcdefg')).toBe(0);
  });

  it('falls back to the end of the text without a cursor', () => {
    expect(caretIn(undefined, 'abcdefg')).toBe(7);
    expect(caretIn(undefined, '')).toBe(0);
  });

  // A sync may shorten the note while the dialog is open.
  it('never points past the end of a note that shrank', () => {
    expect(caretIn(99, 'abc')).toBe(3);
  });
});

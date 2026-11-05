/**
 * Keeping the cursor a command started from across a dialog (#450, #544).
 *
 * A modal takes the focus, and in Source mode the note's editor then reports
 * the cursor at the start of the note. A command that asks something before it
 * writes therefore has to read the cursor *before* opening its dialog, and use
 * what it read afterwards — clamped, since the note may have been written to
 * meanwhile.
 */
import type { EditTarget } from '../host';

/** The cursor of `target`, for a host that tracks one; undefined otherwise. */
export async function caretBeforeModal(target: EditTarget): Promise<number | undefined> {
  return target.getCursorOffset ? await target.getCursorOffset() : undefined;
}

/**
 * `caret` as an offset into `text`: the end of the note when it was never read,
 * and never past the end, so a note that shrank while a dialog was open still
 * takes the insert.
 */
export function caretIn(caret: number | undefined, text: string): number {
  return caret === undefined ? text.length : Math.min(caret, text.length);
}

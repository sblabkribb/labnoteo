/**
 * The `discuss` flag is the one signal that turns a note into a GitHub Issue,
 * and it is read in two places (the plugin's toggle command, the automation's
 * `shouldPromote`). A disagreement between them is invisible in Obsidian and
 * only shows up as an issue that never gets opened — hence the exhaustive
 * coverage of the shapes a note's front matter can actually carry.
 */
import { describe, it, expect } from 'vitest';
import { DISCUSS_FLAG_KEY, isDiscussFlagged, setDiscussFlag } from '../lib/discussFlag';

describe('isDiscussFlagged', () => {
  it('accepts the boolean written by the toggle command', () => {
    expect(isDiscussFlagged({ discuss: true })).toBe(true);
  });

  it('accepts the quoted string a hand edit or YAML writer can produce', () => {
    expect(isDiscussFlagged({ discuss: 'true' })).toBe(true);
    expect(isDiscussFlagged({ discuss: 'TRUE' })).toBe(true);
    expect(isDiscussFlagged({ discuss: ' true ' })).toBe(true);
  });

  it('is false when absent, false, or any other value', () => {
    expect(isDiscussFlagged({})).toBe(false);
    expect(isDiscussFlagged({ discuss: false })).toBe(false);
    expect(isDiscussFlagged({ discuss: 'false' })).toBe(false);
    expect(isDiscussFlagged({ discuss: 'yes' })).toBe(false);
    expect(isDiscussFlagged({ status: 'in-progress' })).toBe(false);
  });
});

describe('setDiscussFlag', () => {
  it('appends the flag to a note that predates the field', () => {
    expect(setDiscussFlag({ status: 'in-progress' }, true)).toEqual({
      status: 'in-progress',
      discuss: true,
    });
  });

  it('deletes the key when clearing rather than writing `discuss: false`', () => {
    const cleared = setDiscussFlag({ status: 'in-progress', discuss: true }, false);
    expect(DISCUSS_FLAG_KEY in cleared).toBe(false);
    expect(cleared).toEqual({ status: 'in-progress' });
  });

  it('leaves the other keys and their order untouched', () => {
    const before = { id: 'EXP-001', status: 'in-progress', project: 'P' };
    expect(Object.keys(setDiscussFlag(before, true))).toEqual([
      'id',
      'status',
      'project',
      'discuss',
    ]);
  });

  it('does not mutate the input', () => {
    const before = { status: 'in-progress' };
    setDiscussFlag(before, true);
    expect(before).toEqual({ status: 'in-progress' });
  });

  it('round-trips through isDiscussFlagged in both directions', () => {
    const on = setDiscussFlag({}, true);
    expect(isDiscussFlagged(on)).toBe(true);
    expect(isDiscussFlagged(setDiscussFlag(on, false))).toBe(false);
  });
});

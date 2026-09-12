// Globals convention (no `import ... from 'vitest'`) — matches the core tests.
//
// Pins the deterministic promotion signal (Phase 4a): only `discuss: true` or
// `status: needs-review` promote; no free-text scanning.
import { shouldPromote, selectPromotable } from './issue-sync';
import type { ExperimentNote } from './lib/experiments';

const note = (fm: Record<string, unknown>): ExperimentNote => ({
  dir: 'labnote/001_X',
  folderName: '001_X',
  frontMatter: fm,
  body: '',
  bodyLineOffset: 0,
});

describe('shouldPromote', () => {
  it('promotes on discuss: true (boolean or string)', () => {
    expect(shouldPromote({ discuss: true })).toBe(true);
    expect(shouldPromote({ discuss: 'true' })).toBe(true);
  });
  it('promotes on status: needs-review', () => {
    expect(shouldPromote({ status: 'needs-review' })).toBe(true);
  });
  it('does not promote without an explicit signal', () => {
    expect(shouldPromote({ status: 'completed' })).toBe(false);
    expect(shouldPromote({ discuss: false })).toBe(false);
    expect(shouldPromote({})).toBe(false);
  });
});

describe('selectPromotable', () => {
  it('keeps only experiments with a signal', () => {
    const notes = [
      note({ status: 'needs-review' }),
      note({ status: 'completed' }),
      note({ discuss: true }),
    ];
    expect(selectPromotable(notes)).toHaveLength(2);
  });
});

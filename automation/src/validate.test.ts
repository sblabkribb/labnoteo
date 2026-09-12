// Globals convention (no `import ... from 'vitest'`) — matches the core tests.
//
// Pins the pure, deterministic validation rules (Phase 3): `status` required and
// controlled, `id` unique, non-labnote notes ignored.
import { validateExperiments, type ValidatedNote } from './validate';

const note = (
  path: string,
  fm: Record<string, unknown>,
  body = '',
  bodyLineOffset = 0
): ValidatedNote => ({
  path,
  frontMatter: { experiment_type: 'labnote', ...fm },
  body,
  bodyLineOffset,
});

describe('validateExperiments', () => {
  it('accepts a note with a valid status', () => {
    expect(validateExperiments([note('a', { status: 'in-progress' })])).toEqual([]);
  });

  it('flags a missing status', () => {
    const errors = validateExperiments([note('labnote/001_A/README.labnote.md', {})]);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('missing required `status`');
  });

  it('flags an invalid status value', () => {
    const errors = validateExperiments([note('a', { status: 'done' })]);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('invalid `status: done`');
  });

  it('detects duplicate ids across notes', () => {
    const errors = validateExperiments([
      note('a', { status: 'completed', id: 'EXP-001' }),
      note('b', { status: 'completed', id: 'EXP-001' }),
    ]);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('Duplicate `id: EXP-001`');
    expect(errors[0]).toContain('a');
    expect(errors[0]).toContain('b');
  });

  it('allows distinct ids and ignores blank ids', () => {
    expect(
      validateExperiments([
        note('a', { status: 'completed', id: 'EXP-001' }),
        note('b', { status: 'completed', id: 'EXP-002' }),
        note('c', { status: 'completed' }),
      ])
    ).toEqual([]);
  });

  it('ignores notes that are not experiment_type: labnote', () => {
    expect(
      validateExperiments([
        { path: 'x', frontMatter: { experiment_type: 'other' }, body: '', bodyLineOffset: 0 },
      ])
    ).toEqual([]);
  });
});

// A mistyped marker opens no issue and reports nothing, so the researcher
// believes a discussion was raised when it was not. These rules are the only
// thing that surfaces that.
describe('validateExperiments — @issue markers', () => {
  const ok = { status: 'in-progress' };

  it('accepts well-formed markers', () => {
    const body = '## Results\n@issue;ISS-a1;재현 조건 확인\n@issue;ISS-b2;다른 논의';
    expect(validateExperiments([note('a', ok, body)])).toEqual([]);
  });

  it('flags a marker written without an ID and points at the fix', () => {
    const errors = validateExperiments([note('a', ok, '@issue;수율이 재현되지 않음')]);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('malformed `@issue` marker');
    expect(errors[0]).toContain('missing marker ID');
    expect(errors[0]).toContain('Insert issue marker');
  });

  it('flags a marker with no topic sentence', () => {
    const errors = validateExperiments([note('a', ok, '@issue;ISS-a1;')]);
    expect(errors[0]).toContain('missing topic sentence');
  });

  it('cites the line in the file, not in the body', () => {
    // Body line 2, with 4 front-matter lines stripped, is file line 6.
    const errors = validateExperiments([note('a', ok, 'prose\n@issue;broken', 4)]);
    expect(errors[0]).toContain('a:6:');
  });

  it('rejects a marker ID reused within one note', () => {
    const errors = validateExperiments([note('a', ok, '@issue;ISS-a1;첫째\n@issue;ISS-a1;둘째')]);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('duplicate marker ID `ISS-a1`');
  });

  it('allows the same marker ID in different notes, since issues are namespaced', () => {
    expect(
      validateExperiments([
        note('a', { ...ok, id: 'EXP-001' }, '@issue;ISS-a1;x'),
        note('b', { ...ok, id: 'EXP-002' }, '@issue;ISS-a1;x'),
      ])
    ).toEqual([]);
  });
});

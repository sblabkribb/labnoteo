// Globals convention (no `import ... from 'vitest'`) — matches the core tests.
//
// Pins the pure, deterministic validation rules (Phase 3): `status` required and
// controlled, `id` unique, non-labnote notes ignored.
import { validateExperiments, type ValidatedNote } from './validate';

const note = (path: string, fm: Record<string, unknown>): ValidatedNote => ({
  path,
  frontMatter: { experiment_type: 'labnote', ...fm },
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
      validateExperiments([{ path: 'x', frontMatter: { experiment_type: 'other' } }])
    ).toEqual([]);
  });
});

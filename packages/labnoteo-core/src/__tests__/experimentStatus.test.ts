// Globals convention (no `import ... from 'vitest'`) — see sampleDefinition.test.ts.
//
// Pins the controlled experiment-status vocabulary + validation. These terms are
// a shared contract (plugin status picker + vault-repo automation), so the exact
// set and order are locked here to catch accidental edits.
import {
  EXPERIMENT_STATUSES,
  isValidStatus,
  type ExperimentStatus,
} from '../lib/experimentStatus';

describe('EXPERIMENT_STATUSES', () => {
  it('is the expected controlled set in lifecycle order', () => {
    expect(EXPERIMENT_STATUSES).toEqual([
      'planned',
      'in-progress',
      'needs-review',
      'completed',
      'failed',
      'discontinued',
      'needs-repeat',
    ]);
  });

  it('has no duplicate values', () => {
    expect(new Set(EXPERIMENT_STATUSES).size).toBe(EXPERIMENT_STATUSES.length);
  });
});

describe('isValidStatus', () => {
  it.each([...EXPERIMENT_STATUSES])('accepts the allowed value %s', status => {
    expect(isValidStatus(status)).toBe(true);
  });

  it.each(['', 'Planned', 'in progress', 'done', 'unknown', 'needs_review'])(
    'rejects the invalid value %s',
    value => {
      expect(isValidStatus(value)).toBe(false);
    }
  );

  it('defaults a new experiment to the planned status', () => {
    // `generateReadmeContent` seeds `status: planned`; keep that in the set.
    const seeded: ExperimentStatus = 'planned';
    expect(isValidStatus(seeded)).toBe(true);
  });
});

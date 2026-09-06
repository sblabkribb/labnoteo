// Globals convention (no `import ... from 'vitest'`) — see sampleDefinition.test.ts.
import { CORE_VERSION } from '../index';

describe('@labnoteo/core smoke', () => {
  it('is importable and exposes a version', () => {
    expect(typeof CORE_VERSION).toBe('string');
    expect(CORE_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

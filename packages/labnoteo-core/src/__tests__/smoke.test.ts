// Globals convention (no `import ... from 'vitest'`) — see sampleDefinition.test.ts.
import { MemFileSystem, createLabnoteTools } from '../index';

describe('@labnoteo/core smoke', () => {
  it('is importable and exposes core entry points', () => {
    expect(typeof MemFileSystem).toBe('function');
    expect(Array.isArray(createLabnoteTools())).toBe(true);
  });
});

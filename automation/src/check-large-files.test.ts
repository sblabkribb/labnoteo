// Globals convention (no `import ... from 'vitest'`) — matches the core tests.
//
// Pins the pure size-classification thresholds used by the vault large-file
// guard. The boundaries are a researcher-facing contract (<10MB ok / 10-50MB
// warn / >50MB block), so the exact cutoffs are locked here.
import {
  classifyFileSize,
  WARN_THRESHOLD_BYTES,
  BLOCK_THRESHOLD_BYTES,
} from './check-large-files';

describe('classifyFileSize', () => {
  it('classifies files under 10 MB as ok', () => {
    expect(classifyFileSize(0)).toBe('ok');
    expect(classifyFileSize(1024)).toBe('ok');
    expect(classifyFileSize(WARN_THRESHOLD_BYTES - 1)).toBe('ok');
  });

  it('classifies files in the 10-50 MB band as warn (10 MB inclusive)', () => {
    expect(classifyFileSize(WARN_THRESHOLD_BYTES)).toBe('warn');
    expect(classifyFileSize(25 * 1024 * 1024)).toBe('warn');
    expect(classifyFileSize(BLOCK_THRESHOLD_BYTES)).toBe('warn');
  });

  it('classifies files over 50 MB as block', () => {
    expect(classifyFileSize(BLOCK_THRESHOLD_BYTES + 1)).toBe('block');
    expect(classifyFileSize(500 * 1024 * 1024)).toBe('block');
  });

  it('uses 10 MB / 50 MB thresholds', () => {
    expect(WARN_THRESHOLD_BYTES).toBe(10 * 1024 * 1024);
    expect(BLOCK_THRESHOLD_BYTES).toBe(50 * 1024 * 1024);
  });
});

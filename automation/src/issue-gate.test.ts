// Globals convention (no `import ... from 'vitest'`) — matches the core tests.
//
// Pins the Phase 4b prefilter + verdict parsing: the keyword gate flags only the
// listed tokens (bare `질문` excluded) and the LLM verdict is validated strictly.
import { matchesIssueKeywords, parseVerdict } from './issue-gate';

describe('matchesIssueKeywords', () => {
  it('flags each listed token', () => {
    expect(matchesIssueKeywords('여기에 이슈가 있습니다')).toBe(true);
    expect(matchesIssueKeywords('이건 논의 필요')).toBe(true);
    expect(matchesIssueKeywords('논의필요함')).toBe(true);
    expect(matchesIssueKeywords('we should DISCUSS this')).toBe(true);
  });
  it('does not flag bare 질문 or unrelated prose', () => {
    expect(matchesIssueKeywords('질문이 하나 있습니다')).toBe(false);
    expect(matchesIssueKeywords('오늘 PCR을 30 사이클 수행했다')).toBe(false);
  });
});

describe('parseVerdict', () => {
  it('accepts a well-formed verdict', () => {
    expect(parseVerdict({ needs_issue: true, reason: 'x' })).toEqual({
      needs_issue: true,
      reason: 'x',
    });
  });
  it('defaults a missing reason to empty string', () => {
    expect(parseVerdict({ needs_issue: false })).toEqual({ needs_issue: false, reason: '' });
  });
  it('rejects malformed values', () => {
    expect(parseVerdict(null)).toBeUndefined();
    expect(parseVerdict({ reason: 'x' })).toBeUndefined();
    expect(parseVerdict({ needs_issue: 'yes' })).toBeUndefined();
  });
});

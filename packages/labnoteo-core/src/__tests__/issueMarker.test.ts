/**
 * Markers are the only thing that turns a line of a note into a GitHub Issue,
 * and three components parse them independently of each other (insert command,
 * `issue-sync`, `validate`). A grammar bug here is invisible in Obsidian and
 * surfaces only as a discussion that never reached the team, so the boundary
 * cases are pinned exhaustively.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  ISSUE_MARKER_ID_PREFIX,
  findEnclosingHeading,
  findIssueMarkerRanges,
  generateIssueMarkerId,
  parseIssueMarkers,
  renderIssueMarker,
  resetIssueMarkerIdCounter,
} from '../lib/issueMarker';

describe('parseIssueMarkers', () => {
  it('reads a marker that follows prose on the same line', () => {
    const md = '3차 시도에서만 수율 40%. @issue;ISS-mkd8x3k;시드 배양 시간 차이 때문인지 논의 필요';
    expect(parseIssueMarkers(md).markers).toEqual([
      { id: 'ISS-mkd8x3k', title: '시드 배양 시간 차이 때문인지 논의 필요', line: 1 },
    ]);
  });

  it('takes the rest of the line as the title, including punctuation', () => {
    const { markers } = parseIssueMarkers('@issue;ISS-a1;A/B 중 무엇? 결정 필요; 내일까지');
    expect(markers[0].title).toBe('A/B 중 무엇? 결정 필요; 내일까지');
  });

  it('accepts `:` as a delimiter, like sample references do', () => {
    const { markers } = parseIssueMarkers('@issue:ISS-a1:재현 조건 확인');
    expect(markers[0]).toMatchObject({ id: 'ISS-a1', title: '재현 조건 확인' });
  });

  it('is case-insensitive on the keyword', () => {
    expect(parseIssueMarkers('@Issue;ISS-a1;확인').markers).toHaveLength(1);
  });

  it('reports 1-based line numbers for several markers', () => {
    const md = ['# Results', '@issue;ISS-a;첫째', 'prose', '@issue;ISS-b;둘째'].join('\n');
    expect(parseIssueMarkers(md).markers.map(m => m.line)).toEqual([2, 4]);
  });

  it('ignores markers inside fenced code so a note may document the syntax', () => {
    const md = ['```markdown', '@issue;ISS-example;예시', '```', '@issue;ISS-real;진짜'].join('\n');
    const { markers } = parseIssueMarkers(md);
    expect(markers).toHaveLength(1);
    expect(markers[0].id).toBe('ISS-real');
  });

  it('handles tilde fences and unclosed fences', () => {
    expect(parseIssueMarkers('~~~\n@issue;ISS-a;x\n~~~').markers).toHaveLength(0);
    expect(parseIssueMarkers('```\n@issue;ISS-a;x').markers).toHaveLength(0);
  });

  it('does not match a word that merely starts with the keyword', () => {
    const scan = parseIssueMarkers('@issues;ISS-a;x 그리고 issue 이야기');
    expect(scan.markers).toHaveLength(0);
    expect(scan.malformed).toHaveLength(0);
  });

  it('reports a topic sentence written without an ID', () => {
    const scan = parseIssueMarkers('@issue;수율이 재현되지 않음');
    expect(scan.markers).toHaveLength(0);
    expect(scan.malformed).toEqual([
      { line: 1, text: '@issue;수율이 재현되지 않음', reason: 'missing-id' },
    ]);
  });

  it('reports a bare keyword and an ID with no topic sentence', () => {
    expect(parseIssueMarkers('@issue').malformed[0].reason).toBe('missing-id');
    expect(parseIssueMarkers('@issue;ISS-a1;').malformed[0].reason).toBe('missing-title');
    expect(parseIssueMarkers('@issue;ISS-a1;   ').malformed[0].reason).toBe('missing-title');
    expect(parseIssueMarkers('@issue;ISS-a1').malformed[0].reason).toBe('missing-title');
  });

  it('returns nothing for a note with no markers', () => {
    expect(parseIssueMarkers('# Results\n수율 40%')).toEqual({ markers: [], malformed: [] });
  });
});

describe('findIssueMarkerRanges', () => {
  it('spans from the keyword to end of line, leaving the prose before it alone', () => {
    const text = '수율 40%. @issue;ISS-a1;논의 필요';
    expect(findIssueMarkerRanges(text)).toEqual([
      { start: text.indexOf('@issue'), end: text.length },
    ]);
  });

  it('stops at the newline, not at the end of the document', () => {
    const text = '@issue;ISS-a1;첫째\n다음 줄';
    expect(findIssueMarkerRanges(text)[0]).toEqual({ start: 0, end: '@issue;ISS-a1;첫째'.length });
  });

  it('offsets correctly across several lines', () => {
    const text = 'a\nb\n@issue;ISS-a1;x';
    expect(findIssueMarkerRanges(text)).toEqual([{ start: 4, end: text.length }]);
  });

  // The highlight is the feedback: an unstyled marker is one that opens nothing.
  it('ignores malformed markers so styling signals validity', () => {
    expect(findIssueMarkerRanges('@issue;주제만 있고 ID 없음')).toEqual([]);
    expect(findIssueMarkerRanges('@issue;ISS-a1;')).toEqual([]);
  });
});

describe('generateIssueMarkerId', () => {
  beforeEach(() => resetIssueMarkerIdCounter());

  it('is prefixed and base36 — shorter than the decimal sample IDs', () => {
    const id = generateIssueMarkerId();
    expect(id.startsWith(`${ISSUE_MARKER_ID_PREFIX}-`)).toBe(true);
    expect(id).toMatch(/^ISS-[0-9a-z]+$/);
    expect(id.length).toBeLessThan(`DNA-${Date.now()}`.length);
  });

  it('never repeats within a burst', () => {
    const ids = Array.from({ length: 50 }, () => generateIssueMarkerId());
    expect(new Set(ids).size).toBe(50);
  });

  it('round-trips through the parser', () => {
    const id = generateIssueMarkerId();
    const { markers } = parseIssueMarkers(renderIssueMarker({ id, title: '확인 필요' }));
    expect(markers[0]).toMatchObject({ id, title: '확인 필요' });
  });
});

describe('findEnclosingHeading', () => {
  const md = [
    '# Objective', // 1
    'text', // 2
    '## Results', // 3
    '@issue;ISS-a;x', // 4
    '```', // 5
    '# NotAHeading', // 6
    '```', // 7
    '@issue;ISS-b;y', // 8
  ].join('\n');

  it('finds the nearest heading above the line', () => {
    expect(findEnclosingHeading(md, 4)).toBe('Results');
  });

  it('skips headings that are inside fenced code', () => {
    expect(findEnclosingHeading(md, 8)).toBe('Results');
  });

  it('returns the heading itself when the line is the heading', () => {
    expect(findEnclosingHeading(md, 3)).toBe('Results');
  });

  it('is undefined before any heading', () => {
    expect(findEnclosingHeading('prose\n@issue;ISS-a;x', 2)).toBeUndefined();
  });
});

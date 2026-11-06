import { describe, it, expect } from 'vitest';
import {
  applyTextEdits,
  ensureUnitOpSection,
  findUnitOpInsertOffset,
  findUnitOpInsertPointAt,
  isUnitOpSectionTitle,
  missingUnitOpSectionEdit,
  pruneUnitOpTocEntries,
  rebuildUnitOpToc,
  unitOpSectionLine,
} from '../sections/workflowSectionParser';
import { hasRecordedResults } from '../lib/noteResults';
import { createWorkflowContent } from '../lib/workflowStructure';
import { buildHwUnitOpMarkdown } from '../lib/unitOpTemplate';

const META = { experimenter: 'Dr. Kim', dateTime: '2026-10-26 10:00' };

function buildNote(ops: [string, string][]): string {
  let md = createWorkflowContent({ id: 'WD010', name: 'Design', description: 'desc' }, 'Dr. Kim');
  for (const [opId, opName] of ops) {
    const block = buildHwUnitOpMarkdown({ opId, opName, opDescription: `${opName} step` }, META);
    const off = findUnitOpInsertOffset(md);
    md = rebuildUnitOpToc(md.slice(0, off) + block + md.slice(off));
  }
  return md;
}

const tocOrder = (md: string): string[] => [...md.matchAll(/^- \[(UHW\d+) /gm)].map(m => m[1]);

// #402: a translated or renamed unit-operation heading is still the section.
describe('unit operation section', () => {
  it.each([
    ['Related Unit Operations', true],
    ['관련 유닛 오퍼레이션', true],
    ['🧪 Related unit operations', true],
    ['Conclusions and Discussion', false],
  ])('reads %s as the section: %s', (title, expected) => {
    expect(isUnitOpSectionTitle(title)).toBe(expected);
  });

  it('inserts after the last block under a Korean heading', () => {
    const md = buildNote([['UHW010', 'Alpha']]).replace('## Related Unit Operations', '## 관련 유닛 오퍼레이션');
    const at = findUnitOpInsertPointAt(md, 0);
    expect(at.place).toBe('end');
    expect(at.offset).toBe(md.indexOf('## Conclusions and Discussion'));
  });

  it('finds a heading renamed to anything else by its blocks', () => {
    const md = buildNote([['UHW010', 'Alpha']]).replace('## Related Unit Operations', '## 단위 공정 목록');
    const at = findUnitOpInsertPointAt(md, 0);
    expect(at).toMatchObject({ place: 'end', after: '[UHW010 Alpha]' });
    const block = buildHwUnitOpMarkdown({ opId: 'UHW020', opName: 'Beta', opDescription: 'b' }, META);
    const next = rebuildUnitOpToc(md.slice(0, at.offset) + block + md.slice(at.offset));
    expect(tocOrder(next)).toEqual(['UHW010', 'UHW020']);
  });

  it('goes before the conclusions when no section is found, and to the end without them', () => {
    const md = buildNote([]).replace('## Related Unit Operations', '## 단위 공정 목록');
    expect(findUnitOpInsertPointAt(md, 0)).toEqual({
      offset: md.indexOf('## Conclusions and Discussion'),
      place: 'noSection',
      beforeConclusions: true,
    });
    const bare = '# Note\n\ntext\n';
    expect(findUnitOpInsertPointAt(bare, 0)).toEqual({ offset: bare.length, place: 'noSection' });
  });

  it('ignores a heading inside a code fence', () => {
    const md = '```\n## Related Unit Operations\n```\n\n## Conclusions and Discussion\n';
    expect(findUnitOpInsertPointAt(md, 0)).toMatchObject({ place: 'noSection', beforeConclusions: true });
  });

  it('does not count the TOC of a renamed section as results', () => {
    const md = buildNote([['UHW010', 'Alpha']]);
    expect(hasRecordedResults(md.replace('## Related Unit Operations', '## 관련 유닛 오퍼레이션'))).toBe(false);
    expect(hasRecordedResults(md.replace('## Related Unit Operations', '## 단위 공정 목록'))).toBe(false);
  });
});

// #406: with sorting off, deleting a block still drops its own entry.
describe('pruneUnitOpTocEntries', () => {
  const note = (toc: string[], headings: string[]): string =>
    ['## Related Unit Operations', '', ...toc, '', '---', '', ...headings, ''].join('\n');

  it('drops the entry of a deleted block and keeps the order of the rest', () => {
    const md = note(['- [UHW020 B](#uhw020-b)', '- [UHW010 A](#uhw010-a)', '- [UHW030 C](#uhw030-c)'], [
      '### [UHW010 A]',
      '',
      '### [UHW030 C]',
    ]);
    const out = applyTextEdits(md, pruneUnitOpTocEntries(md));
    expect(out).toBe(note(['- [UHW010 A](#uhw010-a)', '- [UHW030 C](#uhw030-c)'], ['### [UHW010 A]', '', '### [UHW030 C]']));
  });

  it('pairs entries of the same opId by label, so the remaining block keeps its marker', () => {
    const md = note(['- [UHW010 A | 1차](#uhw010-a-1차) @issue;ISS-1;x', '- [UHW010 A | 2차](#uhw010-a-2차) @issue;ISS-2;y'], [
      '### [UHW010 A] 2차',
    ]);
    const out = applyTextEdits(md, pruneUnitOpTocEntries(md));
    expect(tocOrder(out)).toEqual(['UHW010']);
    expect(out).toContain('@issue;ISS-2;y');
    expect(out).not.toContain('ISS-1');
    expect(rebuildUnitOpToc(md)).toContain('- [UHW010 A | 2차](#uhw010-a-2차) @issue;ISS-2;y');
  });

  it('changes nothing when every entry has its heading', () => {
    const md = note(['- [UHW020 B](#uhw020-b)', '- [UHW010 A](#uhw010-a)'], ['### [UHW010 A]', '', '### [UHW020 B]']);
    expect(pruneUnitOpTocEntries(md)).toEqual([]);
  });
});

// #564: with the section heading deleted, the TOC went between the title and its description.
describe('a deleted unit-operation heading', () => {
  const title = '## [WD010 Design]\n\n> desc\n';

  it('is not found under the workflow title, and comes back after its description', () => {
    const full = buildNote([['UHW010', 'Alpha']]);
    const noHeading = full.replace('## Related Unit Operations\n\n', '');
    expect(unitOpSectionLine(noHeading)).toBe(-1);
    const fixed = ensureUnitOpSection(noHeading);
    expect(fixed).toContain(`${title}\n## Related Unit Operations\n\n- [UHW010`);
    expect(unitOpSectionLine(fixed)).not.toBe(-1);
  });

  it('comes back after the description when the list was deleted too', () => {
    const full = buildNote([['UHW010', 'Alpha']]);
    const bare = full.replace(/## Related Unit Operations\n\n(- \[.*\n)+\n?/, '');
    expect(bare).not.toContain('- [UHW010');
    const fixed = ensureUnitOpSection(bare);
    expect(fixed.indexOf('## Related Unit Operations')).toBeGreaterThan(fixed.indexOf('> desc'));
    expect(fixed.indexOf('## Related Unit Operations')).toBeLessThan(fixed.indexOf('### [UHW010'));
    const rebuilt = rebuildUnitOpToc(fixed);
    expect(rebuilt.indexOf('- [UHW010')).toBeGreaterThan(rebuilt.indexOf('## Related Unit Operations'));
  });

  it('comes back in a workflow note that has no unit operation yet', () => {
    expect(ensureUnitOpSection(`${title}\n## Conclusions\n`)).toBe(`${title}\n## Related Unit Operations\n\n## Conclusions\n`);
  });

  it('leaves a renamed heading, and a note that is no workflow, alone', () => {
    const renamed = buildNote([['UHW010', 'Alpha']]).replace('## Related Unit Operations', '## 공정');
    expect(missingUnitOpSectionEdit(renamed)).toBeNull();
    expect(missingUnitOpSectionEdit(`${title}\n## 공정\n\n## Conclusions\n`)).toBeNull();
    expect(missingUnitOpSectionEdit('---\ntitle: x\n---\n\n# Notes\n')).toBeNull();
  });

  it('goes before the first block when there is no workflow title', () => {
    const md = '# Note\n\n---\n\n### [UHW010 A]\n\nx\n';
    expect(ensureUnitOpSection(md)).toBe('# Note\n\n## Related Unit Operations\n\n---\n\n### [UHW010 A]\n\nx\n');
  });
});

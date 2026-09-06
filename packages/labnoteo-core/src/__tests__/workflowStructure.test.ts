// Globals convention (no `import ... from 'vitest'`) — see sampleDefinition.test.ts.
import {
  parseExperimenterFromReadme,
  reconcileWorkflowChecklist,
  parseWorkflowChecklistFromReadme,
  sanitizeWorkflowName,
} from '../lib/workflowStructure';
import { sanitizeTitle } from '../lib/labnoteStructure';

/** Build a minimal README with a "Related Workflows" section from raw lines. */
function readmeWith(lines: string[]): string {
  return ['# Experiment', '', '## Related Workflows', '', ...lines, '', '## Notes', '', 'body'].join(
    '\n'
  );
}

describe('parseExperimenterFromReadme', () => {
  it('reads a quoted author without the surrounding quotes', () => {
    const md = ['---', "author: 'Dr. Kim'", "created_date: '2024-01-01'", '---', '', '# Note'].join(
      '\n'
    );
    expect(parseExperimenterFromReadme(md)).toBe('Dr. Kim');
  });

  it('issue #36: an empty author does not swallow the next line', () => {
    const md = ['---', 'author:', "created_date: '2024-01-01'", '---'].join('\n');
    expect(parseExperimenterFromReadme(md)).toBe('');
  });

  it('returns empty string when there is no front matter', () => {
    expect(parseExperimenterFromReadme('# Just a note')).toBe('');
  });
});

describe('reconcileWorkflowChecklist', () => {
  it('reorders checklist entries by numeric NNN prefix', () => {
    const readme = readmeWith([
      '- [ ] [Design](./002_WD010_Design.labnote.md)',
      '- [x] [Assay](./001_WS010_Assay.labnote.md)',
    ]);
    const res = reconcileWorkflowChecklist(readme, []);
    expect(res.changed).toBe(true);
    const order = parseWorkflowChecklistFromReadme(res.content).map(i => i.fileName);
    expect(order).toEqual(['001_WS010_Assay.labnote.md', '002_WD010_Design.labnote.md']);
  });

  it('remaps a renamed file (old->new basename) and re-sorts by the new NNN', () => {
    const readme = readmeWith([
      '- [ ] [Assay](./001_WS010_Assay.labnote.md)',
      '- [ ] [Design](./002_WD010_Design.labnote.md)',
    ]);
    const res = reconcileWorkflowChecklist(readme, [
      { from: '001_WS010_Assay.labnote.md', to: '003_WS010_Assay.labnote.md' },
    ]);
    expect(res.changed).toBe(true);
    const order = parseWorkflowChecklistFromReadme(res.content).map(i => i.fileName);
    // 002 now sorts before the renamed 003; the link followed the file.
    expect(order).toEqual(['002_WD010_Design.labnote.md', '003_WS010_Assay.labnote.md']);
  });

  it('keeps non-standard/manual links after the standard ones', () => {
    const readme = readmeWith([
      '- [ ] [Manual](./manual-notes.labnote.md)',
      '- [ ] [Second](./002_WD010_Second.labnote.md)',
      '- [ ] [First](./001_WD010_First.labnote.md)',
    ]);
    const res = reconcileWorkflowChecklist(readme, []);
    expect(res.changed).toBe(true);
    const order = parseWorkflowChecklistFromReadme(res.content).map(i => i.fileName);
    expect(order).toEqual([
      '001_WD010_First.labnote.md',
      '002_WD010_Second.labnote.md',
      'manual-notes.labnote.md',
    ]);
  });

  it('is idempotent: a second pass with no renames reports no change', () => {
    const readme = readmeWith([
      '- [ ] [Design](./002_WD010_Design.labnote.md)',
      '- [ ] [Assay](./001_WS010_Assay.labnote.md)',
    ]);
    const first = reconcileWorkflowChecklist(readme, []);
    const second = reconcileWorkflowChecklist(first.content, []);
    expect(second.changed).toBe(false);
    expect(second.content).toBe(first.content);
  });

  it('returns no change when there is no Related Workflows section', () => {
    const md = ['# Note', '', 'Just some text.'].join('\n');
    const res = reconcileWorkflowChecklist(md, [
      { from: '001_WD010_A.labnote.md', to: '002_WD010_A.labnote.md' },
    ]);
    expect(res.changed).toBe(false);
    expect(res.content).toBe(md);
  });
});

describe('shared path-segment sanitizer', () => {
  it('folder and file sanitizers agree on the same unicode rule', () => {
    // Both now delegate to sanitizePathSegment (Unicode letters/numbers kept).
    const input = 'Sample: 실험 (A/B) 1';
    expect(sanitizeTitle(input)).toBe(sanitizeWorkflowName(input));
  });

  it('keeps Korean letters and digits, drops punctuation, collapses underscores', () => {
    expect(sanitizeWorkflowName('실험 A/B: 1')).toBe('실험_AB_1');
  });
});

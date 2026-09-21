// Globals convention (no `import ... from 'vitest'`) — see sampleDefinition.test.ts.
import {
  parseExperimenterFromReadme,
  reconcileWorkflowChecklist,
  parseWorkflowChecklistFromReadme,
  updateReadmeWorkflowSection,
  generateWorkflowChecklist,
  sanitizeWorkflowName,
  planWorkflowRenumber,
  buildRenumberStagingName,
  collapseWorkflowRenames,
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

// The section rewriter used to consume every `[ ]`/`- [x]` line it found, but
// only `.labnote.md` links were parsed back out and regenerated. Everything in
// between was deleted with no message — and this section is exactly where a
// researcher keeps loose to-dos, so the loss was routine rather than exotic.
describe('updateReadmeWorkflowSection preserves lines it does not own', () => {
  const entry = (n: string, title: string) => `- [ ] [${title}](./${n}.labnote.md)`;

  it("keeps the researcher's own checkbox lines", () => {
    const readme = readmeWith([
      entry('001_WD010_Design', 'Design'),
      '- [ ] 김박사님께 annealing 온도 문의',
      '- [x] 시약 재주문',
    ]);

    const updated = updateReadmeWorkflowSection(
      readme,
      generateWorkflowChecklist([
        { done: false, title: 'Design', fileName: '001_WD010_Design.labnote.md' },
        { done: false, title: 'Assay', fileName: '002_WS010_Assay.labnote.md' },
      ])
    );

    expect(updated).toContain('- [ ] 김박사님께 annealing 온도 문의');
    expect(updated).toContain('- [x] 시약 재주문');
    expect(updated).toContain('002_WS010_Assay.labnote.md');
  });

  it('keeps a checkbox link that points somewhere other than a workflow note', () => {
    const readme = readmeWith([entry('001_WD010_Design', 'Design'), '- [x] [protocol](./protocol.md)']);

    const updated = updateReadmeWorkflowSection(
      readme,
      generateWorkflowChecklist([
        { done: false, title: 'Design', fileName: '001_WD010_Design.labnote.md' },
      ])
    );

    expect(updated).toContain('- [x] [protocol](./protocol.md)');
  });

  it('keeps prose and the instruction blockquote', () => {
    const readme = readmeWith([
      '> 워크플로를 추가하려면 명령 팔레트를 사용하세요.',
      '',
      entry('001_WD010_Design', 'Design'),
      '',
      '재현성 관련 메모는 아래 Notes 절에 적었습니다.',
    ]);

    const updated = updateReadmeWorkflowSection(
      readme,
      generateWorkflowChecklist([
        { done: false, title: 'Design', fileName: '001_WD010_Design.labnote.md' },
      ])
    );

    expect(updated).toContain('> 워크플로를 추가하려면 명령 팔레트를 사용하세요.');
    expect(updated).toContain('재현성 관련 메모는 아래 Notes 절에 적었습니다.');
  });

  it('groups regenerated entries where the first one was', () => {
    // Entries interleaved with a note must not end up split across it.
    const readme = readmeWith([
      entry('002_WD010_Second', 'Second'),
      '- [ ] 손으로 적은 할 일',
      entry('001_WD010_First', 'First'),
    ]);

    const { content } = reconcileWorkflowChecklist(readme, []);
    const lines = content.split('\n');
    const first = lines.findIndex(l => l.includes('001_WD010_First'));
    const second = lines.findIndex(l => l.includes('002_WD010_Second'));

    expect(second).toBe(first + 1);
    expect(content).toContain('- [ ] 손으로 적은 할 일');
  });

  it('does not touch a checkbox line in a later section', () => {
    const readme = [
      '## Related Workflows',
      '',
      entry('001_WD010_Design', 'Design'),
      '',
      '## Notes',
      '',
      '- [ ] [Other](./999_WD999_Other.labnote.md)',
    ].join('\n');

    const updated = updateReadmeWorkflowSection(
      readme,
      generateWorkflowChecklist([
        { done: false, title: 'Design', fileName: '001_WD010_Design.labnote.md' },
      ])
    );

    expect(updated).toContain('- [ ] [Other](./999_WD999_Other.labnote.md)');
  });

  it('inserts after the blockquote when the section has no entries yet', () => {
    const readme = readmeWith(['> 지침 문구']);

    const updated = updateReadmeWorkflowSection(
      readme,
      generateWorkflowChecklist([
        { done: false, title: 'Design', fileName: '001_WD010_Design.labnote.md' },
      ])
    );

    const lines = updated.split('\n');
    const quote = lines.findIndex(l => l.startsWith('> '));
    const inserted = lines.findIndex(l => l.includes('001_WD010_Design'));
    expect(inserted).toBeGreaterThan(quote);
    expect(lines[inserted - 1].trim()).toBe('');
  });
});

describe('planWorkflowRenumber', () => {
  it('closes gaps while keeping the current order', () => {
    expect(
      planWorkflowRenumber([
        '001_WD010_First.labnote.md',
        '005_WS010_Second.labnote.md',
        '009_WD020_Third.labnote.md',
      ])
    ).toEqual([
      { from: '005_WS010_Second.labnote.md', to: '002_WS010_Second.labnote.md' },
      { from: '009_WD020_Third.labnote.md', to: '003_WD020_Third.labnote.md' },
    ]);
  });

  it('gives duplicated numbers distinct sequential ones', () => {
    expect(
      planWorkflowRenumber(['001_WD020_Beta.labnote.md', '001_WD010_Alpha.labnote.md'])
    ).toEqual([{ from: '001_WD020_Beta.labnote.md', to: '002_WD020_Beta.labnote.md' }]);
  });

  it('plans nothing when the folder is already sequential', () => {
    expect(
      planWorkflowRenumber(['001_WD010_A.labnote.md', '002_WD010_B.labnote.md'])
    ).toEqual([]);
  });

  it('ignores the README and any non-standard file name', () => {
    expect(
      planWorkflowRenumber([
        'README.labnote.md',
        'notes.md',
        'manual-notes.labnote.md',
        '004_WD010_Only.labnote.md',
      ])
    ).toEqual([{ from: '004_WD010_Only.labnote.md', to: '001_WD010_Only.labnote.md' }]);
  });

  it('preserves a Korean name verbatim rather than re-sanitizing it', () => {
    expect(planWorkflowRenumber(['003_WD010_실험_1.labnote.md'])).toEqual([
      { from: '003_WD010_실험_1.labnote.md', to: '001_WD010_실험_1.labnote.md' },
    ]);
  });
});

describe('buildRenumberStagingName', () => {
  it('stages under a name that is still a valid, parseable workflow file', () => {
    const staged = buildRenumberStagingName(
      { from: '002_WD010_A.labnote.md', to: '001_WD010_A.labnote.md' },
      0
    );
    expect(staged).toBe('001_WD010_A_staging0.labnote.md');
  });

  it('keeps two files that swap numbers apart while staged', () => {
    const renames = planWorkflowRenumber([
      '002_WD010_A.labnote.md',
      '002_WD020_B.labnote.md',
      '001_WD030_C.labnote.md',
    ]);
    const staged = renames.map((r, i) => buildRenumberStagingName(r, i));
    expect(new Set(staged).size).toBe(staged.length);
    // No staging name collides with a name still on disk.
    for (const name of staged) {
      expect(renames.some(r => r.from === name)).toBe(false);
    }
  });
});

describe('collapseWorkflowRenames', () => {
  it('collapses a staged two-hop rename into a single hop', () => {
    expect(
      collapseWorkflowRenames([
        { from: '002_WD010_A.labnote.md', to: '001_WD010_A_staging0.labnote.md' },
        { from: '001_WD010_A_staging0.labnote.md', to: '001_WD010_A.labnote.md' },
      ])
    ).toEqual([{ from: '002_WD010_A.labnote.md', to: '001_WD010_A.labnote.md' }]);
  });

  it('drops a rename that ends back at the original name', () => {
    expect(
      collapseWorkflowRenames([
        { from: '001_WD010_A.labnote.md', to: '002_WD010_A.labnote.md' },
        { from: '002_WD010_A.labnote.md', to: '001_WD010_A.labnote.md' },
      ])
    ).toEqual([]);
  });
});

describe('reconcileWorkflowChecklist with staged renames', () => {
  it('relinks to the final name, not the staging one', () => {
    const readme = readmeWith([
      '- [ ] [A](./002_WD010_A.labnote.md)',
      '- [ ] [B](./001_WD020_B.labnote.md)',
    ]);
    // What the vault rename listener records for a two-file swap.
    const res = reconcileWorkflowChecklist(readme, [
      { from: '002_WD010_A.labnote.md', to: '001_WD010_A_staging0.labnote.md' },
      { from: '001_WD020_B.labnote.md', to: '002_WD020_B_staging1.labnote.md' },
      { from: '001_WD010_A_staging0.labnote.md', to: '001_WD010_A.labnote.md' },
      { from: '002_WD020_B_staging1.labnote.md', to: '002_WD020_B.labnote.md' },
    ]);
    const order = parseWorkflowChecklistFromReadme(res.content).map(i => i.fileName);
    expect(order).toEqual(['001_WD010_A.labnote.md', '002_WD020_B.labnote.md']);
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

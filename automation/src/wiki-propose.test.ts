// Globals convention (no `import ... from 'vitest'`) — matches the core tests.
//
// Pins the deterministic Phase 5 logic: objective-fact extraction (conclusions
// excluded), Finding keyword matching, section planning, and evidence rendering.
import {
  affectsMethods,
  extractFacts,
  matchFindings,
  newFindingHeading,
  parseProposal,
  planSections,
  renderSentences,
  tokenize,
  WIKI_STAGING,
} from './wiki-propose';
import type { ExperimentNote } from './lib/experiments';

const note = (body: string, fm: Record<string, unknown> = {}): ExperimentNote => ({
  dir: 'labnote/001_PCR',
  folderName: '001_PCR',
  frontMatter: { title: 'PCR run', id: 'EXP-001', status: 'completed', ...fm },
  body,
});

describe('extractFacts', () => {
  it('extracts bullet/prose facts and tags them with the evidence id', () => {
    const facts = extractFacts(
      note('## Methods\n- Ran 30 cycles at 60C\nMeasured yield 12 ng/uL\n')
    );
    expect(facts).toEqual([
      { text: 'Ran 30 cycles at 60C', evidenceId: 'EXP-001' },
      { text: 'Measured yield 12 ng/uL', evidenceId: 'EXP-001' },
    ]);
  });

  it('excludes conclusion sections and blockquotes', () => {
    const facts = extractFacts(
      note(
        [
          '## 🎯 Experiment Objective',
          '> maximise yield',
          '## Observations',
          '- band at 500bp',
          '## Summary and Discussion',
          'We conclude X works better.',
        ].join('\n')
      )
    );
    expect(facts).toEqual([{ text: 'band at 500bp', evidenceId: 'EXP-001' }]);
  });

  it('uses the folder name when no id is set', () => {
    const facts = extractFacts(note('- fact', { id: undefined }));
    expect(facts[0].evidenceId).toBe('001_PCR');
  });
});

describe('tokenize', () => {
  it('splits latin and hangul runs, dropping single chars', () => {
    expect(tokenize('PCR yield 측정 a')).toEqual(['pcr', 'yield', '측정']);
  });
});

describe('affectsMethods', () => {
  it('detects protocol/action facts', () => {
    expect(affectsMethods([{ text: 'protocol updated', evidenceId: 'E' }])).toBe(true);
    expect(affectsMethods([{ text: '프로토콜 변경', evidenceId: 'E' }])).toBe(true);
    expect(affectsMethods([{ text: 'band at 500bp', evidenceId: 'E' }])).toBe(false);
  });
});

describe('matchFindings', () => {
  it('matches findings by shared keywords', () => {
    const facts = [{ text: 'PCR yield increased', evidenceId: 'E' }];
    expect(matchFindings(facts, ['PCR yield trends', 'Cell viability'])).toEqual([
      'PCR yield trends',
    ]);
  });
  it('returns empty when nothing overlaps', () => {
    expect(matchFindings([{ text: 'band at 500bp', evidenceId: 'E' }], ['Cell viability'])).toEqual(
      []
    );
  });
});

describe('newFindingHeading', () => {
  it('combines title and identifier', () => {
    expect(newFindingHeading(note(''))).toBe('PCR run (EXP-001)');
  });
});

describe('planSections', () => {
  it('routes protocol facts to Methods and observations to a new Finding', () => {
    const targets = planSections(note('- protocol set to 60C\n- band at 500bp'), []);
    expect(targets).toEqual([
      { file: `${WIKI_STAGING}/Methods.md`, heading: 'Methods', facts: expect.anything() },
      {
        file: `${WIKI_STAGING}/Results.md`,
        heading: 'PCR run (EXP-001)',
        facts: expect.anything(),
      },
    ]);
  });

  it('routes to an existing matching Finding', () => {
    const targets = planSections(note('- yield measured'), ['yield trends']);
    expect(targets).toEqual([
      { file: `${WIKI_STAGING}/Results.md`, heading: 'yield trends', facts: expect.anything() },
    ]);
  });

  it('returns nothing when there are no facts', () => {
    expect(planSections(note(''), [])).toEqual([]);
  });
});

describe('parseProposal', () => {
  it('accepts a {sentences:[...]} object', () => {
    expect(
      parseProposal({ sentences: [{ text: 'a', evidence: 'EXP-1' }] })
    ).toEqual([{ text: 'a', evidence: 'EXP-1', insufficient_evidence: false }]);
  });
  it('accepts a bare array and flags insufficient evidence', () => {
    expect(parseProposal([{ text: 'a', insufficient_evidence: true }])).toEqual([
      { text: 'a', evidence: undefined, insufficient_evidence: true },
    ]);
  });
  it('rejects non-arrays', () => {
    expect(parseProposal('nope')).toBeUndefined();
  });
});

describe('renderSentences', () => {
  it('renders evidence tags and insufficient-evidence marks', () => {
    const md = renderSentences([
      { text: 'Ran 30 cycles', evidence: 'EXP-001' },
      { text: 'Unclear claim', insufficient_evidence: true },
    ]);
    expect(md).toBe('- Ran 30 cycles `[EXP-001]`\n- Unclear claim _(insufficient evidence)_');
  });
  it('handles no sentences', () => {
    expect(renderSentences([])).toContain('No new evidence-backed');
  });
});

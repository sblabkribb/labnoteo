// Globals convention (no `import ... from 'vitest'`) — matches the core tests.
//
// Pins the deterministic experiment-context rules shared by issue-sync,
// issue-gate and wiki-propose: identifier/title derivation, Objective extraction
// (placeholder omitted), file→experiment grouping, and the issue payload.
import {
  deriveIdentifier,
  deriveIssueTitle,
  experimentFolderName,
  extractObjective,
  getSectionBody,
  groupChangedExperiments,
  buildExperimentIssue,
  OBJECTIVE_PLACEHOLDER,
  type ExperimentNote,
} from './experiments';

describe('experimentFolderName', () => {
  it('returns the last path segment', () => {
    expect(experimentFolderName('labnote/001_PCR')).toBe('001_PCR');
    expect(experimentFolderName('labnote/002_Assay/')).toBe('002_Assay');
  });
});

describe('deriveIdentifier', () => {
  it('prefers front-matter id', () => {
    expect(deriveIdentifier({ id: 'EXP-007' }, '001_PCR')).toBe('EXP-007');
  });
  it('falls back to the folder name', () => {
    expect(deriveIdentifier({}, '001_PCR')).toBe('001_PCR');
    expect(deriveIdentifier({ id: '   ' }, '001_PCR')).toBe('001_PCR');
  });
});

describe('deriveIssueTitle', () => {
  it('formats [identifier] title', () => {
    expect(deriveIssueTitle('EXP-1', { title: 'Optimize PCR' })).toBe('[EXP-1] Optimize PCR');
  });
  it('uses the identifier when title is absent', () => {
    expect(deriveIssueTitle('001_PCR', {})).toBe('[001_PCR] 001_PCR');
  });
});

describe('getSectionBody', () => {
  const md = [
    '## 🎯 Experiment Objective',
    '> Measure yield at 30 cycles.',
    '',
    '## Next',
    'other',
  ].join('\n');
  it('extracts a section body and strips blockquote markers', () => {
    expect(getSectionBody(md, '🎯 Experiment Objective')).toBe('Measure yield at 30 cycles.');
  });
  it('returns undefined for an absent heading', () => {
    expect(getSectionBody(md, 'Missing')).toBeUndefined();
  });
});

describe('extractObjective', () => {
  it('returns a real objective', () => {
    const body = '## 🎯 Experiment Objective\nTest whether X increases Y.\n';
    expect(extractObjective(body)).toBe('Test whether X increases Y.');
  });
  it('omits the seeded placeholder', () => {
    const body = `## 🎯 Experiment Objective\n> ${OBJECTIVE_PLACEHOLDER}\n`;
    expect(extractObjective(body)).toBeUndefined();
  });
  it('omits an empty section', () => {
    expect(extractObjective('## 🎯 Experiment Objective\n\n## Next\n')).toBeUndefined();
  });
});

describe('groupChangedExperiments', () => {
  it('groups files into unique sorted experiment dirs and ignores others', () => {
    expect(
      groupChangedExperiments([
        'labnote/002_B/README.labnote.md',
        'labnote/001_A/README.labnote.md',
        'labnote/001_A/resources/x.csv',
        'README.md',
        'labnote/notes.md',
      ])
    ).toEqual(['labnote/001_A', 'labnote/002_B']);
  });
});

describe('buildExperimentIssue', () => {
  const note: ExperimentNote = {
    dir: 'labnote/001_PCR',
    folderName: '001_PCR',
    frontMatter: { title: 'PCR run', status: 'needs-review', id: 'EXP-001' },
    body: '## 🎯 Experiment Objective\nMaximise yield.\n',
  };
  it('builds a deterministic title, labels and body with objective', () => {
    const issue = buildExperimentIssue(note);
    expect(issue.identifier).toBe('EXP-001');
    expect(issue.title).toBe('[EXP-001] PCR run');
    expect(issue.labels).toEqual(['experiment', 'status:needs-review']);
    expect(issue.body).toContain('Maximise yield.');
    expect(issue.body).toContain('`labnote/001_PCR/README.labnote.md`');
  });
  it('notes the absence of an objective when placeholder', () => {
    const issue = buildExperimentIssue({
      ...note,
      body: `## 🎯 Experiment Objective\n> ${OBJECTIVE_PLACEHOLDER}\n`,
    });
    expect(issue.body).toContain('No objective recorded');
  });
});

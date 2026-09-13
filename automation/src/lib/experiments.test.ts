// Globals convention (no `import ... from 'vitest'`) — matches the core tests.
//
// Pins the deterministic experiment-context rules shared by issue-sync,
// issue-gate and wiki-propose: identifier/title derivation, Objective extraction
// (placeholder omitted), file→experiment grouping, and the issue payload.
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import {
  deriveIdentifier,
  deriveIssueTitle,
  experimentFolderName,
  extractObjective,
  getSectionBody,
  groupChangedExperiments,
  buildDiscussionIssue,
  buildExperimentIssue,
  readMarkerSources,
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

// Markers are mostly written in the workflow notes, so reading only the README
// loses them. These pin the folder-wide scan.
describe('readMarkerSources', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(`${tmpdir()}/labnoteo-`).replace(/\\/g, '/');
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  const write = (name: string, text: string): void => writeFileSync(`${dir}/${name}`, text);

  it('reads every *.labnote.md, README first then name order', () => {
    write('02_B.labnote.md', 'b');
    write('README.labnote.md', 'r');
    write('01_A.labnote.md', 'a');
    expect(readMarkerSources(dir).map(s => s.path)).toEqual([
      `${dir}/README.labnote.md`,
      `${dir}/01_A.labnote.md`,
      `${dir}/02_B.labnote.md`,
    ]);
  });

  it('ignores non-note files and subfolders', () => {
    write('README.labnote.md', 'r');
    write('notes.md', 'x');
    mkdirSync(`${dir}/resources`);
    expect(readMarkerSources(dir)).toHaveLength(1);
  });

  it('offsets each file by its own front matter', () => {
    write('01_A.labnote.md', '---\ntitle: A\n---\n\n@issue;ISS-a1;논의\n');
    write('README.labnote.md', '@issue;ISS-r1;논의\n');
    const [readme, workflow] = readMarkerSources(dir);
    expect(readme.bodyLineOffset).toBe(0);
    expect(workflow.bodyLineOffset).toBe(4);
  });

  it('returns nothing for a missing folder rather than throwing', () => {
    expect(readMarkerSources(`${dir}/nope`)).toEqual([]);
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

describe('buildDiscussionIssue', () => {
  const note: ExperimentNote = {
    dir: 'labnote/001_PCR',
    folderName: '001_PCR',
    frontMatter: { title: 'PCR run', status: 'in-progress', id: 'EXP-001' },
    body: '',
  };
  // The marker lives in a workflow note, where the run is actually written.
  // Front matter is 4 lines here, so body line 3 is file line 7.
  const source = {
    path: 'labnote/001_PCR/02_WB150_PCR.labnote.md',
    body: '## Results\n수율 40%.\n@issue;ISS-mkd8x3k;시드 배양 시간 차이 때문인지 논의 필요\n',
    bodyLineOffset: 4,
  };
  const marker = { id: 'ISS-mkd8x3k', title: '시드 배양 시간 차이 때문인지 논의 필요', line: 3 };

  it('namespaces the identifier under the experiment', () => {
    const issue = buildDiscussionIssue(note, source, marker, 'acme/vault', 'abc1234');
    expect(issue.identifier).toBe('EXP-001/ISS-mkd8x3k');
    expect(issue.title).toBe('[EXP-001/ISS-mkd8x3k] 시드 배양 시간 차이 때문인지 논의 필요');
    expect(issue.labels).toEqual(['experiment', 'discussion', 'status:in-progress']);
  });

  it('links the file the marker is in, not the README, at the exact line', () => {
    const issue = buildDiscussionIssue(note, source, marker, 'acme/vault', 'abc1234');
    expect(issue.body).toContain(
      'https://github.com/acme/vault/blob/abc1234/labnote/001_PCR/02_WB150_PCR.labnote.md#L7'
    );
  });

  it('carries the enclosing section so the issue has context', () => {
    expect(buildDiscussionIssue(note, source, marker, 'acme/vault', 'abc').body).toContain(
      '→ Results'
    );
  });

  it('omits the permalink rather than guessing when the commit is unknown', () => {
    const issue = buildDiscussionIssue(note, source, marker, 'acme/vault', undefined);
    expect(issue.body).not.toContain('/blob/');
    expect(issue.body).toContain(marker.title);
  });

  // The whole multi-issue scheme rests on these two tokens not matching each
  // other: `findIssueByIdentifier` filters search hits with `title.includes`,
  // so an overlap would make a marker issue satisfy the experiment's lookup.
  it('produces a token that cannot be confused with the experiment token', () => {
    const experiment = buildExperimentIssue(note);
    const discussion = buildDiscussionIssue(note, source, marker, 'acme/vault', 'abc');
    expect(discussion.title.includes(`[${experiment.identifier}]`)).toBe(false);
    expect(experiment.title.includes(`[${discussion.identifier}]`)).toBe(false);
  });
});

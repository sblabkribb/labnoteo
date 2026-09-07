// Globals convention (no `import ... from 'vitest'`) — see sampleDefinition.test.ts.
//
// `getExperimentDir` derives which `labnote/###_Name` experiment a path belongs
// to; every sample/workflow write is scoped by it, so the boundaries are pinned
// here. These cases were consolidated from the plugin's former
// `labnoteDirFromPath` test when the logic moved into core.
import {
  getExperimentDir,
  getExperimentLabsamplesFolder,
} from '../lib/labnoteStructure';

describe('getExperimentDir', () => {
  it('extracts the experiment folder from a note inside it', () => {
    expect(getExperimentDir('labnote/001_Test/README.labnote.md')).toBe('labnote/001_Test');
  });

  it('works for a note nested deeper in the experiment', () => {
    expect(getExperimentDir('labnote/001_Test/resources/labsamples/DNA.json')).toBe(
      'labnote/001_Test'
    );
  });

  it('keeps the prefix when labnote is not at the vault root', () => {
    expect(getExperimentDir('projects/2026/labnote/012_Assay/note.md')).toBe(
      'projects/2026/labnote/012_Assay'
    );
  });

  it('uses the last labnote segment when the name repeats', () => {
    expect(getExperimentDir('labnote/001_A/labnote/002_B/note.md')).toBe(
      'labnote/001_A/labnote/002_B'
    );
  });

  it('normalises separators and redundant segments', () => {
    expect(getExperimentDir('labnote//001_Test/./README.labnote.md')).toBe('labnote/001_Test');
  });

  it('normalises Windows backslash separators', () => {
    expect(getExperimentDir('labnote\\001_Test\\README.labnote.md')).toBe('labnote/001_Test');
  });

  it('returns undefined when there is no labnote segment', () => {
    expect(getExperimentDir('notes/daily/2026-09-07.md')).toBeUndefined();
  });

  it('returns undefined for the labnote folder itself (no experiment yet)', () => {
    expect(getExperimentDir('labnote')).toBeUndefined();
  });

  it.each([
    'labnote/Test/README.md', // no numeric prefix
    'labnote/1_Test/README.md', // too few digits
    'labnote/0001_Test/README.md', // too many digits before the underscore
    'labnote/001-Test/README.md', // wrong separator
  ])('returns undefined for a folder not matching ###_Name: %s', p => {
    expect(getExperimentDir(p)).toBeUndefined();
  });

  it('accepts the experiment folder path itself', () => {
    expect(getExperimentDir('labnote/001_Test')).toBe('labnote/001_Test');
  });
});

describe('getExperimentLabsamplesFolder', () => {
  it('appends resources/labsamples to the experiment dir', () => {
    expect(getExperimentLabsamplesFolder('labnote/001_Test/README.labnote.md')).toBe(
      'labnote/001_Test/resources/labsamples'
    );
  });

  it('resolves from a nested path within the experiment', () => {
    expect(getExperimentLabsamplesFolder('labnote/001_Test/images/a.png')).toBe(
      'labnote/001_Test/resources/labsamples'
    );
  });

  it('returns undefined for a path outside any experiment', () => {
    expect(getExperimentLabsamplesFolder('notes/a.md')).toBeUndefined();
  });
});

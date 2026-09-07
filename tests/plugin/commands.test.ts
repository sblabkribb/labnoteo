/**
 * `labnoteDirFromPath` decides which experiment folder every command acts on,
 * derived purely from the active file's path. Getting it wrong sends a write to
 * the wrong experiment, so the boundaries are worth pinning down.
 */
import { describe, it, expect } from 'vitest';
import { labnoteDirFromPath } from '../../src/commands';

describe('labnoteDirFromPath', () => {
  it('extracts the experiment folder from a note inside it', () => {
    expect(labnoteDirFromPath('labnote/001_Test/README.labnote.md')).toBe('labnote/001_Test');
  });

  it('works for a note nested deeper in the experiment', () => {
    expect(labnoteDirFromPath('labnote/001_Test/resources/labsamples/DNA.json')).toBe(
      'labnote/001_Test'
    );
  });

  it('keeps the prefix when labnote is not at the vault root', () => {
    expect(labnoteDirFromPath('projects/2026/labnote/012_Assay/note.md')).toBe(
      'projects/2026/labnote/012_Assay'
    );
  });

  it('uses the last labnote segment when the name repeats', () => {
    expect(labnoteDirFromPath('labnote/001_A/labnote/002_B/note.md')).toBe(
      'labnote/001_A/labnote/002_B'
    );
  });

  it('normalises separators and redundant segments', () => {
    expect(labnoteDirFromPath('labnote//001_Test/./README.labnote.md')).toBe('labnote/001_Test');
  });

  it('returns undefined when there is no labnote segment', () => {
    expect(labnoteDirFromPath('notes/daily/2026-09-07.md')).toBeUndefined();
  });

  it('returns undefined for the labnote folder itself (no experiment yet)', () => {
    expect(labnoteDirFromPath('labnote')).toBeUndefined();
  });

  it.each([
    'labnote/Test/README.md', // no numeric prefix
    'labnote/1_Test/README.md', // too few digits
    'labnote/0001_Test/README.md', // too many digits before the underscore
    'labnote/001-Test/README.md', // wrong separator
  ])('returns undefined for a folder not matching ###_Name: %s', p => {
    expect(labnoteDirFromPath(p)).toBeUndefined();
  });

  it('accepts the experiment folder path itself', () => {
    expect(labnoteDirFromPath('labnote/001_Test')).toBe('labnote/001_Test');
  });
});

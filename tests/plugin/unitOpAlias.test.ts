/**
 * #118: the same unit operation run twice needs a name for each run, and the
 * alias is asked only where the insert will go ahead.
 */
import { describe, it, expect, vi } from 'vitest';
import type { EditTarget, LabnoteHost } from '@labnoteo/core';
import { MemFileSystem } from '../../packages/labnoteo-core/src/fs/memFileSystem';
import type { App } from 'obsidian';
import { insertUnitOpAndUpdateToc, insertUnitOperationCommand } from '../../src/commands';

const WORKFLOW = [
  '## [WD010 Design]',
  '',
  '## Related Unit Operations',
  '',
  '## Conclusions and Discussion',
  '',
].join('\n');

function makeHost(path: string, initial = WORKFLOW, cursor?: (doc: string) => number) {
  let doc = initial;
  const notes: string[] = [];
  const target: EditTarget = {
    path,
    getText: async () => doc,
    insertAtCursor: async () => {},
    replaceRange: async (start, end, text) => {
      doc = doc.slice(0, start) + text + doc.slice(end);
    },
    ...(cursor ? { getCursorOffset: async () => cursor(doc) } : {}),
  };
  const host = {
    fs: new MemFileSystem(),
    t: (s: string, ...args: string[]) => args.reduce((acc, a, i) => acc.replace(`{${i}}`, a), s),
    notify: (_kind: string, message: string) => notes.push(message),
    editTarget: () => target,
  } as unknown as LabnoteHost;
  return { host, doc: () => doc, notes };
}

const OP = { opId: 'UHW180', opName: 'Incubation', opType: 'hw' as const };

describe('insertUnitOpAndUpdateToc with an alias prompt', () => {
  it('puts the alias in the heading and the TOC', async () => {
    const { host, doc } = makeHost('labnote/001_E/001_WD010_Design.labnote.md');
    const ask = vi.fn(async () => '1차 37도');

    expect(await insertUnitOpAndUpdateToc(host, OP, ask)).toBe(true);

    expect(ask).toHaveBeenCalledWith(OP);
    expect(doc()).toContain('### [UHW180 Incubation] 1차 37도');
    expect(doc()).toContain('- [UHW180 Incubation | 1차 37도](#uhw180-incubation-1차-37도)');
  });

  it('inserts nothing when the prompt is dismissed', async () => {
    const { host, doc } = makeHost('labnote/001_E/001_WD010_Design.labnote.md');

    expect(await insertUnitOpAndUpdateToc(host, OP, async () => undefined)).toBe(false);

    expect(doc()).toBe(WORKFLOW);
  });

  it('does not ask on a note that is no workflow', async () => {
    const { host, doc, notes } = makeHost('labnote/001_E/README.labnote.md');
    const ask = vi.fn(async () => 'x');

    expect(await insertUnitOpAndUpdateToc(host, OP, ask)).toBe(false);

    expect(ask).not.toHaveBeenCalled();
    expect(doc()).toBe(WORKFLOW);
    expect(notes).toEqual([
      'README.labnote.md is the experiment overview and holds no unit operations. Open one of its workflow notes (###_….labnote.md), or make one with "Create workflow".',
    ]);
  });
});

// #457: with sorting off, inserting reordered the entries arranged by hand.
describe('insertUnitOpAndUpdateToc with TOC sorting off', () => {
  const PATH = 'labnote/001_E/001_WB140_Colony.labnote.md';
  const NOTE = [
    '## [WB140 Colony]',
    '',
    '## Related Unit Operations',
    '',
    '- [UHW380 Microplate Reading | OD600](#uhw380-microplate-reading-od600)',
    '- [UHW300 LC-MS | PCD1](#uhw300-lc-ms-pcd1)',
    '',
    '---',
    '',
    '### [UHW300 LC-MS] PCD1',
    '',
    '#### Results & Discussions',
    '',
    '---',
    '',
    '### [UHW380 Microplate Reading] OD600',
    '',
    '#### Results & Discussions',
    '',
    '## Conclusions and Discussion',
    '',
  ].join('\n');
  const toc = (md: string) => md.split('\n').filter(l => l.startsWith('- ['));

  it('adds the new entry after the block before it, keeping the hand-made order', async () => {
    const { host, doc } = makeHost(PATH, NOTE, d => d.indexOf('#### Results', d.indexOf('PCD1\n')));
    const op = { opId: 'UHW290', opName: 'LC-MS-MS', opType: 'hw' as const };

    expect(await insertUnitOpAndUpdateToc(host, op, async () => '아미노산', { sortToc: false })).toBe(true);

    expect(toc(doc())).toEqual([
      '- [UHW380 Microplate Reading | OD600](#uhw380-microplate-reading-od600)',
      '- [UHW300 LC-MS | PCD1](#uhw300-lc-ms-pcd1)',
      '- [UHW290 LC-MS-MS | 아미노산](#uhw290-lc-ms-ms-아미노산)',
    ]);
  });

  it('does not rename the entry of a block of the same unit operation after the new one', async () => {
    const { host, doc } = makeHost(PATH, NOTE, d => d.indexOf('---', d.indexOf('OD600](')));
    const op = { opId: 'UHW380', opName: 'Microplate Reading', opType: 'hw' as const };

    await insertUnitOpAndUpdateToc(host, op, async () => 'OD450', { sortToc: false });

    expect(toc(doc())).toEqual([
      '- [UHW380 Microplate Reading | OD450](#uhw380-microplate-reading-od450)',
      '- [UHW380 Microplate Reading | OD600](#uhw380-microplate-reading-od600)',
      '- [UHW300 LC-MS | PCD1](#uhw300-lc-ms-pcd1)',
    ]);
  });

  it('still sorts with the setting on', async () => {
    const { host, doc } = makeHost(PATH, NOTE, d => d.indexOf('#### Results', d.indexOf('PCD1\n')));
    const op = { opId: 'UHW290', opName: 'LC-MS-MS', opType: 'hw' as const };

    await insertUnitOpAndUpdateToc(host, op, async () => 'aa', { sortToc: true });

    expect(toc(doc()).map(l => l.slice(3, 9))).toEqual(['UHW300', 'UHW290', 'UHW380']);
  });
});

// #455: the notice said the TOC was left alone while a renamed section got one.
describe('insertUnitOpAndUpdateToc notice under a renamed unit operation section', () => {
  it('does not say the table of contents was not updated when it was', async () => {
    const renamed = WORKFLOW.replace('## Related Unit Operations', '## 단위 공정 목록');
    const { host, doc, notes } = makeHost('labnote/001_E/001_WD040_X.labnote.md', renamed, d => d.length);

    await insertUnitOpAndUpdateToc(host, OP, async () => '조건 배정표');

    expect(doc()).toContain('## 단위 공정 목록\n\n- [UHW180 Incubation | 조건 배정표]');
    expect(notes).toEqual(['Unit operation inserted: UHW180 Incubation (before the conclusions)']);
  });

  it('still says so when no section could take the entry', async () => {
    const bare = '# Design\n\n## Conclusions and Discussion\n';
    const { host, notes } = makeHost('labnote/001_E/001_WD010_Design.labnote.md', bare, () => 0);

    await insertUnitOpAndUpdateToc(host, OP, async () => 'x');

    expect(notes[0]).toContain('no unit operation section was found, so the table of contents was not updated');
  });
});

describe('insertUnitOperationCommand on a note that is no workflow (#201, #166)', () => {
  it.each([
    ['labnote/001_E/README.labnote.md', 'README.labnote.md is the experiment overview'],
    ['labnote/Group/001_E/001_W.labnote.md', '"001_E" is not recognized as an experiment'],
    ['labnote/001_E/notes.md', '"notes.md" is not a workflow note'],
  ])('warns about %s before the picker opens', async (path, message) => {
    const { host, notes } = makeHost(path);
    const pick = vi.fn();
    Object.assign(host, { pick });

    await insertUnitOperationCommand({} as App, host);

    expect(pick).not.toHaveBeenCalled();
    expect(notes).toHaveLength(1);
    expect(notes[0]).toContain(message);
  });
});

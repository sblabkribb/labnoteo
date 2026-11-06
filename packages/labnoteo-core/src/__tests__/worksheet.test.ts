import {
  annotateWorksheetSamples,
  classifyUnitOp,
  listWorksheetUnitOps,
  paginateWorksheet,
  sectionWeight,
  type WorksheetUnitOp,
} from '../lib/worksheet';
import { findUnitOpInsertOffset, rebuildUnitOpToc } from '../sections/workflowSectionParser';
import { createWorkflowContent } from '../lib/workflowStructure';
import { buildHwUnitOpMarkdown, buildSwUnitOpMarkdown } from '../lib/unitOpTemplate';

function buildNote(blocks: string[]): string {
  let md = createWorkflowContent({ id: 'WD010', name: 'Design', description: 'desc' }, 'Dr. Kim');
  for (const block of blocks) {
    const off = findUnitOpInsertOffset(md);
    md = rebuildUnitOpToc(md.slice(0, off) + block + md.slice(off));
  }
  return md;
}

const meta = { experimenter: 'Dr. Kim', dateTime: '2026-10-15 10:00' };
const hw = (opId: string) => buildHwUnitOpMarkdown({ opId, opName: `Op ${opId}`, opDescription: 'Lab step' }, meta);
const sw = (opId: string) => buildSwUnitOpMarkdown({ opId, opName: `Op ${opId}`, opDescription: 'Code step' }, meta);

describe('classifyUnitOp', () => {
  it('goes by catalog prefix, then by a Software line', () => {
    expect(classifyUnitOp('UHW010', ['- Software: x'])).toBe('hw');
    expect(classifyUnitOp('USW010', [])).toBe('sw');
    expect(classifyUnitOp('UXX010', ['- Software:'])).toBe('sw');
    expect(classifyUnitOp('UXX010', ['- Equipment: x'])).toBe('hw');
  });
});

describe('listWorksheetUnitOps', () => {
  it('prints written text, checkboxes for steps, and blanks for placeholders', () => {
    const md = buildNote([hw('UHW010'), sw('USW020')]).replace(
      '#### Method\n- (method used in this step)',
      '#### Method\n1. Thaw cells\n2. Spin at 300 g\n   for 5 min'
    );
    const [lab, code] = listWorksheetUnitOps(md);
    expect(lab).toMatchObject({ index: 1, opId: 'UHW010', kind: 'hw', description: 'Lab step' });
    expect(code).toMatchObject({ index: 2, kind: 'sw' });
    expect(lab.sections.find(s => s.title === 'Method')).toEqual({
      type: 'steps',
      title: 'Method',
      steps: [
        { text: 'Thaw cells', sub: [] },
        { text: 'Spin at 300 g for 5 min', sub: [] },
      ],
    });
    expect(lab.sections.find(s => s.title === 'Reagent')).toEqual({ type: 'blank', title: 'Reagent' });
    const metaSection = lab.sections.find(s => s.type === 'meta');
    expect(metaSection).toMatchObject({
      fields: [
        { label: 'Experimenter', value: 'Dr. Kim' },
        { label: 'Start_date', value: '2026-10-15 10:00' },
        { label: 'End_date', value: '' },
      ],
    });
  });

  it('leaves the AI draft line out of the Method steps (#280)', () => {
    const md = buildNote([hw('UHW010')]).replace(
      '#### Method\n- (method used in this step)',
      '#### Method\n> [!note] AI draft (llama3.1, 2026-10-24) — review it, then delete this line\n\n1. Thaw cells\n2. Spin'
    );
    expect(listWorksheetUnitOps(md)[0].sections.find(s => s.title === 'Method')).toEqual({
      type: 'steps',
      title: 'Method',
      steps: [
        { text: 'Thaw cells', sub: [] },
        { text: 'Spin', sub: [] },
      ],
    });
  });

  // #558: a callout printed as `> [!warning]` text joined to the step above, or took a step number after a blank line.
  it('keeps quotes and callouts under the step above, without a number', () => {
    const md = buildNote([hw('UHW010')]).replace(
      '#### Method\n- (method used in this step)',
      [
        '#### Method',
        '1. Thaw cells',
        '> [!warning] Keep on ice',
        '> No more than 10 min',
        'at room temperature',
        '2. Spin',
        '',
        '> [!tip]-',
        '> slow down',
        '',
        '3. Wash',
        '   > rinse twice',
      ].join('\n')
    );
    expect(listWorksheetUnitOps(md)[0].sections.find(s => s.title === 'Method')).toEqual({
      type: 'steps',
      title: 'Method',
      steps: [
        {
          text: 'Thaw cells',
          sub: [],
          quotes: [{ kind: 'quote', callout: 'warning', title: 'Keep on ice', lines: ['No more than 10 min at room temperature'] }],
        },
        { text: 'Spin', sub: [], quotes: [{ kind: 'quote', callout: 'tip', lines: ['slow down'] }] },
        { text: 'Wash', sub: [], quotes: [{ kind: 'quote', lines: ['rinse twice'] }] },
      ],
    });
  });

  it('prints a quote in a text section as a block of its own, ended by a list item', () => {
    const md = buildNote([hw('UHW010')]).replace(
      '#### Results & Discussions\n- (Any results and discussions. Link file path if needed)',
      '#### Results & Discussions\n> [!summary] AI summary\n> Band at 1 kb\n> > nested\n- next point'
    );
    const results = listWorksheetUnitOps(md)[0].sections.find(s => s.title === 'Results & Discussions');
    expect(results).toEqual({
      type: 'text',
      title: 'Results & Discussions',
      blocks: [
        { kind: 'quote', callout: 'summary', title: 'AI summary', lines: ['Band at 1 kb', '> nested'] },
        { kind: 'item', level: 0, text: 'next point' },
      ],
    });
    expect(sectionWeight(results!)).toBe(2 + 4 + 1);
  });

  // #400: a template line left above what was written printed as text or as step 1.
  it('leaves out the template lines kept above what was written', () => {
    const md = buildNote([hw('UHW010')])
      .replace('#### Input\n- (samples from the previous step)', '#### Input\n- (samples from the previous step)\n- DNA-1')
      .replace(
        '#### Results & Discussions\n- (Any results and discussions. Link file path if needed)',
        '#### Results & Discussions\n- (Any results and discussions. Link file path if needed)\n| A |\n| --- |\n| 1 |'
      )
      .replace('#### Method\n- (method used in this step)', '#### Method\n- (method used in this step)\n1. Thaw\n2. Spin');
    const sections = listWorksheetUnitOps(md)[0].sections;
    expect(sections.find(s => s.title === 'Input')).toEqual({
      type: 'text',
      title: 'Input',
      blocks: [{ kind: 'item', level: 0, text: 'DNA-1' }],
    });
    expect(sections.find(s => s.title === 'Results & Discussions')).toEqual({
      type: 'text',
      title: 'Results & Discussions',
      blocks: [{ kind: 'table', rows: [['A'], ['1']] }],
    });
    expect(sections.find(s => s.title === 'Method')).toEqual({
      type: 'steps',
      title: 'Method',
      steps: [
        { text: 'Thaw', sub: [] },
        { text: 'Spin', sub: [] },
      ],
    });
  });

  it('drops blank lines from written text', () => {
    const md = buildNote([hw('UHW010')]).replace(
      '#### Results & Discussions\n- (Any results and discussions. Link file path if needed)',
      '#### Results & Discussions\nYield was low.\n\n\nRepeat tomorrow.\n'
    );
    expect(listWorksheetUnitOps(md)[0].sections.find(s => s.title === 'Results & Discussions')).toEqual({
      type: 'text',
      title: 'Results & Discussions',
      blocks: [
        { kind: 'para', text: 'Yield was low.' },
        { kind: 'para', text: 'Repeat tomorrow.' },
      ],
    });
  });

  it('reads a text section as list items, paragraphs and tables (#253)', () => {
    const md = buildNote([hw('UHW010')]).replace(
      '#### Equipment\n- (e.g. centrifuge, spectrophotometer, etc.)',
      '#### Equipment\n- Acoustic liquid dispenser\n  - 384-well head\n\n뒷정리 필요'
    );
    expect(listWorksheetUnitOps(md)[0].sections.find(s => s.title === 'Equipment')).toEqual({
      type: 'text',
      title: 'Equipment',
      blocks: [
        { kind: 'item', level: 0, text: 'Acoustic liquid dispenser' },
        { kind: 'item', level: 1, text: '384-well head' },
        { kind: 'para', text: '뒷정리 필요' },
      ],
    });
  });

  it('keeps the note\'s step numbers, nesting what is indented under a step (#254)', () => {
    const md = buildNote([hw('UHW090')]).replace(
      '#### Method\n- (method used in this step)',
      [
        '#### Method',
        '1. 컴피턴트 세포 준비',
        '    - BL21(DE3) 50 µL',
        '    - 얼음 위 10분',
        '2. 전기천공 조건',
        '',
        '| 전압 | 큐벳 | 시간상수 |',
        '| --- | --- | --- |',
        '| 1.8 kV | 1 mm | 5 ms |',
        '',
        '3. 회복 배양 1시간',
      ].join('\n')
    );
    expect(listWorksheetUnitOps(md)[0].sections.find(s => s.title === 'Method')).toEqual({
      type: 'steps',
      title: 'Method',
      steps: [
        { text: '컴피턴트 세포 준비', sub: ['BL21(DE3) 50 µL', '얼음 위 10분'] },
        {
          text: '전기천공 조건',
          sub: [],
          table: [
            ['전압', '큐벳', '시간상수'],
            ['1.8 kV', '1 mm', '5 ms'],
          ],
        },
        { text: '회복 배양 1시간', sub: [] },
      ],
    });
  });

  // #418: `1.` lines in a code block were read as steps; #436: a ticked step printed an empty box.
  it('keeps a code block with the step above it, a footnote under its step, and marks ticked steps', () => {
    const md = buildNote([hw('UHW010')]).replace(
      '#### Method\n- (method used in this step)',
      ['#### Method', '- [x] 준비', '```bash', '1. echo a', '', '2. echo b', '```', '- [ ] 측정 [^1]', '[^1]: 장비 A'].join('\n')
    );
    expect(listWorksheetUnitOps(md)[0].sections.find(s => s.title === 'Method')).toEqual({
      type: 'steps',
      title: 'Method',
      steps: [
        { text: '준비', sub: [], done: true, code: [['1. echo a', '', '2. echo b']] },
        { text: '측정 [^1]', sub: ['[^1]: 장비 A'] },
      ],
    });
  });

  // #417
  it('reads a table without pipes at the ends of its rows', () => {
    const md = buildNote([hw('UHW010')]).replace(
      '#### Equipment\n- (e.g. centrifuge, spectrophotometer, etc.)',
      '#### Equipment\n장비 | 설정\n--- | ---\n원심기 | 4 °C'
    );
    expect(listWorksheetUnitOps(md)[0].sections.find(s => s.title === 'Equipment')).toEqual({
      type: 'text',
      title: 'Equipment',
      blocks: [{ kind: 'table', rows: [['장비', '설정'], ['원심기', '4 °C']] }],
    });
  });

  it('skips the Worksheet scans section', () => {
    const md = buildNote([hw('UHW010')]).replace(
      '#### Results & Discussions',
      '#### Worksheet scans\n\n![[x.jpg]]\n\n#### Results & Discussions'
    );
    expect(listWorksheetUnitOps(md)[0].sections.map(s => s.title)).not.toContain('Worksheet scans');
  });

  // #383: a caution written under the title was dropped from the sheet.
  it('prints what is written above the first section first, without a heading', () => {
    const md = buildNote([hw('UHW010')]).replace(
      '### [UHW010 Op UHW010]\n',
      '### [UHW010 Op UHW010]\n\n- 주의: 피커 2번 핀이 휘어 있음. 1번 핀만 쓸 것\n'
    );
    const [op] = listWorksheetUnitOps(md);
    expect(op.description).toBe('Lab step');
    expect(op.sections[0]).toEqual({
      type: 'text',
      title: '',
      blocks: [{ kind: 'item', level: 0, text: '주의: 피커 2번 핀이 휘어 있음. 1번 핀만 쓸 것' }],
    });
    expect(op.sections[1].title).toBe('Meta');
    expect(listWorksheetUnitOps(buildNote([hw('UHW010')]))[0].sections[0].title).toBe('Meta');
  });
});

describe('paginateWorksheet', () => {
  it('starts each unit operation on a page and splits long ones at sections', () => {
    const md = buildNote([hw('UHW010'), hw('UHW020')]);
    const ops = listWorksheetUnitOps(md);
    const total = ops[0].sections.reduce((n, s) => n + sectionWeight(s), 0);
    const pages = paginateWorksheet(ops, Math.ceil(total / 2) + 3);
    const first = pages.filter(p => p.unitOp.index === 1);
    expect(first.length).toBeGreaterThan(1);
    expect(first.every(p => p.pageCount === first.length)).toBe(true);
    expect(first.flatMap(p => p.sections)).toEqual(ops[0].sections);
    expect(pages.filter(p => p.unitOp.index === 2)[0].page).toBe(1);
  });

  it('fits a template lab unit operation on one page', () => {
    const [op] = listWorksheetUnitOps(buildNote([hw('UHW010')]));
    const pages = paginateWorksheet([op]);
    expect(pages.map(p => `${p.page}/${p.pageCount}`)).toEqual(['1/1']);
    expect(pages.flatMap(p => p.sections)).toEqual(op.sections);
  });
});

// #496
describe('annotateWorksheetSamples', () => {
  const where: Record<string, string> = { 'dna-1': '-80 / Box *1* / A3', 'dna-2': '4도 / B1', 'rna-1': 'Rack A' };
  const lookup = (type: string, id: string) => (type === 'Plasmid' ? undefined : where[id.toLowerCase()]);
  const op = (sections: WorksheetUnitOp['sections']): WorksheetUnitOp => ({
    index: 1,
    opId: 'UHW010',
    opName: 'Thaw DNA-1',
    alias: 'DNA-1 prep',
    kind: 'hw',
    description: 'Thaw DNA-1 on ice',
    sections,
  });

  it('adds the location after the reference, by ID when there are several', () => {
    const [out] = annotateWorksheetSamples(
      [
        op([
          { type: 'meta', title: 'Meta', fields: [{ label: 'Input', value: 'DNA-1;pUC19' }] },
          {
            type: 'steps',
            title: 'Method',
            steps: [
              { text: 'Mix DNA-1 and dna-2', sub: ['then DNA-1 again'], table: [['Sample'], ['RNA-1']], code: [['DNA-1']] },
            ],
          },
          {
            type: 'text',
            title: 'Results',
            blocks: [
              { kind: 'item', level: 0, text: 'DNA-1;a, DNA-1;b' },
              { kind: 'para', text: 'No sample here' },
              { kind: 'table', rows: [['DNA-2', 'x']] },
              { kind: 'code', lines: ['DNA-2'] },
            ],
          },
        ]),
      ],
      ['DNA', 'RNA'],
      lookup
    );
    expect(out.sections[0]).toMatchObject({ fields: [{ value: 'DNA-1;pUC19 — -80 / Box \\*1\\* / A3' }] });
    expect(out.sections[1]).toMatchObject({
      steps: [
        {
          text: 'Mix DNA-1 and dna-2 — DNA-1: -80 / Box \\*1\\* / A3; dna-2: 4도 / B1',
          sub: ['then DNA-1 again — -80 / Box \\*1\\* / A3'],
          table: [['Sample'], ['RNA-1 — Rack A']],
          code: [['DNA-1']],
        },
      ],
    });
    expect(out.sections[2]).toMatchObject({
      blocks: [
        { text: 'DNA-1;a, DNA-1;b — -80 / Box \\*1\\* / A3' },
        { text: 'No sample here' },
        { rows: [['DNA-2 — 4도 / B1', 'x']] },
        { lines: ['DNA-2'] },
      ],
    });
    expect(out).toMatchObject({ opName: 'Thaw DNA-1', alias: 'DNA-1 prep', description: 'Thaw DNA-1 on ice' });
  });

  it('leaves out unknown, discarded and unplaced samples, naming the placed one among several', () => {
    const [out] = annotateWorksheetSamples(
      [op([{ type: 'text', title: 'Results', blocks: [{ kind: 'para', text: 'DNA-9 then DNA-2' }, { kind: 'para', text: 'DNA-9' }] }])],
      ['DNA'],
      lookup
    );
    expect(out.sections[0]).toMatchObject({ blocks: [{ text: 'DNA-9 then DNA-2 — DNA-2: 4도 / B1' }, { text: 'DNA-9' }] });
  });

  it('is counted when the pages are laid out', () => {
    const long = 'x'.repeat(70);
    const unitOps = [op([{ type: 'text', title: 'Results', blocks: Array.from({ length: 20 }, () => ({ kind: 'para' as const, text: `${long} DNA-1` })) }])];
    const before = sectionWeight(unitOps[0].sections[0]);
    const after = sectionWeight(annotateWorksheetSamples(unitOps, ['DNA'], lookup)[0].sections[0]);
    expect(after).toBeGreaterThan(before);
  });
});
